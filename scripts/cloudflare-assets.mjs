/** 本地发布素材助手；仅 upload 命令会访问 Cloudflare，凭据只在内存中使用。 */
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MAX_SIZE = 25 * 1024 * 1024
const EXCLUDED = new Set(['_headers', '_redirects', '404.html'])
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.cjs', '.css', '.svg', '.json', '.txt', '.xml', '.md', '.yaml', '.yml', '.toml', '.ini', '.conf'])
const SECRET_PATTERN = /(?:github_pat_[A-Za-z0-9_]{60,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-proj-[A-Za-z0-9_-]{60,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,})/
const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

async function inspect(path) {
  try { return await lstat(path, { bigint: true }) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function rejectSymlinkAncestors(path) {
  for (let current = resolve(path); ; current = dirname(current)) {
    if ((await inspect(current))?.isSymbolicLink()) throw new Error(`不允许符号链接或目录联接：${current}`)
    if (dirname(current) === current) break
  }
}

function validatePublicPath(path) {
  if (!path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').slice(1).some(part => !part || part === '..' || part === '.')) {
    throw new Error('清单包含无效公开路径')
  }
  for (const part of path.slice(1).split('/')) {
    if (part.startsWith('.') || /^(?:auth|credentials|secrets?|service[-_]?account)(?:\..*)?$/i.test(part) || /^(?:id_rsa|id_ed25519|node_modules)$/i.test(part)) {
      throw new Error(`不允许公开隐藏路径或凭据：${path}`)
    }
  }
  if (/\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(path)) throw new Error(`不允许公开密钥文件：${path}`)
}

async function listFiles(root) {
  await rejectSymlinkAncestors(root)
  if (!(await inspect(root))?.isDirectory()) throw new Error(`素材目录不存在：${root}`)
  const files = []
  const excluded = []
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const absolute = join(directory, entry.name)
      const path = `/${relative(root, absolute).split(sep).join('/')}`
      validatePublicPath(path)
      const stat = await inspect(absolute)
      if (!stat || stat.isSymbolicLink()) throw new Error(`素材消失或包含符号链接：${path}`)
      if (stat.isDirectory()) await visit(absolute)
      else if (!stat.isFile()) throw new Error(`不支持特殊文件：${path}`)
      else if (EXCLUDED.has(entry.name)) excluded.push(path)
      else files.push({ path, absolute })
    }
  }
  await visit(root)
  return { files, excluded }
}

function assetHash(buffer, path) {
  // 与官方示例一致：哈希输入是 base64 文本加无点扩展名，不是原始二进制。
  return createHash('sha256').update(buffer.toString('base64') + extname(path).slice(1)).digest('hex').slice(0, 32)
}

async function readAsset(file) {
  validatePublicPath(file.path)
  await rejectSymlinkAncestors(file.absolute)
  const stat = await inspect(file.absolute)
  if (!stat?.isFile()) throw new Error(`不是普通素材文件：${file.path}`)
  if (stat.size > BigInt(MAX_SIZE)) throw new Error(`文件超过 25 MiB：${file.path}`)
  const buffer = await readFile(file.absolute)
  if (buffer.length > MAX_SIZE) throw new Error(`读取期间文件超过 25 MiB：${file.path}`)
  if (TEXT_EXTENSIONS.has(extname(file.path).toLowerCase()) && SECRET_PATTERN.test(buffer.toString('utf8'))) {
    throw new Error(`发现疑似凭据内容，停止发布：${file.path}`)
  }
  return buffer
}

async function createManifest(files) {
  const manifest = {}
  for (const file of files) {
    const buffer = await readAsset(file)
    manifest[file.path] = { hash: assetHash(buffer, file.path), size: buffer.length }
  }
  return manifest
}

async function publicApproval(projectRoot) {
  const readJson = async relativePath => {
    const absolute = join(projectRoot, ...relativePath.split('/'))
    await rejectSymlinkAncestors(absolute)
    if (!(await inspect(absolute))?.isFile()) throw new Error('缺少公开素材审核配置')
    return JSON.parse(await readFile(absolute, 'utf8'))
  }
  const generated = await readJson('public/模板素材清单.json')
  const thirdParty = await readJson('发布配置/公开第三方素材.json')
  const media = await readJson('deploy/media-manifest.json')
  const rows = [...(Array.isArray(generated) ? generated : generated.files ?? []), ...(thirdParty.files ?? [])]
  const approved = new Map()
  for (const row of rows) {
    if (typeof row.path !== 'string' || !/^(?:public\/|src\/assets\/color-frames\/)/u.test(row.path) || row.path.split(/[\\/]/u).some(part => !part || part === '.' || part === '..') || !/^[a-f0-9]{64}$/u.test(row.sha256) || approved.has(row.path)) throw new Error('公开素材审核清单无效')
    approved.set(row.path, row.sha256)
  }
  if (!approved.size || !media || Array.isArray(media) || typeof media !== 'object' || !Object.keys(media).length) throw new Error('公开素材审核清单或媒体清单为空')
  for (const [mediaPath, value] of Object.entries(media)) {
    validatePublicPath(mediaPath)
    if (!/^\/color\/[^/]+\.mp4$/u.test(mediaPath) || !value || !/^[a-f0-9]{32}$/u.test(value.hash) || !Number.isSafeInteger(value.size) || value.size <= 0 || value.size > MAX_SIZE || !approved.has(`public${mediaPath}`)) throw new Error('媒体清单必须对应已审核的 public/color 示例')
  }
  return { approved, approvedHashes: new Set(approved.values()), media }
}

function verifyPublicBytes(file, buffer, approval) {
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  if (!TEXT_EXTENSIONS.has(extname(file.path).toLowerCase()) && !approval.approvedHashes.has(sha256)) throw new Error(`拒绝未审核的公开二进制：${file.path}`)
  const expectedSha = approval.approved.get(`public${file.path}`)
  if (expectedSha && sha256 !== expectedSha) throw new Error(`公开素材与审核字节不一致：${file.path}`)
  const expectedMedia = approval.media[file.path]
  if (expectedMedia && (buffer.length !== expectedMedia.size || assetHash(buffer, file.path) !== expectedMedia.hash)) throw new Error(`公开视频与媒体清单不一致：${file.path}`)
}

export async function prepare(outputRoot, projectRoot = PROJECT_ROOT) {
  outputRoot = resolve(outputRoot)
  await rejectSymlinkAncestors(outputRoot)
  if (await inspect(outputRoot)) throw new Error(`拒绝覆盖已有发布目录：${outputRoot}`)
  const { files, excluded } = await listFiles(join(projectRoot, 'dist'))
  const inputs = new Map(files.map(file => [file.path, file]))
  const approval = await publicApproval(projectRoot)
  // 只读取审核过的构建文件或 public 示例，不探测任何本机原件目录。
  for (const mediaPath of Object.keys(approval.media)) {
    if (!inputs.has(mediaPath)) inputs.set(mediaPath, { path: mediaPath, absolute: join(projectRoot, 'public', mediaPath.slice(1)) })
  }
  // 捕获已经审核的字节，防止复制期间源文件变化而绕过审核。
  const snapshots = new Map()
  for (const file of inputs.values()) {
    const buffer = await readAsset(file)
    verifyPublicBytes(file, buffer, approval)
    snapshots.set(file.path, buffer)
  }
  await mkdir(dirname(outputRoot), { recursive: true })
  await mkdir(outputRoot)
  const site = join(outputRoot, 'site')
  await mkdir(site)
  for (const file of inputs.values()) {
    const target = join(site, file.path.slice(1))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, snapshots.get(file.path), { flag: 'wx' })
  }
  const outputFiles = (await listFiles(site)).files
  const manifest = await createManifest(outputFiles)
  const manifestPath = join(outputRoot, 'manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  const entries = Object.entries(manifest)
  const [largestPath, largest] = entries.reduce((a, b) => b[1].size > a[1].size ? b : a)
  return { outputRoot, site, manifestPath, files: entries.length, totalBytes: entries.reduce((sum, [, value]) => sum + value.size, 0), largestFile: { path: largestPath, size: largest.size }, excludedFiles: excluded }
}

async function readPrepared(outputRoot, projectRoot = PROJECT_ROOT) {
  outputRoot = resolve(outputRoot)
  const manifestPath = join(outputRoot, 'manifest.json')
  await rejectSymlinkAncestors(manifestPath)
  let manifest
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) }
  catch { throw new Error('无法读取有效的本地素材清单') }
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') throw new Error('素材清单格式无效')
  for (const [path, value] of Object.entries(manifest)) {
    validatePublicPath(path)
    if (EXCLUDED.has(basename(path)) || !value || !/^[a-f0-9]{32}$/.test(value.hash) || !Number.isSafeInteger(value.size) || value.size < 0 || value.size > MAX_SIZE) {
      throw new Error(`素材清单条目无效：${path}`)
    }
  }
  const { files } = await listFiles(join(outputRoot, 'site'))
  const approval = await publicApproval(projectRoot)
  for (const file of files) verifyPublicBytes(file, await readAsset(file), approval)
  for (const mediaPath of Object.keys(approval.media)) if (!Object.hasOwn(manifest, mediaPath)) throw new Error('准备目录缺少已审核的完整媒体条目')
  const actual = await createManifest(files)
  if (Object.keys(actual).length !== Object.keys(manifest).length || Object.entries(actual).some(([path, value]) => manifest[path]?.hash !== value.hash || manifest[path]?.size !== value.size)) {
    throw new Error('本地素材与清单不一致，请在新目录重新 prepare')
  }
  return { manifest, files }
}

