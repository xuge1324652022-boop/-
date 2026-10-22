/** CI 发布协议的 mock 回归：不访问网络、不读取本机凭据、不部署。 */
import assert from 'node:assert/strict'
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCurrentRevision, assetHash, deploy, MEDIA_ORIGIN, prepare, readRemoteSha, uploader, validate, WORKER_NAME } from './cloudflare-ci.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = join(ROOT, 'tmp', 'cloudflare-ci', 'mock-projects')
const ACCOUNT = 'a'.repeat(32)
const API_TOKEN = 'test-api-token-do-not-log'
const UPLOAD_TOKEN = 'test-upload-token-do-not-log'
const COMPLETION = 'test-completion-token-do-not-log'
const SHA = 'c'.repeat(40)
const env = { CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_API_TOKEN: API_TOKEN, WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main', WORKERS_CI_COMMIT_SHA: SHA }
const json = (result, status = 200, success = true) => new Response(JSON.stringify({ success, result }), { status, headers: { 'Content-Type': 'application/json' } })
let passed = 0
const testProjectRoots = []
await mkdir(BASE, { recursive: true })

async function fixture() {
  const projectRoot = await mkdtemp(join(BASE, 'case-'))
  testProjectRoots.push(projectRoot)
  await mkdir(join(projectRoot, 'dist'))
  await mkdir(join(projectRoot, 'deploy'))
  const local = new Map([
    ['/index.html', Buffer.from('<!doctype html><html><body>CI fixture</body></html>')],
    ['/app.js', Buffer.from('console.log("fixture")')],
    ['/resume.pdf', Buffer.from('%PDF-1.7 fixture')],
  ])
  for (const [path, buffer] of local) await writeFile(join(projectRoot, 'dist', path.slice(1)), buffer)
  // 特殊部署文件采用 API metadata，不能误上传为静态素材。
  await writeFile(join(projectRoot, 'dist', '_headers'), '/*\n  X-Content-Type-Options: nosniff\n')
  const config = {
    name: WORKER_NAME, main_module: 'media-range.mjs', compatibility_date: '2026-10-19',
    bindings: [{ type: 'assets', name: 'ASSETS' }, { type: 'plain_text', name: 'OTHER', text: 'keep-me' }],
    assets: { config: { html_handling: 'none', not_found_handling: 'none', run_worker_first: ['/color/*', '/resume.pdf'], _headers: '/*\n  X-Content-Type-Options: nosniff\n', _redirects: '/ /index.html 200\n' } },
    observability: { enabled: true, logs: { enabled: true, head_sampling_rate: 0.1 }, traces: { enabled: true, head_sampling_rate: 0.01 } },
  }
  await writeFile(join(projectRoot, 'deploy', 'cloudflare-assets.json'), JSON.stringify(config))
  await writeFile(join(projectRoot, 'deploy', 'media-range.mjs'), 'export default { fetch() { return new Response("fixture") } }')
  const media = new Map(Array.from({ length: 15 }, (_, index) => [`/color/color grade-${index + 1}.mp4`, Buffer.from(`ftypisom-${index + 1}-${'video'.repeat(20)}`)]))
  const mediaManifest = Object.fromEntries([...media].map(([path, buffer]) => [path, { hash: assetHash(buffer, path), size: buffer.length }]))
  await writeFile(join(projectRoot, 'deploy', 'media-manifest.json'), JSON.stringify(mediaManifest))
  return { projectRoot, config, local, media, mediaManifest, checkoutShaImpl: async () => SHA }
}

function mock(fixture, { buckets = [], mediaResponse, uploadResponse, putResponse, remoteShaResponse, checkoutShaResponse } = {}) {
  const calls = []
  const allCalls = []
  const revisionCalls = []
  const forms = []
  let uploadCount = 0
  let bucketIndex = 0
  let checkoutCount = 0
  let metadata
  fixture.checkoutShaImpl = async projectRoot => {
    assert.equal(projectRoot, fixture.projectRoot)
    checkoutCount++
    return checkoutShaResponse ? checkoutShaResponse(checkoutCount) : SHA
  }
  fixture.remoteShaImpl = async projectRoot => {
    assert.equal(projectRoot, fixture.projectRoot)
    const call = { url: 'git:origin/refs/heads/main', method: 'git ls-remote' }
    revisionCalls.push(call)
    allCalls.push(call)
    return remoteShaResponse ? remoteShaResponse(revisionCalls.length) : SHA
  }
  const fetchImpl = async (input, options) => {
    const url = new URL(input)
    const call = { url: String(url), method: options.method }
    allCalls.push(call)
    assert.equal(options.redirect, 'manual')
    assert(options.signal)
    calls.push(call)
    if (url.origin === MEDIA_ORIGIN) {
      assert.equal(options.headers.Authorization, undefined, '公开下载不能携带 API 凭据')
      const path = decodeURIComponent(url.pathname)
      assert(fixture.media.has(path), '只允许已登记媒体路径')
      if (mediaResponse) return mediaResponse(path, fixture.media.get(path))
      return new Response(fixture.media.get(path), { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(fixture.media.get(path).length) } })
    }
    assert.equal(url.origin, 'https://api.cloudflare.com')
    if (url.pathname.endsWith('/assets-upload-session')) {
      assert.equal(options.headers.Authorization, `Bearer ${API_TOKEN}`)
      const manifest = JSON.parse(options.body).manifest
      assert.equal(Object.keys(manifest).length, 18)
      for (const [path, entry] of Object.entries(fixture.mediaManifest)) assert.deepEqual(manifest[path], entry)
      return json({ jwt: buckets.length ? UPLOAD_TOKEN : COMPLETION, buckets })
    }
    if (url.pathname.endsWith('/assets/upload')) {
      assert.equal(options.headers.Authorization, `Bearer ${UPLOAD_TOKEN}`)
      assert.equal(url.search, '?base64=true')
      assert(options.body instanceof FormData)
      forms.push(options.body)
      const expected = buckets[bucketIndex]
      assert.deepEqual([...options.body.keys()], expected)
      for (const [hash, file] of options.body) {
        const source = [...fixture.local, ...fixture.media].find(([path, buffer]) => assetHash(buffer, path) === hash)
        assert(source, '只上传清单中已校验的字节')
        assert.equal(await file.text(), source[1].toString('base64'))
      }
      uploadCount++
      const response = uploadResponse ? uploadResponse(uploadCount) : json(bucketIndex + 1 === buckets.length ? { jwt: COMPLETION } : {}, bucketIndex + 1 === buckets.length ? 201 : 200)
      if ([200, 201, 202].includes(response.status)) bucketIndex++
      return response
    }
    assert.equal(options.method, 'PUT')
    assert.equal(url.pathname, `/client/v4/accounts/${ACCOUNT}/workers/scripts/${WORKER_NAME}`)
    assert.equal(options.headers.Authorization, `Bearer ${API_TOKEN}`)
    metadata = JSON.parse(await options.body.get('metadata').text())
    assert.equal(metadata.name, undefined)
    assert.equal(metadata.assets.jwt, COMPLETION)
    assert.deepEqual(metadata.assets.config, fixture.config.assets.config)
    assert.deepEqual(metadata.observability, fixture.config.observability)
    assert.equal(metadata.main_module, fixture.config.main_module)
    assert.equal(metadata.compatibility_date, fixture.config.compatibility_date)
    assert.deepEqual(metadata.bindings.find(binding => binding.name === 'ASSETS'), { type: 'assets', name: 'ASSETS' })
    assert.deepEqual(metadata.bindings.find(binding => binding.name === 'OTHER'), fixture.config.bindings[1])
    const sizes = JSON.parse(metadata.bindings.find(binding => binding.name === 'MEDIA_SIZES').text)
    assert.equal(Object.keys(sizes).length, 16)
    for (const [path, buffer] of fixture.media) assert.equal(sizes[path], buffer.length)
    assert.equal(sizes['/resume.pdf'], fixture.local.get('/resume.pdf').length)
    assert.equal(await options.body.get('media-range.mjs').text(), await readFile(join(fixture.projectRoot, 'deploy', 'media-range.mjs'), 'utf8'))
    return putResponse ? putResponse() : json({ deployment_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' })
  }
  return { fetchImpl, calls, allCalls, revisionCalls, forms, get metadata() { return metadata } }
}

async function test(name, operation) {
  const initialFixtures = testProjectRoots.length
  await operation().finally(async () => {
    for (const projectRoot of testProjectRoots.splice(initialFixtures)) {
      const directory = resolve(projectRoot)
      if (dirname(directory) !== BASE || !/^case-[A-Za-z0-9]+$/u.test(basename(directory)) || (await lstat(directory)).isSymbolicLink()) throw new Error('拒绝清理非测试夹具目录')
      await rm(directory, { recursive: true, force: true, maxRetries: 3 })
    }
  })
  passed++
  process.stdout.write(`PASS: ${name}\n`)
}

await test('prepare 不需要凭据或媒体文件；重复准备使用新目录；快照改动被拒绝', async () => {
  const f = await fixture()
  const first = await prepare(f)
  const second = await prepare(f)
  assert.notEqual(first.outputRoot, second.outputRoot)
  assert.equal(first.files.length, 3)
  assert.equal(Object.keys(first.manifest).length, 18)
  assert.equal(Object.keys(first.mediaManifest).length, 15)
  assert(first.outputRoot.startsWith(join(f.projectRoot, 'tmp', 'cloudflare-ci')))
  await writeFile(join(first.site, 'app.js'), 'changed')
  await assert.rejects(() => validate(first), /不一致/)
})

await test('媒体数量与命名由 committed 清单决定，新增第16段无需改发布代码', async () => {
  const f = await fixture()
  const path = '/color/reviewed-new-cut.mp4'
  const buffer = Buffer.from('ftypisom-reviewed-sixteenth-video')
  const mediaManifest = { ...f.mediaManifest, [path]: { hash: assetHash(buffer, path), size: buffer.length } }
  await writeFile(join(f.projectRoot, 'deploy', 'media-manifest.json'), JSON.stringify(mediaManifest))
  const prepared = await prepare(f)
  assert.equal(Object.keys(prepared.mediaManifest).length, 16)
  assert.deepEqual(prepared.mediaManifest[path], mediaManifest[path])
  await writeFile(join(f.projectRoot, 'deploy', 'media-manifest.json'), JSON.stringify(f.mediaManifest))
  await assert.rejects(() => validate(prepared), /不一致/, '已生成快照不能夹带后来退出清单的媒体')
})

await test('空 buckets 复用 completion JWT，仅发送 session 和 Worker PUT', async () => {
  const f = await fixture()
  const state = mock(f)
  const result = await deploy({ ...f, fetchImpl: state.fetchImpl, env })
  assert.deepEqual(state.calls.map(call => call.method), ['POST', 'PUT'])
  assert.equal(result.uploadedFiles, 0)
  assert.equal(result.downloadedMedia, 0)
  assert.equal(JSON.stringify(result).includes(COMPLETION), false)
})

await test('只上传服务端要求的新 build 文件，保留完整 metadata 与媒体大小', async () => {
  const f = await fixture()
  const hash = assetHash(f.local.get('/app.js'), '/app.js')
  const state = mock(f, { buckets: [[hash]] })
  const progress = []
  const result = await deploy({ ...f, fetchImpl: state.fetchImpl, env, progress: value => progress.push(value) })
  assert.equal(result.uploadedFiles, 1)
  assert.equal(result.downloadedMedia, 0)
  assert.equal(state.calls.filter(call => call.url.startsWith(MEDIA_ORIGIN)).length, 0)
  for (const token of [API_TOKEN, UPLOAD_TOKEN, COMPLETION]) assert.equal(JSON.stringify([result, progress]).includes(token), false)
})

await test('完整检查后续 bucket 的未知 hash；禁止提前下载、上传或部署', async () => {
  const f = await fixture()
  const state = mock(f, { buckets: [[Object.values(f.mediaManifest)[0].hash], ['0'.repeat(32)]] })
  await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }), /未知或重复 hash/)
  assert.equal(state.calls.length, 1)
})

