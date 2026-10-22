/**
 * Prepare an npm source/data package without publishing or running npm.
 * Only an explicit file allowlist is copied, byte for byte, into repository tmp/.
 * Repeated preparation refuses unknown files and never recursively deletes.
 */
import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const normalize = value => value.split(path.sep).join('/')
const digest = value => createHash('sha256').update(value).digest('hex')
const readJSON = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''))
const normalizedText = file => Buffer.from(readFileSync(file, 'utf8').replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n'))
const expectedFiles = ['动效组件库/', 'LICENSE', 'NOTICE.md', 'docs/AI工具图标来源.md', 'README.md']
const packageConfig = readJSON(path.join(root, '发布配置/源码资料包/包配置.json'))
const allowedKeys = new Set(['name', 'version', 'description', 'license', 'repository', 'homepage', 'bugs', 'keywords', 'files', 'publishConfig'])
if (Object.keys(packageConfig).some(key => !allowedKeys.has(key))) throw new Error('包配置含白名单以外的字段')
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u
const versionParts = typeof packageConfig.version === 'string' && packageConfig.version.match(versionPattern)
if (packageConfig.name !== '@xuge1324652022-boop/animation-source-package' || !versionParts || versionParts[4]?.split('.').some(part => /^\d+$/u.test(part) && part.length > 1 && part.startsWith('0'))) throw new Error('包名不正确或版本不是合法 SemVer')
if (packageConfig.repository?.type !== 'git' || packageConfig.repository?.url !== 'https://github.com/xuge1324652022-boop/job-application-template.git') throw new Error('包关联仓库不正确')
if (JSON.stringify(packageConfig.files) !== JSON.stringify(expectedFiles)) throw new Error('npm files 必须与源码资料包白名单完全一致')
if (JSON.stringify(packageConfig.publishConfig) !== JSON.stringify({ registry: 'https://npm.pkg.github.com' })) throw new Error('只允许发布到 GitHub Packages')

function safeRelative(relative) {
  if (typeof relative !== 'string' || !relative || /[\\<>:"|?*]/u.test(relative) || [...relative].some(character => character.codePointAt(0) < 0x20 || character.codePointAt(0) === 0x7f) || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`不安全的相对路径：${relative}`)
  }
  return relative
}

function inside(base, relative) {
  const absolute = path.resolve(base, safeRelative(relative))
  if (!absolute.startsWith(`${base}${path.sep}`)) throw new Error(`路径越界：${relative}`)
  return absolute
}

function statIfPresent(absolute) {
  try { return lstatSync(absolute) } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function checkedPath(base, relative, kind = 'file') {
  const parts = safeRelative(relative).split('/')
  let current = base
  const baseStat = lstatSync(base)
  if (!baseStat.isDirectory() || baseStat.isSymbolicLink()) throw new Error(`不安全的根目录：${base}`)
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index])
    const stat = lstatSync(current)
    const directory = index < parts.length - 1 || kind === 'directory'
    if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error(`拒绝符号链接或非正常文件：${current}`)
  }
  return current
}

function walk(base, relative = '') {
  const absolute = relative ? checkedPath(base, relative, 'directory') : base
  const files = []
  const directories = []
  for (const entry of readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = relative ? `${relative}/${entry.name}` : entry.name
    safeRelative(name)
    const stat = lstatSync(inside(base, name))
    if (stat.isSymbolicLink()) throw new Error(`拒绝符号链接：${name}`)
    if (stat.isDirectory()) {
      directories.push(name)
      const nested = walk(base, name)
      files.push(...nested.files)
      directories.push(...nested.directories)
    } else if (stat.isFile()) files.push(name)
    else throw new Error(`拒绝非正常文件：${name}`)
  }
  return { files, directories }
}

