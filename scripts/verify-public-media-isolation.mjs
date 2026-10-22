/** 本地夹具验证旧手动发布入口不会选择私人原片；不读取认证或访问网络。 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepare, manifest } from './cloudflare-assets.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = join(root, 'tmp', 'public-media-isolation')
await mkdir(temporary, { recursive: true })
const work = await mkdtemp(join(temporary, 'case-'))
const videoPath = '/color/example.mp4'
const sampleVideo = Buffer.from('generated geometric sample video')
const sampleResume = Buffer.from('fictional blank resume template')
const privateVideo = Buffer.from('private fixture: must never be copied')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const assetHash = (bytes, filename) =>
  createHash('sha256')
    .update(bytes.toString('base64') + extname(filename).slice(1))
    .digest('hex')
    .slice(0, 32)
let fixtures = 0
let passed = 0

async function put(base, relativePath, bytes) {
  const target = join(base, ...relativePath.split('/'))
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, bytes)
}

async function json(base, filename, value) {
  await put(base, filename, JSON.stringify(value))
}

async function fixture({ builtVideo = false, publicVideo = true } = {}) {
  const project = join(work, String(++fixtures))
  await put(project, 'dist/index.html', '<!doctype html><title>Template fixture</title>')
  if (publicVideo) await put(project, 'public/color/example.mp4', sampleVideo)
  if (builtVideo) await put(project, 'dist/color/example.mp4', sampleVideo)
  await put(project, 'dist/resume.pdf', sampleResume)
  // 两处私人文件故意与公开 URL 同名，旧流程会把它们混入部署。
  await put(project, '作品/调色-成片/example.mp4', privateVideo)
  await put(project, 'media/color/example.mp4', privateVideo)
  await json(project, 'public/模板素材清单.json', {
    files: [
      { path: 'public/color/example.mp4', sha256: sha256(sampleVideo) },
      { path: 'public/resume.pdf', sha256: sha256(sampleResume) },
    ],
  })
  await json(project, '发布配置/公开第三方素材.json', { files: [] })
  await json(project, 'deploy/media-manifest.json', {
    [videoPath]: { hash: assetHash(sampleVideo, videoPath), size: sampleVideo.length },
  })
  return { project, output: join(project, 'prepared') }
}

async function check(title, task) {
  await task()
  passed++
  console.log(`PASS ${title}`)
}

try {
  await check('private files cannot override an approved public sample', async () => {
    const { project, output } = await fixture()
    await prepare(output, project)
    assert.deepEqual(await readFile(join(output, 'site/color/example.mp4')), sampleVideo)
    assert((await manifest(output, project)).manifest[videoPath])
  })
  await check('approved dist bytes work without a public or private fallback', async () => {
    const { project, output } = await fixture({ builtVideo: true, publicVideo: false })
    await prepare(output, project)
    assert.deepEqual(await readFile(join(output, 'site/color/example.mp4')), sampleVideo)
  })
  await check('a missing public sample never falls back to a private original', async () => {
    const { project, output } = await fixture({ publicVideo: false })
    await assert.rejects(prepare(output, project), /不是普通素材文件/u)
  })
  await check('private bytes already present in dist are rejected', async () => {
    const { project, output } = await fixture()
    await put(project, 'dist/color/example.mp4', privateVideo)
    await assert.rejects(prepare(output, project), /未审核|审核字节/u)
  })
  await check('replacing an approved public filename cannot bypass byte review', async () => {
    const { project, output } = await fixture()
    await put(project, 'public/color/example.mp4', privateVideo)
    await assert.rejects(prepare(output, project), /未审核|审核字节/u)
  })
  await check('Cloudflare media hashes are checked independently of SHA-256 approval', async () => {
    const { project, output } = await fixture()
    await json(project, 'deploy/media-manifest.json', {
      [videoPath]: { hash: '0'.repeat(32), size: sampleVideo.length },
    })
    await assert.rejects(prepare(output, project), /媒体清单不一致/u)
  })
  await check('an unregistered binary extension is rejected', async () => {
    const { project, output } = await fixture()
    await put(project, 'dist/unknown.bin', privateVideo)
    await assert.rejects(prepare(output, project), /未审核/u)
  })
  await check('a private resume cannot use the approved download URL', async () => {
    const { project, output } = await fixture()
    await put(project, 'dist/resume.pdf', privateVideo)
    await assert.rejects(prepare(output, project), /未审核|审核字节/u)
  })
  await check(
    'rewriting an old snapshot and its manifest cannot authorise private media',
    async () => {
      const { project, output } = await fixture()
      await prepare(output, project)
      await put(output, 'site/color/example.mp4', privateVideo)
      const values = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'))
      values[videoPath] = { hash: assetHash(privateVideo, videoPath), size: privateVideo.length }
      await json(output, 'manifest.json', values)
      await assert.rejects(manifest(output, project), /未审核|审核字节/u)
    },
  )
  await check('a media URL missing from the approved asset list is rejected', async () => {
    const { project, output } = await fixture()
    await json(project, 'deploy/media-manifest.json', {
      '/color/unreviewed.mp4': {
        hash: assetHash(sampleVideo, videoPath),
        size: sampleVideo.length,
      },
    })
    await assert.rejects(prepare(output, project), /已审核的 public\/color/u)
  })
  console.log(JSON.stringify({ passed: true, cases: passed, networkRequests: 0 }))
} finally {
  const difference = relative(temporary, work)
  assert(
    difference &&
      difference !== '..' &&
      !difference.startsWith(`..${sep}`) &&
      !isAbsolute(difference),
  )
  const stat = await lstat(work)
  assert(stat.isDirectory() && !stat.isSymbolicLink())
  // work 是本次 mkdtemp 返回的夹具目录；所有子项均由本脚本创建。
  await rm(work, { recursive: true })
}