await test('全部缺失媒体先完成下载校验，再开始任何上传', async () => {
  const f = await fixture()
  const hashes = Object.values(f.mediaManifest).slice(0, 2).map(entry => entry.hash)
  const state = mock(f, { buckets: [hashes] })
  const result = await deploy({ ...f, fetchImpl: state.fetchImpl, env })
  assert.deepEqual(state.calls.map(call => call.method), ['POST', 'GET', 'GET', 'POST', 'PUT'])
  assert.equal(result.downloadedMedia, 2)
  assert.equal(result.uploadedFiles, 2)
})

await test('已审核的本地模板视频直接上传，不从旧站恢复媒体', async () => {
  const f = await fixture()
  await mkdir(join(f.projectRoot, 'dist', 'color'))
  const [path, buffer] = [...f.media][0]
  await writeFile(join(f.projectRoot, 'dist', path.slice(1)), buffer)
  const state = mock(f, { buckets: [[assetHash(buffer, path)]], mediaResponse: () => { throw Error('禁止回读旧站') } })
  const result = await deploy({ ...f, fetchImpl: state.fetchImpl, env })
  assert.equal(result.downloadedMedia, 0)
  assert.equal(result.uploadedFiles, 1)
  assert.equal(state.calls.some(call => call.method === 'GET'), false)
})