const options = process.argv.slice(2)
const parameters = new Map()
for (let index = 0; index < options.length; index += 2) {
  if (!['--output', '--verify-tarball'].includes(options[index]) || !options[index + 1] || parameters.has(options[index])) throw new Error('用法：node scripts/打包源码资料包.mjs [--output tmp/安全子目录] [--verify-tarball tmp/资料包.tgz]')
  parameters.set(options[index], options[index + 1])
}
const outputRelative = parameters.get('--output') ?? `tmp/源码资料包/v${packageConfig.version}`
safeRelative(outputRelative)
if (!outputRelative.startsWith('tmp/') || outputRelative.split('/').length < 2) throw new Error('输出只能放在仓库 tmp/ 的子目录')
const output = inside(root, outputRelative)
const library = checkedPath(root, '动效组件库', 'directory')
const libraryFiles = walk(library).files
for (const relative of libraryFiles) {
  if ((/\.(?:md|json|js|ts|vue|css|html)$/u.test(relative) || relative === '.gitattributes') && readFileSync(checkedPath(library, relative)).includes(Buffer.from('\r\n'))) throw new Error(`组件库文本应按 .gitattributes 保存为 LF 后再打包：${relative}`)
}
const catalog = readJSON(checkedPath(library, '组件索引.json'))
if (!Array.isArray(catalog.effects) || catalog.effects.length !== catalog.effectCount || catalog.effectCount !== 38) throw new Error('组件索引的效果数量不正确')
if (!catalog.generatedFiles || typeof catalog.generatedFiles !== 'object' || !Object.keys(catalog.generatedFiles).length) throw new Error('组件索引缺少生成文件校验记录')

const generatedPaths = new Set(Object.keys(catalog.generatedFiles))
for (const [relative, expected] of Object.entries(catalog.generatedFiles)) {
  if (!relative.startsWith('效果组件/') || !/^[a-f0-9]{64}$/u.test(expected)) throw new Error(`不正确的生成文件记录：${relative}`)
  const bytes = readFileSync(checkedPath(library, relative))
  if (digest(bytes) !== expected) throw new Error(`生成文件哈希不一致，请运行 npm run build:motion：${relative}`)
}
for (const relative of libraryFiles) {
  if (relative.startsWith('效果组件/') && !generatedPaths.has(relative)) throw new Error(`组件库含未登记的生成文件：${relative}`)
  if (!relative.startsWith('效果组件/') && !/^效果定义\/[^/]+\.json$/u.test(relative) && !['.gitattributes', '使用说明.md', '组件索引.json', '解析格式规范.json', '命名映射.json'].includes(relative)) throw new Error(`组件库含白名单以外的文件：${relative}`)
}

const originalBytes = original => {
  if (original !== 'index.html' && !original.startsWith('src/')) throw new Error(`原始源码只能来自 src/ 或 index.html：${original}`)
  const bytes = readFileSync(checkedPath(root, original))
  if (/\.(?:jpg|jpeg|png|webp|svg)$/iu.test(original)) return bytes
  return Buffer.from(bytes.toString('utf8').replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n'))
}
const originalHashes = new Map()
let sourceRecords = 0
for (const effect of catalog.effects) {
  const manifestPath = safeRelative(effect.manifest)
  if (!generatedPaths.has(manifestPath)) throw new Error(`效果解析未登记：${manifestPath}`)
  const manifest = readJSON(checkedPath(library, manifestPath))
  if (manifest.id !== effect.id || !Array.isArray(manifest.sources) || !manifest.sources.length) throw new Error(`效果解析与索引不一致：${manifestPath}`)
  const effectDirectory = path.posix.dirname(manifestPath)
  const sourcePaths = new Set()
  for (const source of manifest.sources) {
    if (!source.path.startsWith('源码/') && !source.path.startsWith('集成示例/')) throw new Error(`效果源码路径不正确：${source.path}`)
    const bundledPath = `${effectDirectory}/${safeRelative(source.path)}`
    if (!generatedPaths.has(bundledPath) || sourcePaths.has(bundledPath)) throw new Error(`效果源码未登记或重复：${bundledPath}`)
    sourcePaths.add(bundledPath)
    const bundled = readFileSync(checkedPath(library, bundledPath))
    if (bundled.length !== source.bytes || digest(bundled) !== source.sha256) throw new Error(`效果源码副本校验失败：${bundledPath}`)
    const original = originalBytes(source.original)
    const originalHash = digest(original)
    if (original.length !== source.originalBytes || originalHash !== source.originalSha256) throw new Error(`效果原始源码校验失败，请运行 npm run build:motion：${source.original}`)
    if (originalHashes.has(source.original) && originalHashes.get(source.original) !== originalHash) throw new Error(`同一原始源码出现不同哈希：${source.original}`)
    originalHashes.set(source.original, originalHash)
    sourceRecords++
  }
  for (const entry of manifest.bundle.entryFiles) {
    if (!sourcePaths.has(`${effectDirectory}/${safeRelative(entry)}`)) throw new Error(`中文入口缺少源码记录：${entry}`)
  }
}
const sourceDigest = digest([...originalHashes].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([original, sha]) => `${original}\0${sha}\n`).join(''))
if (sourceDigest !== catalog.sourceDigest || originalHashes.size !== catalog.uniqueSourceFileCount) throw new Error('组件索引的原始源码总校验不一致')

