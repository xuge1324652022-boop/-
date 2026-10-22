/**
 * Publish only the checked, immutable source-package tarball from trusted main CI.
 * npm output is parsed privately; credentials and raw npm diagnostics never print.
 */
import { createHash } from 'node:crypto'
import { lstatSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const registry = 'https://npm.pkg.github.com'
const packageName = '@xuge1324652022-boop/animation-source-package'
const repository = 'xuge1324652022-boop/job-application-template'
const fail = message => { throw new Error(message) }
const parseJSON = (bytes, message) => {
  try { return JSON.parse(bytes.toString().replace(/^\uFEFF/u, '')) } catch { fail(message) }
}

function checkedPath(absolute, kind = 'file') {
  if (!path.isAbsolute(absolute) || /[\0\r\n]/u.test(absolute)) fail('路径必须是正常的绝对路径')
  const parsed = path.parse(absolute)
  let current = parsed.root
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) fail('拒绝符号链接路径')
    if (current !== absolute && !stat.isDirectory()) fail('路径的父项必须是目录')
  }
  const stat = lstatSync(absolute)
  if (kind === 'directory' ? !stat.isDirectory() : !stat.isFile()) fail('路径类型不正确')
  return { absolute, stat }
}

function artifactPath(value, allowRunnerTemp = false) {
  if (typeof value !== 'string' || !value || /[\0\r\n]/u.test(value)) fail('缺少或无效的产物路径')
  const absolute = path.resolve(root, value)
  const temporaryRoots = [path.join(root, 'tmp')]
  if (allowRunnerTemp && process.env.RUNNER_TEMP && path.isAbsolute(process.env.RUNNER_TEMP)) temporaryRoots.push(path.resolve(process.env.RUNNER_TEMP))
  if (!temporaryRoots.some(base => {
    const relative = path.relative(base, absolute)
    return relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
  })) fail('产物只能来自仓库 tmp/ 子目录；npm 元数据也可来自 RUNNER_TEMP')
  return checkedPath(absolute)
}

const options = process.argv.slice(2)
let checkOnly = false
const argumentsByName = new Map()
for (let index = 0; index < options.length; index++) {
  const option = options[index]
  if (option === '--check' && !checkOnly) checkOnly = true
  else if (['--tarball', '--metadata'].includes(option) && !argumentsByName.has(option) && options[index + 1] && !options[index + 1].startsWith('--')) argumentsByName.set(option, options[++index])
  else fail('用法：npm run publish:motion-source -- [--check] --tarball tmp/包.tgz --metadata tmp/npm-pack.json')
}
if (argumentsByName.size !== 2) fail('必须同时指定 --tarball 和 --metadata')

const config = parseJSON(readFileSync(path.join(root, '发布配置/源码资料包/包配置.json')), '无法解析固定包配置')
const versionParts = typeof config.version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u.exec(config.version)
if (config.name !== packageName || !versionParts || versionParts[4]?.split('.').some(part => /^\d+$/u.test(part) && part.length > 1 && part.startsWith('0')) || config.publishConfig?.registry !== registry) fail('包配置与固定发布目标不一致，或版本不是有效 SemVer')
const tarball = artifactPath(argumentsByName.get('--tarball'))
const metadata = artifactPath(argumentsByName.get('--metadata'), true)
if (!tarball.absolute.endsWith('.tgz') || tarball.stat.size <= 0 || tarball.stat.size >= 256 * 1024 * 1024) fail('压缩包格式或大小不正确')
if (metadata.stat.size <= 0 || metadata.stat.size > 8 * 1024 * 1024) fail('npm pack 元数据大小不正确')
const packed = parseJSON(readFileSync(metadata.absolute), '无法解析 npm pack 元数据')
if (!Array.isArray(packed) || packed.length !== 1 || !packed[0] || typeof packed[0] !== 'object') fail('npm pack 元数据必须恰好包含一个包')
const record = packed[0]
const expectedFilename = `${packageName.replace(/^@/u, '').replace('/', '-')}-${config.version}.tgz`
if (record.name !== packageName || record.version !== config.version || record.filename !== expectedFilename || path.basename(tarball.absolute) !== record.filename || record.size !== tarball.stat.size) fail('npm pack 元数据的包名、版本、文件名或大小与产物不一致')
const bytes = readFileSync(tarball.absolute)
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
if (typeof record.integrity !== 'string' || record.integrity !== integrity) fail('压缩包的 SHA-512 integrity 与 npm pack 元数据不一致')
if (record.shasum !== undefined && record.shasum !== createHash('sha1').update(bytes).digest('hex')) fail('压缩包的 SHA-1 与 npm pack 元数据不一致')

// Validate every archive member against the source-package allowlist and bytes.
// The builder performs no network operations and does not execute package scripts.
const verification = spawnSync(process.execPath, [path.join(root, 'scripts/打包源码资料包.mjs'), '--verify-tarball', tarball.absolute], {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 2 * 1024 * 1024
})
if (verification.error || verification.status !== 0) fail('压缩包内容未通过源码白名单与逐文件校验')
const verified = parseJSON(verification.stdout, '压缩包校验器未返回有效 JSON')
if (verified.package !== `${packageName}@${config.version}` || verified.tarballVerification?.integrity !== integrity) fail('压缩包校验器返回的发布目标或 integrity 不一致')