await test('多个 buckets 按原分组上传，最后一组 201 才部署', async () => {
  const f = await fixture()
  const hashes = ['/app.js', '/index.html'].map(path => assetHash(f.local.get(path), path))
  const state = mock(f, { buckets: hashes.map(hash => [hash]) })
  const result = await deploy({ ...f, fetchImpl: state.fetchImpl, env })
  assert.equal(result.uploadedFiles, 2)
  assert.deepEqual(state.calls.map(call => call.method), ['POST', 'POST', 'POST', 'PUT'])
})

for (const transient of ['HTTP 500', '网络异常']) {
  await test(`${transient} 重试重新构建同一 bucket 的 FormData`, async () => {
    const f = await fixture()
    const hash = assetHash(f.local.get('/app.js'), '/app.js')
    const state = mock(f, { buckets: [[hash]], uploadResponse: attempt => {
      if (attempt === 1) {
        if (transient === '网络异常') throw new Error(API_TOKEN)
        return new Response('temporary', { status: 500 })
      }
      return json({ jwt: COMPLETION }, 201)
    } })
    const delays = []
    const result = await deploy({ ...f, fetchImpl: state.fetchImpl, env, delay: async ms => delays.push(ms) })
    assert.equal(result.uploadedFiles, 1)
    assert.deepEqual(delays, [1000])
    assert.notEqual(state.forms[0], state.forms[1])
  })
}

