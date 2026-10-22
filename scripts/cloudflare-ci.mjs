/** Node 22+ 的独立 CI 发布入口；默认仅准备，显式 --deploy 才访问网络。 */
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import siteConfig from '../deploy/site-config.json' with { type: 'json' }

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const WORKER_NAME = 'job-application-template'
const mediaOriginUrl = new URL(process.env.SITE_ORIGIN || siteConfig.siteOrigin)
if (mediaOriginUrl.protocol !== 'https:' || mediaOriginUrl.username || mediaOriginUrl.password || mediaOriginUrl.pathname !== '/' || mediaOriginUrl.search || mediaOriginUrl.hash) throw new Error('媒体来源必须是无凭据的 HTTPS 站点 origin')
export const MEDIA_ORIGIN = mediaOriginUrl.origin
const API_ORIGIN = 'https://api.cloudflare.com/client/v4'
const execFileAsync = promisify(execFile)
const MAX_SIZE = 25 * 1024 * 1024
const EXCLUDED = new Set(['_headers', '_redirects', '404.html'])
const TEXT = new Set(['.html', '.js', '.mjs', '.cjs', '.css', '.svg', '.json', '.map', '.txt', '.xml', '.md', '.yaml', '.yml', '.toml', '.ini', '.conf'])
const SECRET = /(?:github_pat_[A-Za-z0-9_]{60,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-proj-[A-Za-z0-9_-]{60,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,})/
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }
const fail = message => { throw new Error(message) }
const same = (left, right) => Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([path, value]) => right[path]?.hash === value.hash && right[path]?.size === value.size)

// 与现有完整发布脚本及官方示例保持一致，不能改成原始二进制 MD5/SHA。
export const assetHash = (buffer, path) => createHash('sha256').update(buffer.toString('base64') + extname(path).slice(1)).digest('hex').slice(0, 32)

async function inspect(path) {
  try { return await lstat(path) } catch (error) { if (error.code === 'ENOENT') return null; throw new Error('无法检查发布文件', { cause: error }) }
}

async function noSymlinks(path) {
  for (let current = resolve(path); ; current = dirname(current)) {
    if ((await inspect(current))?.isSymbolicLink()) fail('拒绝符号链接或目录联接')
    if (dirname(current) === current) break
  }
}

function publicPath(path) {
  if (!path.startsWith('/') || /[\\\0?#]/.test(path) || path.slice(1).split('/').some(part => !part || part === '..' || part === '.' || part.startsWith('.') || /^(?:auth|credentials|secrets?|tokens?|service[-_]?account|id_rsa|id_ed25519|node_modules)(?:\..*)?$/i.test(part)) || /\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(path)) fail('拒绝无效、隐藏或凭据素材路径')
}

function manifestShape(value, mediaOnly = false) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('素材清单格式无效')
  const sizes = new Map()
  for (const [path, entry] of Object.entries(value)) {
    publicPath(path)
    if (EXCLUDED.has(basename(path)) || !entry || Object.keys(entry).sort().join(',') !== 'hash,size' || !/^[a-f0-9]{32}$/.test(entry.hash) || !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_SIZE) fail('素材清单条目无效')
    if (sizes.has(entry.hash) && sizes.get(entry.hash) !== entry.size) fail('相同素材 hash 的大小必须一致')
    sizes.set(entry.hash, entry.size)
  }
  if (mediaOnly && (!Object.keys(value).length || Object.entries(value).some(([path, entry]) => !/^\/color\/[^/]+\.mp4$/u.test(path) || entry.size === 0))) fail('媒体清单必须是非空的已登记调色 MP4 路径')
  return value
}

async function readSafe(path, publicName = '/source.txt') {
  publicPath(publicName)
  await noSymlinks(path)
  const stat = await inspect(path)
  if (!stat?.isFile() || stat.size > MAX_SIZE) fail('发布文件不存在、不是普通文件或超过 25 MiB')
  let buffer
  try { buffer = await readFile(path) } catch { fail('无法读取发布文件') }
  if (buffer.length > MAX_SIZE || (TEXT.has(extname(publicName).toLowerCase()) && SECRET.test(buffer.toString('utf8')))) fail('发布文件过大或包含疑似凭据')
  return buffer
}

async function readJson(path) {
  const buffer = await readSafe(path, '/manifest.json')
  try { return JSON.parse(buffer.toString('utf8')) } catch { fail('无法读取有效的发布 JSON') }
}

async function list(root) {
  await noSymlinks(root)
  if (!(await inspect(root))?.isDirectory()) fail('发布素材目录不存在')
  const files = []
  async function visit(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = join(directory, name)
      const path = `/${relative(root, absolute).split(sep).join('/')}`
      publicPath(path)
      const stat = await inspect(absolute)
      if (!stat || stat.isSymbolicLink()) fail('拒绝消失的文件、符号链接或目录联接')
      if (stat.isDirectory()) await visit(absolute)
      else if (!stat.isFile()) fail('拒绝特殊文件')
      else if (!EXCLUDED.has(name)) files.push({ path, absolute })
    }
  }
  await visit(root)
  return files
}