export async function manifest(outputRoot, projectRoot = PROJECT_ROOT) {
  return { manifest: (await readPrepared(outputRoot, projectRoot)).manifest }
}

export async function upload(outputRoot, { projectRoot = PROJECT_ROOT, fetchImpl = fetch, delay = ms => new Promise(resolve => setTimeout(resolve, ms)), progress = message => process.stderr.write(`${message}\n`) } = {}) {
  let session
  try {
    const sessionText = process.env.CF_ASSET_UPLOAD_SESSION
    delete process.env.CF_ASSET_UPLOAD_SESSION
    session = JSON.parse(sessionText)
  }
  catch { throw new Error('缺少有效的临时上传会话环境变量') }
  if (!session || !/^[a-f0-9]{32}$/i.test(session.accountId) || typeof session.jwt !== 'string' || !session.jwt || !Array.isArray(session.buckets) || session.buckets.some(bucket => !Array.isArray(bucket) || bucket.some(hash => typeof hash !== 'string' || !/^[a-f0-9]{32}$/.test(hash)))) {
    throw new Error('临时上传会话格式无效')
  }
  const { manifest: values, files } = await readPrepared(outputRoot, projectRoot)
  const approval = await publicApproval(projectRoot)
  const byHash = new Map(files.map(file => [values[file.path].hash, file]))
  for (const bucket of session.buckets) for (const hash of bucket) if (!byHash.has(hash)) throw new Error('上传分组引用了清单以外的素材')
  const url = `https://api.cloudflare.com/client/v4/accounts/${session.accountId}/workers/assets/upload?base64=true`
  let jwt = session.buckets.length ? null : session.jwt
  let uploadedFiles = 0
  for (let index = 0; index < session.buckets.length; index++) {
    const bucket = session.buckets[index]
    const fields = []
    for (const hash of bucket) {
      const file = byHash.get(hash)
      const buffer = await readAsset(file)
      verifyPublicBytes(file, buffer, approval)
      if (assetHash(buffer, file.path) !== hash) throw new Error(`上传前素材发生变化：${file.path}`)
      fields.push({ hash, name: basename(file.path), base64: buffer.toString('base64'), type: MIME_TYPES[extname(file.path).toLowerCase()] || 'application/octet-stream' })
    }
    progress(`上传素材分组 ${index + 1}/${session.buckets.length}（${fields.length} 个文件）`)
    for (let attempt = 0; ; attempt++) {
      // 分组完全使用服务端提供的 buckets；重试时重建 FormData，不复用请求流。
      const form = new FormData()
      for (const field of fields) form.append(field.hash, new File([field.base64], field.name, { type: field.type }))
      let response
      try {
        response = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${session.jwt}` }, body: form, signal: AbortSignal.timeout(60_000) })
      } catch {
        if (attempt >= 3) throw new Error('素材上传网络失败或超时，已达到重试上限')
        progress(`请求失败，准备第 ${attempt + 1} 次重试`)
        await delay(Math.min(1000 * 2 ** attempt, 5000))
        continue
      }
      if (response.status === 429 || response.status >= 500 && response.status < 600) {
        await response.body?.cancel()
        if (attempt >= 3) throw new Error(`素材上传 HTTP ${response.status}，已达到重试上限`)
        progress(`HTTP ${response.status}，准备第 ${attempt + 1} 次重试`)
        await delay(Math.min(1000 * 2 ** attempt, 5000))
        continue
      }
      if (![200, 201, 202].includes(response.status)) {
        await response.body?.cancel()
        throw new Error(`素材上传失败：HTTP ${response.status}`)
      }
      let payload
      try { payload = await response.json() }
      catch { throw new Error('素材上传响应不是有效 JSON') }
      if (payload.success === false) throw new Error('Cloudflare 未确认素材上传成功')
      // 只保留 201 返回的最终凭据，后续普通响应不会覆盖它。
      if (response.status === 201) {
        if (typeof payload.result?.jwt !== 'string' || !payload.result.jwt) throw new Error('素材上传完成响应缺少最终凭据')
        jwt = payload.result.jwt
      }
      uploadedFiles += fields.length
      break
    }
  }
  if (!jwt) throw new Error('所有分组已处理，但未收到 201 最终上传凭据')
  return { jwt, uploadedFiles }
}

async function main() {
  const [command, outputRoot, ...extra] = process.argv.slice(2)
  if (!outputRoot || extra.length || !['prepare', 'manifest', 'upload'].includes(command)) {
    throw new Error('用法：node scripts/cloudflare-assets.mjs <prepare|manifest|upload> <outputRoot>')
  }
  const result = await ({ prepare, manifest, upload })[command](outputRoot)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
}