const copies = new Map()
for (const relative of libraryFiles) copies.set(`动效组件库/${relative}`, readFileSync(checkedPath(library, relative)))
for (const relative of ['LICENSE', 'NOTICE.md', 'docs/AI工具图标来源.md']) copies.set(relative, normalizedText(checkedPath(root, relative)))
copies.set('package.json', Buffer.from(`${JSON.stringify(packageConfig, null, 2)}\n`))
copies.set('README.md', normalizedText(checkedPath(root, '发布配置/源码资料包/安装与读取说明.md')))

const allowedDirectories = new Set()
for (const relative of copies.keys()) {
  let parent = path.posix.dirname(relative)
  while (parent !== '.') {
    allowedDirectories.add(parent)
    parent = path.posix.dirname(parent)
  }
}
let current = root
for (const segment of outputRelative.split('/')) {
  current = path.join(current, segment)
  const stat = statIfPresent(current)
  if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error(`输出目录包含符号链接或文件：${current}`)
}
if (statIfPresent(output)) {
  const existing = walk(output)
  for (const relative of existing.files) if (!copies.has(relative)) throw new Error(`输出目录含未知文件，拒绝覆盖或删除：${relative}`)
  for (const relative of existing.directories) if (!allowedDirectories.has(relative)) throw new Error(`输出目录含未知目录，拒绝覆盖或删除：${relative}`)
}