for (const [name, mediaResponse] of [
  ['跨 origin 跳转', () => new Response(null, { status: 302, headers: { Location: 'https://example.com/stolen.mp4' } })],
  ['同 origin 跳转', () => new Response(null, { status: 302, headers: { Location: `${MEDIA_ORIGIN}/other.mp4` } })],
  ['404', () => new Response('missing', { status: 404 })],
  ['错误类型', (_path, buffer) => new Response(buffer, { headers: { 'Content-Type': 'text/html' } })],
  ['大小不符', (_path, buffer) => new Response(buffer.subarray(1), { headers: { 'Content-Type': 'video/mp4' } })],
  ['超出大小', (_path, buffer) => new Response(Buffer.concat([buffer, buffer]), { headers: { 'Content-Type': 'video/mp4' } })],
  ['声明大小不符', (_path, buffer) => new Response(buffer, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': '1' } })],
  ['压缩编码', (_path, buffer) => new Response(buffer, { headers: { 'Content-Type': 'video/mp4', 'Content-Encoding': 'gzip' } })],
  ['hash 不符', (_path, buffer) => new Response(Buffer.alloc(buffer.length, 42), { headers: { 'Content-Type': 'video/mp4' } })],
]) {
  await test(`媒体${name}：前一段有效也不能提前上传`, async () => {
    const f = await fixture()
    const hashes = Object.values(f.mediaManifest).slice(0, 2).map(entry => entry.hash)
    let mediaCount = 0
    const state = mock(f, { buckets: [hashes], mediaResponse: (path, buffer) => ++mediaCount === 1 ? new Response(buffer, { headers: { 'Content-Type': 'video/mp4' } }) : mediaResponse(path, buffer) })
    await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }))
    assert.deepEqual(state.calls.map(call => call.method), ['POST', 'GET', 'GET'])
  })
}

for (const [name, result, status] of [['200 中的 JWT', { jwt: COMPLETION }, 200], ['201 缺少 JWT', {}, 201]]) {
  await test(`${name} 不能越过 completion 门禁`, async () => {
    const f = await fixture()
    const hash = assetHash(f.local.get('/app.js'), '/app.js')
    const state = mock(f, { buckets: [[hash]], uploadResponse: () => json(result, status) })
    await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }), /JWT/)
    assert.equal(state.calls.some(call => call.method === 'PUT'), false)
  })
}