if (checkOnly) {
  console.log(JSON.stringify({ package: `${packageName}@${config.version}`, state: 'checked', integrity, tarball: path.relative(root, tarball.absolute) }, null, 2))
  process.exit(0)
}

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_REF !== 'refs/heads/main' || !['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)) fail('发布仅允许在目标仓库 main 分支的 GitHub Actions push 或手动工作流中执行')
if (!/^[a-f0-9]{40}$/u.test(process.env.GITHUB_SHA ?? '')) fail('GitHub Actions 必须提供完整提交 SHA')
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000 })
if (head.error || head.status !== 0 || head.stdout.trim() !== process.env.GITHUB_SHA) fail('当前检出的提交与 GitHub Actions SHA 不一致')
if (typeof process.env.NODE_AUTH_TOKEN !== 'string' || !process.env.NODE_AUTH_TOKEN.trim()) fail('GitHub Actions 未提供 npm 发布认证')
if (!process.env.npm_execpath || !path.isAbsolute(process.env.npm_execpath) || path.basename(process.env.npm_execpath) !== 'npm-cli.js' || !lstatSync(process.env.npm_execpath).isFile()) fail('请通过 npm run publish:motion-source 调用发布脚本')
if (!process.env.RUNNER_TEMP || !path.isAbsolute(process.env.RUNNER_TEMP)) fail('缺少 GitHub Actions 临时目录')
const runnerTemporaryRoot = checkedPath(path.resolve(process.env.RUNNER_TEMP), 'directory').absolute
const temporaryDirectory = mkdtempSync(path.join(runnerTemporaryRoot, 'portfolio-motion-publish-'))
const npmrc = path.join(temporaryDirectory, '.npmrc')
const publicationTarball = path.join(temporaryDirectory, expectedFilename)

function npm(args) {
  return spawnSync(process.execPath, [process.env.npm_execpath, ...args, '--registry', registry, '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, npm_config_userconfig: npmrc, NPM_CONFIG_USERCONFIG: npmrc, npm_config_loglevel: 'silent', NPM_CONFIG_LOGLEVEL: 'silent' }
  })
}

function errorCode(result) {
  if (result.error) return /^[A-Z][A-Z0-9_]{0,63}$/u.test(result.error.code ?? '') ? result.error.code : 'NPM_EXECUTION_FAILED'
  const codes = new Set()
  for (const output of [result.stdout, result.stderr]) {
    try {
      const code = JSON.parse(output)?.error?.code
      if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/u.test(code)) codes.add(code)
    } catch { /* Raw npm output can contain credentials and must never print. */ }
  }
  return codes.size === 1 ? [...codes][0] : 'NPM_REQUEST_FAILED'
}

function publishedIntegrity() {
  const result = npm(['view', `${packageName}@${config.version}`, 'dist.integrity', '--json'])
  if (result.error || result.status !== 0) return { code: errorCode(result) }
  let remote
  try { remote = JSON.parse(result.stdout) } catch { fail('npm view 没有返回有效 JSON integrity') }
  if (typeof remote !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/u.test(remote)) fail('注册表返回的 integrity 格式不正确')
  if (remote !== integrity) fail('注册表已有同名同版本的不同内容；请升级版本，拒绝覆盖或误报成功')
  return { integrity: remote }
}

const failures = []
try {
  // Capture the exact bytes already verified above so a later change to the
  // repository's pack output cannot replace the file passed to npm publish.
  writeFileSync(publicationTarball, bytes, { flag: 'wx', mode: 0o600 })
  // This file contains the literal variable placeholder, never the token value.
  writeFileSync(npmrc, '@xuge1324652022-boop:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n', { flag: 'wx', mode: 0o600 })
  const existing = publishedIntegrity()
  let state = 'unchanged'
  if (existing.code) {
    if (existing.code !== 'E404') fail(`无法查询已有包：${existing.code}`)
    const publication = npm(['publish', publicationTarball, '--json'])
    if (publication.error || publication.status !== 0) fail(`包发布失败：${errorCode(publication)}`)
    let confirmed
    for (let attempt = 0; attempt < 3; attempt++) {
      confirmed = publishedIntegrity()
      if (!confirmed.code) break
      if (confirmed.code !== 'E404') fail(`发布后核验失败：${confirmed.code}`)
      if (attempt < 2) await setTimeout(2000)
    }
    if (confirmed.code) fail('注册表尚未返回已发布版本，无法确认发布成功')
    state = 'published'
  }
  console.log(JSON.stringify({ package: `${packageName}@${config.version}`, state, registry, integrity, tarball: path.relative(root, tarball.absolute) }, null, 2))
} catch (error) {
  failures.push(error)
}
// Remove only the files and exclusive directory created by this invocation.
// Attempt every cleanup and preserve the publication error if cleanup also fails.
for (const created of [npmrc, publicationTarball]) {
  try { unlinkSync(created) } catch (error) { if (error.code !== 'ENOENT') failures.push(error) }
}
try { rmdirSync(temporaryDirectory) } catch (error) { failures.push(error) }
if (failures.length === 1) throw failures[0]
if (failures.length > 1) throw new AggregateError(failures, '源码包发布或临时文件清理失败', { cause: failures[0] })