function outputLocation(projectRoot, outputRoot) {
  const base = join(projectRoot, 'tmp', 'cloudflare-ci')
  const difference = relative(base, outputRoot)
  if (difference === '..' || difference.startsWith(`..${sep}`) || isAbsolute(difference)) fail('CI 输出必须位于项目 tmp/cloudflare-ci 内')
}

async function projectSettings(projectRoot) {
  const config = await readJson(join(projectRoot, 'deploy', 'cloudflare-assets.json'))
  if (config.name !== WORKER_NAME || config.main_module !== 'media-range.mjs' || !config.assets?.config || !Array.isArray(config.bindings) || config.bindings.filter(binding => binding.name === 'ASSETS' && binding.type === 'assets').length !== 1 || config.assets.jwt) fail('部署配置不属于既有站点或缺少 ASSETS 配置')
  const module = await readSafe(join(projectRoot, 'deploy', 'media-range.mjs'), '/media-range.mjs')
  const mediaManifest = manifestShape(await readJson(join(projectRoot, 'deploy', 'media-manifest.json')), true)
  return { config, module, mediaManifest }
}

/** 只读取源码配置及 dist；不会读取凭据、本地完整视频或访问网络。 */
export async function prepare({ projectRoot = PROJECT_ROOT, outputRoot } = {}) {
  projectRoot = resolve(projectRoot)
  outputRoot = resolve(outputRoot || join(projectRoot, 'tmp', 'cloudflare-ci', randomUUID()))
  outputLocation(projectRoot, outputRoot)
  await noSymlinks(outputRoot)
  if (await inspect(outputRoot)) fail('拒绝覆盖已有的 CI 准备目录')
  const { mediaManifest } = await projectSettings(projectRoot)
  const files = await list(join(projectRoot, 'dist'))
  if (!files.some(file => file.path === '/index.html')) fail('dist 缺少 index.html，请先运行构建')
  const localManifest = {}
  // 先完整检查源文件；随后只把检查过的字节写入隔离快照。
  for (const file of files) {
    const buffer = await readSafe(file.absolute, file.path)
    localManifest[file.path] = { hash: assetHash(buffer, file.path), size: buffer.length }
    if (Object.hasOwn(mediaManifest, file.path) && !same({ [file.path]: localManifest[file.path] }, { [file.path]: mediaManifest[file.path] })) fail('dist 不能覆盖已登记的完整调色视频：字节必须与清单一致')
  }
  await mkdir(outputRoot, { recursive: true })
  const site = join(outputRoot, 'site')
  for (const file of files) {
    const buffer = await readSafe(file.absolute, file.path)
    if (buffer.length !== localManifest[file.path].size || assetHash(buffer, file.path) !== localManifest[file.path].hash) fail('准备期间 dist 发生变化')
    const target = join(site, file.path.slice(1))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, buffer, { flag: 'wx' })
  }
  const manifest = { ...localManifest, ...mediaManifest }
  await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  return validate({ projectRoot, outputRoot })
}