await test('重复 hash、任意媒体引用、错误 Worker 与越界输出被拒绝', async () => {
  const f = await fixture()
  const prepared = await prepare(f)
  const hash = Object.values(f.mediaManifest)[0].hash
  await assert.rejects(() => uploader(prepared, { jwt: UPLOAD_TOKEN, buckets: [[hash], [hash]] }, { accountId: ACCOUNT, fetchImpl: () => { throw new Error('不能调用网络') } }), /重复 hash/)
  await assert.rejects(() => prepare({ ...f, outputRoot: join(f.projectRoot, 'outside') }), /输出必须/)
  await writeFile(join(f.projectRoot, 'deploy', 'media-manifest.json'), JSON.stringify({ ...f.mediaManifest, '/other.mp4': { hash, size: Object.values(f.mediaManifest)[0].size } }))
  await assert.rejects(() => prepare(f), /已登记调色 MP4 路径/)
  await writeFile(join(f.projectRoot, 'deploy', 'media-manifest.json'), JSON.stringify(f.mediaManifest))
  await writeFile(join(f.projectRoot, 'deploy', 'cloudflare-assets.json'), JSON.stringify({ ...f.config, name: 'another-worker' }))
  await assert.rejects(() => prepare(f), /既有站点/)
})

await test('隐藏凭据文件、疑似凭据内容、符号链接在准备时失败', async () => {
  const hidden = await fixture()
  await writeFile(join(hidden.projectRoot, 'dist', '.env'), 'fixture-only')
  await assert.rejects(() => prepare(hidden), /凭据素材路径/)
  const content = await fixture()
  await writeFile(join(content.projectRoot, 'dist', 'app.js'), `const value = "${'ghp_'}${'a'.repeat(40)}"`)
  await assert.rejects(() => prepare(content), /疑似凭据/)
  const linked = await fixture()
  const target = join(linked.projectRoot, 'source')
  await mkdir(target)
  await writeFile(join(target, 'file.txt'), 'fixture-only')
  await symlink(target, join(linked.projectRoot, 'dist', 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(() => prepare(linked), /符号链接或目录联接/)
})

await test('缺少 env 凭据和 API 失败不会泄露服务端响应内容', async () => {
  const f = await fixture()
  await assert.rejects(() => deploy({ ...f, env: {} }), /CLOUDFLARE_ACCOUNT_ID/)
  await assert.rejects(() => deploy({ ...f, env: { CLOUDFLARE_ACCOUNT_ID: ACCOUNT } }), /CLOUDFLARE_API_TOKEN/)
  const state = mock(f, { putResponse: () => new Response(API_TOKEN, { status: 403 }) })
  await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }), error => error.message === 'Cloudflare API 返回 HTTP 403' && !error.message.includes(API_TOKEN))
})

await test('部署前后都核对固定 main，最后一次查询紧邻 Worker PUT', async () => {
  const f = await fixture()
  const state = mock(f)
  const result = await deploy({ ...f, fetchImpl: state.fetchImpl, env })
  assert.equal(result.commitSha, SHA)
  assert.equal(state.revisionCalls.length, 2)
  assert.deepEqual(state.allCalls.slice(-2).map(call => [call.url, call.method]), [['git:origin/refs/heads/main', 'git ls-remote'], [`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${WORKER_NAME}`, 'PUT']])
})

for (const [name, override] of [
  ['缺少 native Builds 上下文', { WORKERS_CI: undefined }],
  ['非 main 分支', { WORKERS_CI_BRANCH: 'feature/test' }],
  ['缺少构建 SHA', { WORKERS_CI_COMMIT_SHA: undefined }],
  ['构建 SHA 不是完整 40 位', { WORKERS_CI_COMMIT_SHA: 'ccccccc' }],
]) {
  await test(`${name}时在任何网络前失败关闭`, async () => {
    const f = await fixture()
    const state = mock(f)
    await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env: { ...env, ...override } }), /Workers Builds main/)
    assert.equal(state.allCalls.length, 0)
  })
}

await test('本地 checkout 和构建 SHA 不同或无法确认时不请求任何网络', async () => {
  const f = await fixture()
  const mismatch = mock(f, { checkoutShaResponse: () => 'd'.repeat(40) })
  await assert.rejects(() => deploy({ ...f, fetchImpl: mismatch.fetchImpl, env }), /本地 Git 提交与构建 SHA 不符/)
  const unavailable = mock(f, { checkoutShaResponse: () => { throw new Error(API_TOKEN) } })
  await assert.rejects(() => assertCurrentRevision({ ...f, env }), error => /无法只读确认本地 Git 提交/.test(error.message) && !error.message.includes(API_TOKEN))
  // fixture 位于真实仓库内；不存在的 cwd 才能避免 Git 向上找到真实 HEAD。
  await assert.rejects(() => assertCurrentRevision({ projectRoot: join(f.projectRoot, 'missing-checkout'), env }), /无法只读确认本地 Git 提交/)
  assert.equal(mismatch.allCalls.length + unavailable.allCalls.length, 0)
})