mkdirSync(output, { recursive: true })
for (const [relative, bytes] of copies) {
  const destination = inside(output, relative)
  const parent = path.dirname(destination)
  mkdirSync(parent, { recursive: true })
  const stat = statIfPresent(destination)
  if (stat && (stat.isSymbolicLink() || !stat.isFile())) throw new Error(`拒绝覆盖非正常文件：${relative}`)
  if (!stat || !readFileSync(destination).equals(bytes)) writeFileSync(destination, bytes)
  if (!readFileSync(destination).equals(bytes)) throw new Error(`写入后字节校验失败：${relative}`)
}
const totalBytes = [...copies.values()].reduce((sum, bytes) => sum + bytes.length, 0)
const packageDigest = digest([...copies.keys()].sort().map(relative => `${relative}\0${digest(copies.get(relative))}\n`).join(''))
let tarballVerification
if (parameters.has('--verify-tarball')) {
  const tarballOption = parameters.get('--verify-tarball')
  const tarballRelative = safeRelative(path.isAbsolute(tarballOption) ? normalize(path.relative(root, tarballOption)) : tarballOption)
  if (!tarballRelative.startsWith('tmp/')) throw new Error('待校验的归档只能来自仓库 tmp/ 子目录')
  const tarballBytes = readFileSync(checkedPath(root, tarballRelative))
  const tar = gunzipSync(tarballBytes, { maxOutputLength: 32 * 1024 * 1024 })
  const entries = new Map()
  let offset = 0
  let pendingPax = null
  let terminated = false
  function field(header, start, end) {
    const bytes = header.subarray(start, end)
    const nul = bytes.indexOf(0)
    const textBytes = nul < 0 ? bytes : bytes.subarray(0, nul)
    const value = textBytes.toString('utf8')
    if (!Buffer.from(value).equals(textBytes)) throw new Error('归档包含非 UTF-8 文件名')
    return value
  }
  function octal(header, start, end) {
    const raw = field(header, start, end).trim()
    if (!/^[0-7]+$/u.test(raw)) throw new Error('归档数字字段不是合法八进制')
    return Number.parseInt(raw, 8)
  }
  function readPax(content) {
    const result = {}
    let position = 0
    while (position < content.length) {
      const space = content.indexOf(32, position)
      if (space < 0) throw new Error('归档 PAX 记录缺少长度')
      const lengthText = content.subarray(position, space).toString('ascii')
      if (!/^[1-9][0-9]*$/u.test(lengthText)) throw new Error('归档 PAX 长度不正确')
      const length = Number(lengthText)
      const end = position + length
      if (!Number.isSafeInteger(length) || end > content.length || content[end - 1] !== 10) throw new Error('归档 PAX 记录长度越界')
      const payload = content.subarray(space + 1, end - 1)
      const text = payload.toString('utf8')
      if (!Buffer.from(text).equals(payload)) throw new Error('归档 PAX 不是合法 UTF-8')
      const equal = text.indexOf('=')
      if (equal <= 0) throw new Error('归档 PAX 格式不正确')
      const key = text.slice(0, equal)
      if (key === 'linkpath' || key in result) throw new Error('归档 PAX 含链接或重复字段')
      result[key] = text.slice(equal + 1)
      position = end
    }
    return result
  }
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) {
      if (pendingPax || tar.subarray(offset).some(byte => byte !== 0)) throw new Error('归档结束块之后含未知内容')
      terminated = true
      break
    }
    const checksum = octal(header, 148, 156)
    const actualChecksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0)
    if (checksum !== actualChecksum) throw new Error('归档 header 校验失败')
    const size = octal(header, 124, 136)
    if (!Number.isSafeInteger(size) || size < 0 || size > tar.length - offset - 512) throw new Error('归档文件大小越界')
    const content = tar.subarray(offset + 512, offset + 512 + size)
    const type = String.fromCharCode(header[156] || 48)
    const prefix = field(header, 345, 500)
    const rawPath = `${prefix ? `${prefix}/` : ''}${field(header, 0, 100)}`
    offset += 512 + Math.ceil(size / 512) * 512
    if (type === 'x') {
      if (pendingPax) throw new Error('归档含重复扩展 header')
      pendingPax = readPax(content)
      continue
    }
    if (!['0', '5'].includes(type)) throw new Error(`归档含非正常文件或链接：${rawPath}`)
    const filename = pendingPax?.path ?? rawPath
    if (pendingPax?.size !== undefined && pendingPax.size !== String(size)) throw new Error('归档 PAX 大小与实际 header 不一致')
    pendingPax = null
    const checkedName = type === '5' && filename.endsWith('/') ? filename.slice(0, -1) : filename
    safeRelative(checkedName)
    if (!checkedName.startsWith('package/')) throw new Error(`归档文件未包含 package/ 前缀：${filename}`)
    const relative = checkedName.slice('package/'.length)
    if (type === '5') {
      if (size !== 0 || !allowedDirectories.has(relative)) throw new Error(`归档含未知目录：${relative}`)
      continue
    }
    if (!copies.has(relative) || entries.has(relative)) throw new Error(`归档含未知或重复文件：${relative}`)
    if (!copies.get(relative).equals(content)) throw new Error(`归档文件字节与白名单源文件不同：${relative}`)
    entries.set(relative, content)
  }
  if (!terminated || entries.size !== copies.size) throw new Error(`归档文件数量不正确：${entries.size}/${copies.size}`)
  tarballVerification = { path: tarballRelative, files: entries.size, bytes: tarballBytes.length, sha256: digest(tarballBytes), integrity: `sha512-${createHash('sha512').update(tarballBytes).digest('base64')}` }
}
console.log(JSON.stringify({
  name: packageConfig.name,
  version: packageConfig.version,
  package: `${packageConfig.name}@${packageConfig.version}`,
  stagingDirectory: output,
  relativeDirectory: normalize(path.relative(root, output)),
  files: copies.size,
  effects: catalog.effectCount,
  sourceRecords,
  uniqueOriginalFiles: originalHashes.size,
  unpackedBytes: totalBytes,
  sourceDigest: catalog.sourceDigest,
  packageDigest,
  ...(tarballVerification ? { tarballVerification } : {}),
  preparedOnly: true
}, null, 2))