/** 重新校验快照和 committed 媒体引用；只允许按受版本控制的清单补齐缺失媒体。 */
export async function validate({ projectRoot = PROJECT_ROOT, outputRoot }) {
  projectRoot = resolve(projectRoot)
  outputRoot = resolve(outputRoot)
  outputLocation(projectRoot, outputRoot)
  const settings = await projectSettings(projectRoot)
  const manifest = manifestShape(await readJson(join(outputRoot, 'manifest.json')))
  const files = await list(join(outputRoot, 'site'))
  const localManifest = {}
  for (const file of files) {
    const buffer = await readSafe(file.absolute, file.path)
    localManifest[file.path] = { hash: assetHash(buffer, file.path), size: buffer.length }
    if (Object.hasOwn(settings.mediaManifest, file.path) && !same({ [file.path]: localManifest[file.path] }, { [file.path]: settings.mediaManifest[file.path] })) fail('本地快照不能覆盖 committed 媒体引用：字节必须与清单一致')
  }
  if (!localManifest['/index.html'] || !same(manifest, { ...localManifest, ...settings.mediaManifest })) fail('CI 快照或媒体引用与完整清单不一致')
  return { projectRoot, outputRoot, site: join(outputRoot, 'site'), manifestPath: join(outputRoot, 'manifest.json'), manifest, localManifest, files, ...settings }
}

async function limitedBody(response, maximum) {
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  let size = 0
  const chunks = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maximum) fail('响应体超过允许大小')
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, size)
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}

async function request(fetchImpl, url, options) {
  try { return await fetchImpl(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(60_000) }) }
  catch { fail('网络请求失败或超时') }
}

async function apiJson(response, statuses) {
  if (!statuses.includes(response.status)) {
    await response.body?.cancel().catch(() => {})
    fail(`Cloudflare API 返回 HTTP ${response.status}`)
  }
  let payload
  try { payload = JSON.parse((await limitedBody(response, 2 * 1024 * 1024)).toString('utf8')) }
  catch { fail('Cloudflare API 响应不是有效的受限 JSON') }
  if (payload.success !== true || !payload.result || typeof payload.result !== 'object') fail('Cloudflare API 未确认成功')
  return payload.result
}

function account(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{32}$/i.test(value)) fail('缺少有效的 CLOUDFLARE_ACCOUNT_ID')
  return value
}

async function checkoutSha(projectRoot) {
  let stdout
  try {
    // 只读解析当前 checkout；不运行 shell、fetch、credential helper 或本机授权流程。
    const result = await execFileAsync('git', ['--no-optional-locks', '-c', 'credential.helper=', '-c', 'core.fsmonitor=false', 'rev-parse', '--verify', 'HEAD^{commit}'], { cwd: projectRoot, timeout: 10_000, maxBuffer: 1024, windowsHide: true })
    stdout = result.stdout
  } catch { fail('无法只读确认本地 Git 提交，禁止部署') }
  const sha = stdout.trim()
  if (!/^[a-f0-9]{40}$/.test(sha)) fail('本地 Git 提交 SHA 格式无效')
  return sha
}