await test('启动时 main 已推进：只查 HEAD，不创建上传会话', async () => {
  const f = await fixture()
  const state = mock(f, { remoteShaResponse: () => 'd'.repeat(40) })
  await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }), /落后于 origin\/main/)
  assert.equal(state.revisionCalls.length, 1)
  assert.equal(state.calls.length, 0)
})

await test('上传期间 main 推进：资产可已上传，但禁止 Worker PUT', async () => {
  const f = await fixture()
  const hash = assetHash(f.local.get('/app.js'), '/app.js')
  const state = mock(f, { buckets: [[hash]], remoteShaResponse: attempt => attempt === 1 ? SHA : 'd'.repeat(40) })
  await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }), /落后于 origin\/main/)
  assert.equal(state.revisionCalls.length, 2)
  assert.deepEqual(state.calls.map(call => call.method), ['POST', 'POST'])
})

await test('最终检查本地 checkout 或构建变量变更时禁止 PUT', async () => {
  const f = await fixture()
  const state = mock(f, { checkoutShaResponse: attempt => attempt === 1 ? SHA : 'd'.repeat(40) })
  await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }), /本地 Git 提交与构建 SHA 不符/)
  assert.equal(state.calls.some(call => call.method === 'PUT'), false)
  const changedEnv = { ...env }
  const changed = mock(f, { remoteShaResponse: () => {
    changedEnv.WORKERS_CI_COMMIT_SHA = 'd'.repeat(40)
    return SHA
  } })
  await assert.rejects(() => deploy({ ...f, fetchImpl: changed.fetchImpl, env: changedEnv }), /构建 SHA 上下文发生变化/)
  assert.equal(changed.calls.some(call => call.method === 'PUT'), false)
})

for (const name of ['鉴权失败', '超时', 'main 不存在', 'Git 不可用']) {
  await test(`Git 远端查询${name}失败关闭且不泄露 stderr`, async () => {
    const f = await fixture()
    const state = mock(f, { remoteShaResponse: () => { throw Object.assign(new Error(API_TOKEN), { stderr: `${name}: ${API_TOKEN}` }) } })
    await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }), error => error.message === '无法通过构建 Git 确认 origin/main，禁止部署' && !error.message.includes(API_TOKEN))
    assert.equal(state.calls.length, 0)
  })
}

for (const invalid of [undefined, '', 'bad', `${SHA}\n`, { sha: SHA }]) {
  await test('远端 SHA 不是严格的 40 位字符串时禁止发布', async () => {
    const f = await fixture()
    const state = mock(f, { remoteShaResponse: () => invalid })
    await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }), /origin\/main 引用格式无效/)
    assert.equal(state.calls.length, 0)
  })
}

await test('最终 HEAD 查询故障时同样不能执行 PUT', async () => {
  const f = await fixture()
  const state = mock(f, { remoteShaResponse: attempt => { if (attempt === 1) return SHA; throw new Error(API_TOKEN) } })
  await assert.rejects(() => deploy({ ...f, fetchImpl: state.fetchImpl, env }), /无法通过构建 Git/)
  assert.equal(state.revisionCalls.length, 2)
  assert.equal(state.calls.some(call => call.method === 'PUT'), false)
})

