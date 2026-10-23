/** 检查实际待提交文件与批准的模板素材；报错只显示类别和路径，不回显个人字段。 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import vm from 'node:vm'

const hash = (value) => createHash('sha256').update(value).digest('hex')
const binaryExtensions =
  /\.(?:pdf|png|jpe?g|webp|gif|avif|ico|mp4|webm|mov|mp3|wav|ogg|zip|tgz|gz|tar|7z|rar|woff2?|ttf|otf|eot|wasm|exe|dll|bin|db|sqlite)$/iu
const forbiddenDirectories =
  /^(?:本机私有资料|作品|参考资料|个人简历|outputs|backups|tmp|上线交付|网站部署文件|docs\/历史说明|\.aws|\.ssh|\.codex|\.agents|\.workbuddy-ai|\.uploads)(?:\/|$)/iu

export function forbiddenPublicPath(file) {
  if (
    typeof file !== 'string' ||
    !file ||
    path.isAbsolute(file) ||
    file.includes('\\') ||
    [...file].some(
      (character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127,
    ) ||
    file.split('/').some((part) => !part || part === '.' || part === '..')
  )
    return 'invalid-path'
  if (forbiddenDirectories.test(file)) return 'private-directory'
  for (const part of file.split('/')) {
    if (
      /^(?:\.npmrc|\.netrc|\.pypirc|auth\.json|credentials(?:\.[^/]*)?|id_rsa(?:\..*)?|id_ed25519(?:\..*)?)$/iu.test(
        part,
      ) ||
      (/^\.env(?:\.|$)/iu.test(part) && part !== '.env.example') ||
      /\.(?:pem|key|p12|pfx|jks|keystore)$/iu.test(part)
    )
      return 'credential-path'
  }
  return null
}

/** 所有有效 UTF-8 文本均扫描，不按扩展名跳过 SVG、CSV、shell 或隐藏配置。 */
export function publicText(bytes, file = '') {
  if (binaryExtensions.test(file) || bytes.includes(0)) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

export function textPrivacyCategories(text, localTokens = []) {
  const problems = []
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) ?? []
  if (
    emails.some(
      (email) =>
        !/@(?:example\.(?:com|org|net|test)|users\.noreply\.github\.com)$/iu.test(email) &&
        email !== 'git@github.com',
    )
  )
    problems.push('non-example-email')
  // 排除摘要内的十六进制片段，避免把 SHA 的局部误判为手机号码。
  if (/(?<![\da-f])(?:\+?86[ -]?)?1[3-9]\d{9}(?![\da-f])/iu.test(text))
    problems.push('phone-number')
  if (
    /[A-Z]:[\\/]Users[\\/][^\\/\s"']+[\\/]/iu.test(text) ||
    /\/(?:Users|home)\/[^/\s"']+\//u.test(text)
  )
    problems.push('local-user-path')
  if (
    /(?:github_pat_[A-Za-z0-9_]{60,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-proj-[A-Za-z0-9_-]{60,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/u.test(
      text,
    )
  )
    problems.push('credential')
  if (/data:(?:image|application|audio|video)\/[^\s;,]+;base64,[A-Za-z0-9+/=]{80,}/iu.test(text))
    problems.push('embedded-unreviewed-media')
  if (
    localTokens.some((token) =>
      text.toLocaleLowerCase('en').includes(token.toLocaleLowerCase('en')),
    )
  )
    problems.push('local-private-fingerprint')
  return problems
}

/** 检查实际导出的示例素材及其文件集合；错误只包含固定类别和公开目录。 */
export function templateVisualPrivacyProblems(visuals, portfolioFiles, approvedPaths) {
  const problems = new Map()
  const modulePath = 'src/data/visualPortfolio.ts'
  const add = (category, file = modulePath) => problems.set(`${category}:${file}`, [category, file])
  const expectedIds = new Set()
  const expectedFiles = new Set()
  for (const [collection, prefix, count] of [
    ['photoCollection', 'sample-photo', 26],
    ['posterCollection', 'sample-poster', 10],
  ]) {
    const ids = new Set(
      Array.from(
        { length: count },
        (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`,
      ),
    )
    for (const id of ids) expectedIds.add(id)
    const entries = visuals?.[collection]
    if (!Array.isArray(entries) || entries.length !== count) add('non-template-visual-collection')
    const seen = new Set()
    for (const item of Array.isArray(entries) ? entries : []) {
      if (!ids.has(item?.id) || seen.has(item.id)) add('non-template-visual-id')
      seen.add(item?.id)
      if (
        typeof item?.title?.zh !== 'string' ||
        !item.title.zh.includes('示例') ||
        typeof item?.title?.en !== 'string' ||
        !/\bsample\b/iu.test(item.title.en)
      )
        add('non-template-visual-title')
      if (
        typeof item?.alt?.zh !== 'string' ||
        !item.alt.zh.includes('合成') ||
        typeof item?.alt?.en !== 'string' ||
        !/\bsynthetic\b/iu.test(item.alt.en)
      )
        add('non-template-visual-alt')
      if (
        !Number.isFinite(item?.width) ||
        !Number.isFinite(item?.height) ||
        item.width <= 0 ||
        item.height <= 0
      )
        add('invalid-template-visual-dimensions')
      for (const [field, size] of [
        ['src', 1600],
        ['large', 2560],
        ['thumb', 400],
      ]) {
        if (item?.[field] !== `/portfolio/${item?.id}-${size}.webp`) add('non-template-visual-path')
      }
    }
    if ([...ids].some((id) => !seen.has(id))) add('incomplete-template-visual-ids')
  }
  for (const id of expectedIds)
    for (const size of [400, 1600, 2560]) expectedFiles.add(`public/portfolio/${id}-${size}.webp`)
  const actualFiles = new Set(portfolioFiles)
  if ([...actualFiles].some((file) => !expectedFiles.has(file)))
    add('unexpected-template-visual-asset', 'public/portfolio')
  if ([...expectedFiles].some((file) => !actualFiles.has(file)))
    add('missing-template-visual-asset', 'public/portfolio')
  if ([...expectedFiles].some((file) => !approvedPaths.has(file)))
    add('unapproved-template-visual-asset', 'public/portfolio')
  return [...problems.values()]
}

function normalFile(relative) {
  let current = process.cwd()
  const parts = relative.split('/')
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index])
    const stat = lstatSync(current)
    if (
      stat.isSymbolicLink() ||
      (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())
    )
      return false
  }
  return true
}

export function checkPublicPrivacy({ localAudit = false } = {}) {
  const problems = []
  const git = (args) => execFileSync('git', args, { encoding: 'utf8' })
  const candidates = new Set(
    git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
      .split('\0')
      .filter(Boolean),
  )
  // Vite 会复制 public 内被 gitignore 忽略的文件；这两个发布素材根不能漏扫。
  function collectAssets(directory) {
    if (!existsSync(directory)) return
    const stat = lstatSync(directory)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      candidates.add(directory)
      return
    }
    for (const entry of readdirSync(directory)) {
      const relative = `${directory}/${entry}`
      const stat = lstatSync(relative)
      if (stat.isDirectory() && !stat.isSymbolicLink()) collectAssets(relative)
      else candidates.add(relative)
    }
  }
  collectAssets('public')
  collectAssets('src/assets')
  const files = [...candidates]
  // 未暂存源码照常扫描；同时拒绝验证工作区后却提交另一份 index 字节。
  for (const file of git(['diff', '--no-ext-diff', '--no-textconv', '--name-only', '-z', '--'])
    .split('\0')
    .filter(Boolean))
    problems.push(['index-worktree-mismatch', file])
  for (const record of git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t')
    if (!/^100(?:644|755) [a-f0-9]{40,64} 0$/u.test(record.slice(0, tab)))
      problems.push(['non-regular-index-entry', record.slice(tab + 1)])
  }
  const localTokens =
    localAudit && existsSync('tmp/隐私阻断词.json') && normalFile('tmp/隐私阻断词.json')
      ? JSON.parse(readFileSync('tmp/隐私阻断词.json', 'utf8')).filter(
          (token) =>
            typeof token === 'string' && (token.length >= 4 || /\p{Script=Han}/u.test(token)),
        )
      : []
  for (const file of files) {
    const forbidden = forbiddenPublicPath(file)
    if (forbidden) {
      problems.push([forbidden, file])
      continue
    }
    if (!existsSync(file) || !normalFile(file)) {
      problems.push(['non-regular-file', file])
      continue
    }
    const text = publicText(readFileSync(file), file)
    if (text !== null)
      for (const category of textPrivacyCategories(text, localTokens))
        problems.push([category, file])
    for (const category of textPrivacyCategories(file, localTokens)) problems.push([category, file])
  }

  // 运行实际数据模块，检查默认模板身份与联系入口，不通过字符串扫描猜测正文。
  assert(normalFile('src/data/aboutProfile.ts'), '默认人物模块不是普通文件')
  const source = readFileSync('src/data/aboutProfile.ts', 'utf8')
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports },
  )
  assert(
    exports.IDENTITY.nameZh === '示例求职者' && exports.IDENTITY.nameEn === 'Example Candidate',
    '默认人物字段不是模板示例',
  )
  for (const key of ['email', 'gmail'])
    assert(/^[^@]+@example\.com$/u.test(exports.CONTACT[key]), '联系邮箱不是模板示例')
  assert(
    exports.CONTACT.resume === '/resume.pdf' &&
      exports.CONTACT.portfolio === 'https://example.com/portfolio',
    '默认联系入口不是模板示例',
  )
  exports.assertParity()

  // PDF和图片不能只依靠文本正则；只允许字节与已批准的合成示例一致的资源。
  assert(
    normalFile('public/模板素材清单.json') && normalFile('发布配置/公开第三方素材.json'),
    '审核配置不是普通文件',
  )
  const approved = JSON.parse(readFileSync('public/模板素材清单.json', 'utf8'))
  const generated = Array.isArray(approved) ? approved : approved.files
  const rows = generated.concat(
    JSON.parse(readFileSync('发布配置/公开第三方素材.json', 'utf8')).files,
  )
  assert(Array.isArray(rows) && rows.length > 100, '缺少公开模板素材审核清单')
  const approvedPaths = new Set()
  const approvedHashes = new Set(rows.map((row) => row.sha256))
  for (const row of rows) {
    const relative = row.path
    assert(!forbiddenPublicPath(relative) && normalFile(relative), '素材路径必须是项目内的普通文件')
    assert(
      relative.startsWith('public/') || relative.startsWith('src/assets/color-frames/'),
      '未知素材根目录',
    )
    assert(
      /^[a-f0-9]{64}$/u.test(row.sha256) && !approvedPaths.has(relative),
      '素材摘要或登记不正确',
    )
    approvedPaths.add(relative)
    if (!existsSync(relative) || hash(readFileSync(relative)) !== row.sha256)
      problems.push(['unapproved-media-bytes', relative])
  }
  // 默认视觉模块存在时必须运行真实导出，避免换掉图片却继续公开旧标题、alt 或路径。
  const visualModulePath = 'src/data/visualPortfolio.ts'
  if (existsSync(visualModulePath)) {
    assert(normalFile(visualModulePath), '默认视觉模块不是普通文件')
    const visualExports = {}
    vm.runInNewContext(
      ts.transpileModule(readFileSync(visualModulePath, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      { exports: visualExports },
    )
    problems.push(
      ...templateVisualPrivacyProblems(
        visualExports,
        files.filter((file) => file.startsWith('public/portfolio/')),
        approvedPaths,
      ),
    )
  }
  for (const file of files) {
    if (
      forbiddenPublicPath(file) ||
      !existsSync(file) ||
      !normalFile(file) ||
      publicText(readFileSync(file), file) !== null ||
      approvedPaths.has(file)
    )
      continue
    if (file.startsWith('动效组件库/效果组件/') && approvedHashes.has(hash(readFileSync(file))))
      continue
    problems.push(['unapproved-binary', file])
  }
  return {
    passed: !problems.length,
    files: files.length,
    approvedMedia: rows.length,
    localAudit: localTokens.length > 0,
    ...(problems.length ? { problems } : {}),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = checkPublicPrivacy({ localAudit: process.argv.includes('--local-audit') })
    console[result.passed ? 'log' : 'error'](JSON.stringify(result, null, 2))
    if (!result.passed) process.exitCode = 1
  } catch {
    console.error(
      JSON.stringify({
        passed: false,
        problems: [['privacy-configuration-or-template-error', '公开模板配置']],
      }),
    )
    process.exitCode = 1
  }
}