/** 复用隔离构建 checkout 的 Git 授权；不提取、打印或另找任何 token。 */
export async function readRemoteSha(projectRoot, { execFileImpl = execFileAsync, env = process.env } = {}) {
  const gitEnv = { ...env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }
  // trace 可能带认证 URL 或请求头；捕获 stderr 并同时关闭继承的 trace 输出。
  for (const key of Object.keys(gitEnv)) if (key.toUpperCase().startsWith('GIT_TRACE') || key.toUpperCase() === 'GIT_CURL_VERBOSE') delete gitEnv[key]
  const options = { cwd: resolve(projectRoot), timeout: 30_000, maxBuffer: 8192, windowsHide: true, env: gitEnv, shell: false }
  const prefix = ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'http.followRedirects=false', '-c', 'http.sslVerify=true', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always']
  let origin
  try {
    // --get-url 展开 insteadOf，但不连接远端；认证 userinfo 只留在本函数内存中。
    const result = await execFileImpl('git', [...prefix, 'ls-remote', '--get-url', 'origin'], options)
    const raw = result.stdout.trim()
    if (!raw || /[\r\n\t\0]/.test(raw)) fail('invalid origin')
    origin = new URL(raw)
  } catch { fail('无法安全确认 origin 仓库，禁止部署') }
  if (origin.protocol !== 'https:' || origin.hostname !== 'github.com' || origin.port || origin.search || origin.hash || !['/xuge1324652022-boop/job-application-template', '/xuge1324652022-boop/job-application-template.git'].includes(origin.pathname)) fail('origin 不是允许的 GitHub 仓库，禁止部署')
  let stdout
  try {
    // 使用远端名，不把认证 URL 放入进程参数；stderr 永远不转发给日志。
    const result = await execFileImpl('git', [...prefix, 'ls-remote', '--quiet', '--exit-code', 'origin', 'refs/heads/main'], options)
    stdout = result.stdout
  } catch { fail('构建 Git 无法查询 origin/main，禁止部署') }
  const match = /^([a-f0-9]{40})\trefs\/heads\/main\r?\n?$/.exec(stdout)
  if (!match) fail('origin/main 返回的提交引用格式无效，禁止部署')
  return match[1]
}

/**
 * 发布前的新鲜度检查，不是跨构建锁；生产发布仍须使用单一串行入口。
 * https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#default-variables
 * https://git-scm.com/docs/git-ls-remote
 */
export async function assertCurrentRevision({ projectRoot = PROJECT_ROOT, env = process.env, checkoutShaImpl = checkoutSha, remoteShaImpl = readRemoteSha, expectedSha } = {}) {
  const sha = env.WORKERS_CI_COMMIT_SHA
  if (env.WORKERS_CI !== '1' || env.WORKERS_CI_BRANCH !== 'main' || typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) fail('部署只允许具有完整提交 SHA 的 Workers Builds main 构建')
  if (expectedSha && expectedSha !== sha) fail('构建 SHA 上下文发生变化，禁止部署')
  let localSha
  try { localSha = await checkoutShaImpl(resolve(projectRoot)) } catch { fail('无法只读确认本地 Git 提交，禁止部署') }
  if (localSha !== sha) fail('本地 Git 提交与构建 SHA 不符，禁止部署')
  let remoteSha
  try { remoteSha = await remoteShaImpl(resolve(projectRoot), { env }) }
  catch { fail('无法通过构建 Git 确认 origin/main，禁止部署') }
  if (typeof remoteSha !== 'string' || !/^[a-f0-9]{40}$/.test(remoteSha)) fail('origin/main 引用格式无效，禁止部署')
  if (remoteSha !== sha) fail('该构建已落后于 origin/main，禁止部署')
  return sha
}

function checkSession(session, manifest) {
  if (!session || typeof session.jwt !== 'string' || !session.jwt || !Array.isArray(session.buckets)) fail('素材上传会话格式无效')
  const known = new Set(Object.values(manifest).map(entry => entry.hash))
  const seen = new Set()
  for (const bucket of session.buckets) {
    if (!Array.isArray(bucket) || !bucket.length) fail('素材上传分组格式无效')
    for (const hash of bucket) {
      if (typeof hash !== 'string' || !/^[a-f0-9]{32}$/.test(hash) || !known.has(hash) || seen.has(hash)) fail('素材上传分组包含未知或重复 hash')
      seen.add(hash)
    }
  }
}