function gitMock({ origin = 'https://github.com/xuge1324652022-boop/job-application-template.git', output = `${SHA}\trefs/heads/main\n`, errorAt } = {}) {
  const calls = []
  return {
    calls,
    async execFileImpl(command, args, options) {
      calls.push({ command, args, options })
      assert.equal(command, 'git')
      assert.equal(options.shell, false)
      assert.equal(options.windowsHide, true)
      assert.equal(options.timeout, 30_000)
      assert.equal(options.maxBuffer, 8192)
      assert.equal(options.env.GIT_TERMINAL_PROMPT, '0')
      assert.equal(options.env.GCM_INTERACTIVE, 'Never')
      assert.equal(options.env.GIT_ASKPASS, 'ephemeral-build-askpass')
      assert.equal(options.env.GIT_TRACE, undefined)
      assert.equal(options.env.GIT_CURL_VERBOSE, undefined)
      assert.equal(args.includes('http.followRedirects=false'), true)
      assert.equal(args.includes('http.sslVerify=true'), true)
      assert.equal(args.includes('credential.helper='), false, '远端查询必须保留构建现有 Git 授权能力')
      assert.equal(JSON.stringify(args).includes(API_TOKEN), false, '不能把认证 URL 放到进程参数')
      if (errorAt === calls.length) throw Object.assign(new Error(`${API_TOKEN}: ${origin}`), { stderr: origin, stdout: API_TOKEN })
      if (args.includes('--get-url')) {
        assert.deepEqual(args.slice(-3), ['ls-remote', '--get-url', 'origin'])
        return { stdout: `${origin}\n` }
      }
      assert.deepEqual(args.slice(-5), ['ls-remote', '--quiet', '--exit-code', 'origin', 'refs/heads/main'])
      return { stdout: output }
    },
  }
}
const gitEnv = { WORKERS_CI: '1', GIT_ASKPASS: 'ephemeral-build-askpass', GIT_TRACE: 'must-not-write-trace', GIT_CURL_VERBOSE: '1' }

for (const origin of ['https://github.com/xuge1324652022-boop/job-application-template', `https://build-user:${API_TOKEN}@github.com/xuge1324652022-boop/job-application-template.git`]) {
  await test('Git 复用合法私有 origin 授权，只返回校验后的 SHA', async () => {
    const state = gitMock({ origin })
    const sha = await readRemoteSha(BASE, { ...state, env: gitEnv })
    assert.equal(sha, SHA)
    assert.equal(state.calls.length, 2)
    assert.equal(sha.includes(API_TOKEN), false)
  })
}

for (const origin of [
  'https://github.com/xuge1324652022-boop/-.git',
  'https://github.com/xuge1324652022-boop/-',
  'http://github.com/xuge1324652022-boop/job-application-template.git',
  'https://github.com.evil.example/xuge1324652022-boop/job-application-template.git',
  `https://build-user:${API_TOKEN}@evil.example/xuge1324652022-boop/job-application-template.git`,
  'https://github.com/other-user/-.git',
  'https://github.com/xuge1324652022-boop/other.git',
  'https://github.com:8443/xuge1324652022-boop/job-application-template.git',
  'https://github.com/xuge1324652022-boop/job-application-template.git?redirect=other',
  'https://github.com/xuge1324652022-boop/job-application-template.git#other',
  'git@github.com:xuge1324652022-boop/job-application-template.git',
  'https://github.com/xuge1324652022-boop/job-application-template.git\nhttps://evil.example/repo',
]) {
  await test('非允许的 origin 在连接前被拒绝，认证 URL 不进入错误信息', async () => {
    const state = gitMock({ origin })
    await assert.rejects(() => readRemoteSha(BASE, { ...state, env: gitEnv }), error => /origin/.test(error.message) && !error.message.includes(API_TOKEN) && !error.message.includes(origin))
    assert.equal(state.calls.length, 1)
  })
}

for (const output of ['', `${SHA}\trefs/heads/other\n`, `${SHA}\trefs/tags/main\n`, `${SHA}\trefs/heads/main\n${SHA}\trefs/heads/main\n`, `bad\trefs/heads/main\n`, `${API_TOKEN}\n`]) {
  await test('ls-remote 空值、多行、错误引用或无效 SHA 被拒绝', async () => {
    const state = gitMock({ output })
    await assert.rejects(() => readRemoteSha(BASE, { ...state, env: gitEnv }), error => /引用格式无效/.test(error.message) && !error.message.includes(API_TOKEN))
  })
}

for (const errorAt of [1, 2]) {
  await test('Git origin 解析或联网错误均不转发 stdout、stderr 或认证 URL', async () => {
    const state = gitMock({ origin: `https://user:${API_TOKEN}@github.com/xuge1324652022-boop/job-application-template.git`, errorAt })
    await assert.rejects(() => readRemoteSha(BASE, { ...state, env: gitEnv }), error => !error.message.includes(API_TOKEN) && !error.message.includes('https://'))
  })
}

process.stdout.write(`PASS: ${passed} 项 CI 发布 mock 回归；无网络、无真实部署。\n`)
