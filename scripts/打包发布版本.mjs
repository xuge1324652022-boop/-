/**
 * 从一个已提交的 Git 版本导出发布资源。仅读取 Git 对象，不打包工作区。
 * 不覆盖已有资源，也不创建标签、提交或执行任何网络操作。
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync, inflateRawSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseRoot = path.join(root, 'tmp', '发布')
const args = process.argv.slice(2)
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const blobSHA = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const asPOSIX = value => value.split(path.sep).join('/')
const isWithin = (parent, child) => {
  const relative = path.relative(parent, child)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}
const git = (...gitArgs) => execFileSync('git', gitArgs, {
  cwd: root, encoding: 'buffer', windowsHide: true, maxBuffer: 64 * 1024 * 1024
})
const gitText = (...gitArgs) => git(...gitArgs).toString('utf8').trim()

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
function safeVersion(value) {
  assert(typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value), 'package.json 必须提供可用于文件名的语义化版本号')
  return `v${value}`
}
function checkedOutputDirectory(requested, version) {
  const output = path.resolve(root, requested ?? path.join(releaseRoot, version))
  assert(isWithin(releaseRoot, output), `发布输出目录必须位于 ${releaseRoot} 的子目录内`)
  // 禁止经过已有符号链接，避免 Windows junction 把输出重定向到仓库之外。
  const relative = path.relative(root, output)
  let cursor = root
  for (const part of relative.split(path.sep)) {
    cursor = path.join(cursor, part)
    if (!existsSync(cursor)) continue
    assert(!lstatSync(cursor).isSymbolicLink(), `输出路径不能经过符号链接：${cursor}`)
    assert(lstatSync(cursor).isDirectory(), `输出路径不是目录：${cursor}`)
    assert(isWithin(realpathSync(root), realpathSync(cursor)), `输出路径解析后超出仓库：${cursor}`)
  }
  return output
}
function committedFiles(commit) {
  const raw = git('ls-tree', '-rz', '--full-tree', commit)
  const text = raw.toString('utf8')
  assert(Buffer.from(text, 'utf8').equals(raw), 'Git 文件名不是有效 UTF-8')
  assert(text.endsWith('\0'), 'Git 文件列表格式无效')
  return new Map(text.slice(0, -1).split('\0').map(record => {
    const match = /^(\d{6}) (blob|commit) ([0-9a-f]{40})\t([\s\S]+)$/u.exec(record)
    assert(match && match[2] === 'blob', `当前发布脚本只支持普通 Git 文件：${record}`)
    const name = match[4]
    assert(!name.startsWith('/') && !name.split('/').some(part => part === '..' || part === '.' || part === ''), `Git 文件路径无效：${name}`)
    return [name, { mode: match[1], sha: match[3] }]
  }))
}
function verifyArchive(location, prefix, expectedFiles) {
  const bytes = Buffer.isBuffer(location) ? location : readFileSync(location)
  let end = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 65535); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { end = offset; break }
  }
  assert(end >= 0, 'ZIP 末尾目录记录缺失')
  const count = bytes.readUInt16LE(end + 10)
  const centralSize = bytes.readUInt32LE(end + 12)
  let cursor = bytes.readUInt32LE(end + 16)
  assert(bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0 && count === bytes.readUInt16LE(end + 8), '不支持分卷 ZIP')
  assert(count !== 0xffff && centralSize !== 0xffffffff && cursor !== 0xffffffff, '不支持 ZIP64，需扩展校验器')
  assert(cursor + centralSize === end, 'ZIP 中央目录长度无效')
  const seen = new Set()
  let fileCount = 0
  let uncompressedBytes = 0
  for (let index = 0; index < count; index += 1) {
    assert(cursor + 46 <= end && bytes.readUInt32LE(cursor) === 0x02014b50, 'ZIP 中央目录条目无效')
    const flags = bytes.readUInt16LE(cursor + 8)
    const method = bytes.readUInt16LE(cursor + 10)
    const expectedCRC = bytes.readUInt32LE(cursor + 16)
    const compressedSize = bytes.readUInt32LE(cursor + 20)
    const originalSize = bytes.readUInt32LE(cursor + 24)
    const nameLength = bytes.readUInt16LE(cursor + 28)
    const extraLength = bytes.readUInt16LE(cursor + 30)
    const commentLength = bytes.readUInt16LE(cursor + 32)
    const localOffset = bytes.readUInt32LE(cursor + 42)
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength)
    const name = nameBytes.toString('utf8')
    assert(Buffer.from(name, 'utf8').equals(nameBytes) && !seen.has(name), `ZIP 文件名编码无效或重复：${name}`)
    seen.add(name)
    assert(name === `${prefix}/` || name.startsWith(`${prefix}/`), `ZIP 条目超出根目录：${name}`)
    assert(!name.includes('\\') && !name.split('/').includes('..'), `ZIP 路径无效：${name}`)
    assert((flags & 1) === 0 && [0, 8].includes(method), `ZIP 加密或压缩方式不受支持：${name}`)
    assert(localOffset + 30 <= bytes.length && bytes.readUInt32LE(localOffset) === 0x04034b50, `ZIP 本地头无效：${name}`)
    const localNameLength = bytes.readUInt16LE(localOffset + 26)
    const localExtraLength = bytes.readUInt16LE(localOffset + 28)
    assert(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength).equals(nameBytes), `ZIP 文件名头记录不一致：${name}`)
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength
    assert(dataOffset + compressedSize <= bytes.readUInt32LE(end + 16), `ZIP 内容超出文件区域：${name}`)
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize)
    const content = method === 0 ? compressed : inflateRawSync(compressed)
    assert(content.length === originalSize && crc32(content) === expectedCRC, `ZIP 内容 CRC 校验失败：${name}`)
    if (!name.endsWith('/')) {
      const source = name.slice(prefix.length + 1)
      assert(expectedFiles.has(source), `ZIP 包含提交之外的文件：${source}`)
      assert(blobSHA(content) === expectedFiles.get(source).sha, `ZIP 内容与 Git 提交不一致：${source}`)
      fileCount += 1
      uncompressedBytes += content.length
    }
    cursor += 46 + nameLength + extraLength + commentLength
  }
  assert(cursor === end && fileCount === expectedFiles.size, 'ZIP 文件树与指定 Git 提交不一致')
  return { fileCount, uncompressedBytes, bytes: bytes.length, sha256: sha256(bytes), crc32Verified: true, gitBlobHashesVerified: true }
}
function archive(commit, output, name, selectedPaths, files) {
  const prefix = name.replace(/\.zip$/u, '')
  const location = path.join(output, name)
  // wx 保证不会覆盖任何已存在的文件；Git 输出直接写入这个新文件的句柄。
  const fd = openSync(location, 'wx')
  try {
    // Git archive 也会应用文本检出换行规则；固定 LF，避免 Windows 的
    // core.autocrlf/core.eol 把提交中的 LF 转为 CRLF，破坏 blob 哈希核验。
    execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'archive', '--format=zip', `--prefix=${prefix}/`, commit, ...(selectedPaths.length ? ['--', ...selectedPaths] : [])], {
      cwd: root, windowsHide: true, stdio: ['ignore', fd, 'pipe'], maxBuffer: 64 * 1024 * 1024
    })
  } finally { closeSync(fd) }
  const expected = new Map([...files].filter(([source]) => !selectedPaths.length || selectedPaths.some(selected => source === selected || source.startsWith(`${selected}/`))))
  return { file: name, rootDirectory: `${prefix}/`, ...verifyArchive(location, prefix, expected) }
}

if (args.length === 1 && args[0] === '--self-test') {
  assert(crc32(Buffer.from('123456789')) === 0xcbf43926, 'CRC32 标准向量校验失败')
  assert(blobSHA(Buffer.from('test content\n')) === 'd670460b4b4aece5915caf5c68d12f560a9fe3e4', 'Git blob 哈希标准向量校验失败')
  assert(safeVersion('0.2.0') === 'v0.2.0', '版本号校验失败')
  assert(isWithin(releaseRoot, path.join(releaseRoot, 'v0.2.0')) && !isWithin(releaseRoot, path.resolve(releaseRoot, '..')), '输出路径约束校验失败')
  // 在内存中构造含中文路径、存储与 Deflate 两种条目的 ZIP，不读取或打包旧 HEAD。
  const prefix = '中文校验-v0.2.0'
  const fixtures = [
    { source: '说明.json', content: Buffer.from('{"中文":"校验😀"}\n'), method: 0 },
    { source: '源码/组件.vue', content: Buffer.from('<template>动效组件</template>\n'.repeat(100)), method: 8 }
  ]
  let localSize = 0
  const locals = []
  const central = []
  for (const fixture of fixtures) {
    const name = Buffer.from(`${prefix}/${fixture.source}`)
    const compressed = fixture.method === 0 ? fixture.content : deflateRawSync(fixture.content)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(fixture.method, 8)
    local.writeUInt32LE(crc32(fixture.content), 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(fixture.content.length, 22)
    local.writeUInt16LE(name.length, 26)
    const directory = Buffer.alloc(46)
    directory.writeUInt32LE(0x02014b50, 0)
    directory.writeUInt16LE(20, 4)
    directory.writeUInt16LE(20, 6)
    local.copy(directory, 8, 6, 26)
    directory.writeUInt16LE(name.length, 28)
    directory.writeUInt32LE(localSize, 42)
    locals.push(local, name, compressed)
    central.push(directory, name)
    localSize += local.length + name.length + compressed.length
  }
  const centralBytes = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(fixtures.length, 8)
  end.writeUInt16LE(fixtures.length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(localSize, 16)
  const fixtureZIP = Buffer.concat([...locals, centralBytes, end])
  const expected = new Map(fixtures.map(item => [item.source, { sha: blobSHA(item.content) }]))
  assert(verifyArchive(fixtureZIP, prefix, expected).fileCount === 2, '内存 ZIP 校验失败')
  const corrupted = Buffer.from(fixtureZIP)
  corrupted[30 + Buffer.byteLength(`${prefix}/${fixtures[0].source}`)] ^= 1
  let rejected = false
  try { verifyArchive(corrupted, prefix, expected) } catch { rejected = true }
  assert(rejected, '受损 ZIP 未被拒绝')
  process.stdout.write(`${JSON.stringify({ selfTest: 'passed', unicodeZIP: true, compressionMethods: [0, 8], corruptedZIPRejected: true, gitReads: false, filesWritten: false, networkRequests: false })}\n`)
} else {
  let requestedRef = 'HEAD'
  let requestedOutput
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]
    assert(['--ref', '--output'].includes(option) && index + 1 < args.length, '用法：node scripts/打包发布版本.mjs [--ref REF] [--output tmp/发布/目录]，或 --self-test')
    const value = args[++index]
    if (option === '--ref') requestedRef = value
    else requestedOutput = value
  }
  assert(requestedRef.length > 0 && requestedRef.length <= 200 && !requestedRef.includes('\0'), 'Git ref 无效')
  const commit = gitText('rev-parse', '--verify', '--end-of-options', `${requestedRef}^{commit}`)
  assert(/^[0-9a-f]{40}$/u.test(commit), 'Git ref 必须解析为完整提交 SHA')
  const packageJSON = JSON.parse(git('show', `${commit}:package.json`).toString('utf8'))
  const version = safeVersion(packageJSON.version)
  const files = committedFiles(commit)
  for (const required of ['LICENSE', 'NOTICE.md', '动效组件库/组件索引.json', '动效组件库/解析格式规范.json']) {
    assert(files.has(required), `提交 ${commit} 缺少发布入口：${required}；请先提交中文组件库`)
  }
  const output = checkedOutputDirectory(requestedOutput, version)
  const fullName = `求职应聘模板网站-${version}.zip`
  const libraryName = `动效组件库-${version}.zip`
  const names = [fullName, libraryName, '校验清单.sha256', '发布资源.json']
  for (const name of names) assert(!existsSync(path.join(output, name)), `发布资源已经存在，拒绝覆盖：${path.join(output, name)}`)
  mkdirSync(output, { recursive: true })
  const archives = [
    archive(commit, output, fullName, [], files),
    archive(commit, output, libraryName, ['动效组件库', 'LICENSE', 'NOTICE.md'], files)
  ]
  const manifest = {
    schemaVersion: '1.0.0', version, commit,
    tree: gitText('rev-parse', `${commit}^{tree}`),
    createdAt: new Date().toISOString(),
    source: 'git archive：只包含指定提交中受 Git 跟踪的文件，不读取工作区内容',
    outputDirectory: asPOSIX(path.relative(root, output)),
    archives
  }
  writeFileSync(path.join(output, '发布资源.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  const checksums = [...archives.map(item => `${item.sha256}  ${item.file}`), `${sha256(readFileSync(path.join(output, '发布资源.json')))}  发布资源.json`]
  writeFileSync(path.join(output, '校验清单.sha256'), `${checksums.join('\n')}\n`, { encoding: 'utf8', flag: 'wx' })
  process.stdout.write(`${JSON.stringify({ ...manifest, checksumFile: path.join(output, '校验清单.sha256'), manifestFile: path.join(output, '发布资源.json'), repositoryRelativeDirectory: asPOSIX(path.relative(root, output)) }, null, 2)}\n`)
}