async function recoverMedia(path, entry, prepared, fetchImpl) {
  if (!Object.hasOwn(prepared.mediaManifest, path)) fail('拒绝下载未登记的媒体路径')
  const url = `${MEDIA_ORIGIN}${path.split('/').map(encodeURIComponent).join('/')}`
  const response = await request(fetchImpl, url, { method: 'GET', headers: { 'Accept-Encoding': 'identity' } })
  // 不跟随任何跳转，也不会把 API Authorization 带到公开素材域名。
  if (response.status !== 200 || (response.url && response.url !== url) || (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'video/mp4' || (response.headers.get('content-encoding') && response.headers.get('content-encoding') !== 'identity') || (response.headers.has('content-length') && response.headers.get('content-length') !== String(entry.size))) {
    await response.body?.cancel().catch(() => {})
    fail('既有媒体地址发生跳转、不可用或响应元数据不符')
  }
  const buffer = await limitedBody(response, entry.size)
  if (buffer.length !== entry.size || assetHash(buffer, path) !== entry.hash) fail('下载媒体的大小或 hash 与 committed 清单不符')
  const absolute = join(prepared.outputRoot, 'downloads', basename(path))
  await noSymlinks(absolute)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, buffer, { flag: 'wx' })
  return { path, absolute }
}

/** 只上传服务端 buckets；所有被要求补传的媒体先全部下载并通过校验。 */
export async function uploader(input, session, { accountId, fetchImpl = fetch, delay = ms => new Promise(resolve => setTimeout(resolve, ms)), progress = () => {} } = {}) {
  accountId = account(accountId)
  const prepared = await validate(input)
  checkSession(session, prepared.manifest) // 在任何素材 GET/POST 前检查所有 buckets。
  const byHash = new Map(prepared.files.map(file => [prepared.manifest[file.path].hash, file]))
  const requested = new Set(session.buckets.flat())
  let downloadedMedia = 0
  for (const [path, entry] of Object.entries(prepared.mediaManifest)) {
    if (requested.has(entry.hash) && !byHash.has(entry.hash)) {
      byHash.set(entry.hash, await recoverMedia(path, entry, prepared, fetchImpl))
      downloadedMedia++
    }
  }
  // 此处是下载阶段与上传阶段的边界；任何媒体失败都不允许上传或部署。
  for (const hash of requested) if (!byHash.has(hash)) fail('缺少服务端要求补传的素材')
  let jwt = session.buckets.length ? null : session.jwt
  let uploadedFiles = 0
  for (const [index, bucket] of session.buckets.entries()) {
    const fields = []
    for (const hash of bucket) {
      const file = byHash.get(hash)
      const buffer = await readSafe(file.absolute, file.path)
      if (buffer.length !== prepared.manifest[file.path].size || assetHash(buffer, file.path) !== hash) fail('上传前素材发生变化')
      fields.push({ hash, name: basename(file.path), base64: buffer.toString('base64'), type: TYPES[extname(file.path).toLowerCase()] || 'application/octet-stream' })
    }
    progress(`上传素材分组 ${index + 1}/${session.buckets.length}（${fields.length} 个文件）`)
    for (let attempt = 0; ; attempt++) {
      const form = new FormData()
      for (const field of fields) form.append(field.hash, new File([field.base64], field.name, { type: field.type }))
      let response
      try { response = await request(fetchImpl, `${API_ORIGIN}/accounts/${accountId}/workers/assets/upload?base64=true`, { method: 'POST', headers: { Authorization: `Bearer ${session.jwt}` }, body: form }) }
      catch { if (attempt >= 3) fail('素材上传网络失败，重试次数已用尽') }
      if (!response || response.status === 429 || response.status >= 500 && response.status < 600) {
        await response?.body?.cancel().catch(() => {})
        if (attempt >= 3) fail('素材上传重试次数已用尽')
        await delay(Math.min(1000 * 2 ** attempt, 5000))
        continue
      }
      const result = await apiJson(response, [200, 201, 202])
      if (response.status === 201) {
        if (typeof result.jwt !== 'string' || !result.jwt) fail('201 完成响应缺少 completion JWT')
        jwt = result.jwt
      }
      uploadedFiles += fields.length
      break
    }
  }
  if (!jwt) fail('未收到 201 completion JWT，禁止部署')
  return { jwt, uploadedFiles, downloadedMedia }
}

/** 凭据仅取自调用方 env 的两个明确字段；不加载 dotenv 或本机账号配置。 */
export async function deploy({ projectRoot = PROJECT_ROOT, outputRoot, fetchImpl = fetch, env = process.env, progress = () => {}, delay, checkoutShaImpl = checkoutSha, remoteShaImpl = readRemoteSha } = {}) {
  const accountId = account(env.CLOUDFLARE_ACCOUNT_ID)
  const token = env.CLOUDFLARE_API_TOKEN
  if (typeof token !== 'string' || !token || /\s/.test(token)) fail('缺少有效的 CLOUDFLARE_API_TOKEN')
  const commitSha = await assertCurrentRevision({ projectRoot, env, checkoutShaImpl, remoteShaImpl })
  const prepared = await prepare({ projectRoot, outputRoot })
  const scriptUrl = `${API_ORIGIN}/accounts/${accountId}/workers/scripts/${WORKER_NAME}`
  const session = await apiJson(await request(fetchImpl, `${scriptUrl}/assets-upload-session`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest: prepared.manifest }) }), [200])
  const uploaded = await uploader(prepared, session, { accountId, fetchImpl, progress, delay })
  const metadata = structuredClone(prepared.config)
  delete metadata.name
  metadata.assets.jwt = uploaded.jwt
  const mediaSizes = Object.fromEntries(Object.entries(prepared.manifest).filter(([path]) => /\.(?:mp4|pdf)$/i.test(path)).map(([path, entry]) => [path, entry.size]))
  metadata.bindings = metadata.bindings.filter(binding => binding.name !== 'MEDIA_SIZES')
  metadata.bindings.push({ type: 'plain_text', name: 'MEDIA_SIZES', text: JSON.stringify(mediaSizes) })
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append(metadata.main_module, new File([prepared.module], metadata.main_module, { type: 'application/javascript+module' }))
  // 尽可能靠近最终写请求再次检查；检查与 PUT 不是原子事务，不能冒充互斥。
  await assertCurrentRevision({ projectRoot, env, checkoutShaImpl, remoteShaImpl, expectedSha: commitSha })
  const result = await apiJson(await request(fetchImpl, scriptUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form }), [200])
  const deploymentId = /^[a-f0-9-]{32,36}$/i.test(result.deployment_id || '') ? result.deployment_id : undefined
  return { ...summary(prepared), deployed: true, commitSha, uploadedFiles: uploaded.uploadedFiles, downloadedMedia: uploaded.downloadedMedia, ...(deploymentId ? { deploymentId } : {}) }
}

function summary(prepared) {
  return { worker: WORKER_NAME, origin: MEDIA_ORIGIN, outputRoot: prepared.outputRoot, manifestPath: prepared.manifestPath, files: Object.keys(prepared.manifest).length, localFiles: prepared.files.length, mediaReferences: Object.keys(prepared.mediaManifest).length, totalBytes: Object.values(prepared.manifest).reduce((sum, entry) => sum + entry.size, 0) }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length > 1 || args.length && !['--deploy', '--prepare', '--dry-run'].includes(args[0])) fail('用法：node scripts/cloudflare-ci.mjs [--dry-run|--prepare|--deploy]')
  if (args[0] === '--deploy' && /(?:^|\.)example\.com$/u.test(new URL(MEDIA_ORIGIN).hostname)) fail('公开模板尚未配置部署域名，禁止向默认示例配置上传')
  const result = args[0] === '--deploy'
    ? await deploy({ progress: message => process.stderr.write(`${message}\n`) })
    : { ...summary(await prepare()), deployed: false }
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
}
