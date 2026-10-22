/**
 * Export the maintained application's effects as agent-readable source bundles.
 * Originals stay authoritative. --check never writes; --write refreshes only this
 * generated tree. Local imports are parsed and resolved; UTF-8 source snapshots
 * normalize CRLF to LF so Windows and Linux checkouts have the same digest.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, unlinkSync, rmdirSync, lstatSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const library = path.join(root, '动效组件库')
const effectsRoot = path.join(library, '效果组件')
const mode = process.argv.slice(2)
if (mode.length !== 1 || !['--check', '--write'].includes(mode[0])) {
  throw new Error('用法：node scripts/生成动效组件库.mjs --write|--check')
}
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
const hash = value => createHash('sha256').update(value).digest('hex')
const readJSON = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''))
const schema = readJSON(path.join(library, '解析格式规范.json'))
const naming = readJSON(path.join(library, '命名映射.json'))
function chinesePath(original) {
  const translated = naming.sourcePaths[original]
  if (!translated || translated.includes('..') || translated.includes('\\') || translated.split('/').some(segment => !/[\u3400-\u9fff]/u.test(segment))) throw new Error(`Missing or unsafe Chinese source path: ${original}`)
  return translated
}
function effectName(id) {
  const name = naming.effects[id]
  if (!name || !/^[\u3400-\u9fff]+$/u.test(name)) throw new Error(`Missing or unsafe Chinese effect name: ${id}`)
  return name
}
if (new Set(Object.values(naming.effects)).size !== Object.keys(naming.effects).length || new Set(Object.values(naming.sourcePaths)).size !== Object.keys(naming.sourcePaths).length) throw new Error('Duplicate Chinese output path')
const packageJSON = readJSON(path.join(root, 'package.json'))
const lock = readJSON(path.join(root, 'package-lock.json'))
const normalize = value => value.split(path.sep).join('/')
const codeExtensions = new Set(['.vue', '.ts', '.js', '.css', '.json'])
const assetExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg'])
const sourceBytes = file => assetExtensions.has(path.extname(file)) ? readFileSync(repositorySource(file))
  : Buffer.from(readFileSync(repositorySource(file), 'utf8').replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n'))

// Deliberately limited to the vocabulary used by our checked-in JSON Schema.
// This avoids making catalog validation depend on a global CLI or new package.
function validate(value, rule, at = '$') {
  if (rule.$ref) {
    const target = rule.$ref.split('/').slice(1).reduce((current, key) => current[key], schema)
    return validate(value, target, at)
  }
  if (rule.const !== undefined && value !== rule.const) throw new Error(`${at}: expected ${rule.const}`)
  if (rule.enum && !rule.enum.includes(value)) throw new Error(`${at}: invalid enum value`)
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${at}: expected object`)
    for (const key of rule.required ?? []) if (!(key in value)) throw new Error(`${at}.${key}: required`)
    for (const [key, item] of Object.entries(value)) {
      if (rule.properties?.[key]) validate(item, rule.properties[key], `${at}.${key}`)
      else if (rule.additionalProperties === false) throw new Error(`${at}.${key}: unknown property`)
    }
  } else if (rule.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${at}: expected array`)
    if (value.length < (rule.minItems ?? 0)) throw new Error(`${at}: too few items`)
    if (rule.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) throw new Error(`${at}: duplicate item`)
    value.forEach((item, index) => validate(item, rule.items, `${at}[${index}]`))
  } else if (rule.type === 'string') {
    if (typeof value !== 'string' || value.trim().length < (rule.minLength ?? 0)) throw new Error(`${at}: expected nonempty string`)
    if (rule.pattern && !new RegExp(rule.pattern, 'u').test(value)) throw new Error(`${at}: invalid format`)
  } else if (rule.type === 'integer') {
    if (!Number.isInteger(value) || value < (rule.minimum ?? -Infinity)) throw new Error(`${at}: invalid integer`)
  } else if (rule.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${at}: expected boolean`)
}

function repositorySource(relative) {
  // The only root-level context is the boot splash needed to explain Preloader.
  if (relative === 'index.html') {
    const boot = path.join(root, relative)
    if (!lstatSync(boot).isFile() || lstatSync(boot).isSymbolicLink()) throw new Error('Unsafe boot HTML context')
    return boot
  }
  if (typeof relative !== 'string' || !relative.startsWith('src/') || relative.includes('\\')) throw new Error(`Only src/ sources allowed: ${relative}`)
  const absolute = path.resolve(root, relative)
  if (!absolute.startsWith(`${path.join(root, 'src')}${path.sep}`) || normalize(path.relative(root, absolute)) !== relative) throw new Error(`Unsafe source path: ${relative}`)
  if (!existsSync(absolute) || !lstatSync(absolute).isFile() || lstatSync(absolute).isSymbolicLink()) throw new Error(`Missing or unsafe source: ${relative}`)
  const sourceRoot = path.join(root, 'src')
  for (let parent = path.dirname(absolute); parent !== sourceRoot; parent = path.dirname(parent)) {
    if (lstatSync(parent).isSymbolicLink()) throw new Error(`Symlink source parent: ${relative}`)
  }
  if (!codeExtensions.has(path.extname(absolute)) && !(relative.startsWith('src/assets/') && assetExtensions.has(path.extname(absolute)))) throw new Error(`Unsupported source asset: ${relative}`)
  return absolute
}

function importLocations(relative, content) {
  if (assetExtensions.has(path.extname(relative))) return []
  const extension = path.extname(relative)
  if (extension === '.json') return []
  let scripts = [{ content, offset: 0 }]
  const locations = []
  const cssLocations = (css, offset = 0) => {
    for (const match of css.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/gu)) {
      const start = match.index + match[0].indexOf(match[1])
      locations.push({ specifier: match[1], start: offset + start, end: offset + start + match[1].length })
    }
  }
  if (extension === '.vue') {
    const result = parse(content, { filename: relative })
    if (result.errors.length) throw new Error(`Invalid SFC ${relative}: ${result.errors[0]}`)
    const blocks = [result.descriptor.script, result.descriptor.scriptSetup].filter(Boolean)
    scripts = blocks.map(block => ({ content: block.content, offset: block.loc.start.offset }))
    for (const block of [...blocks, ...result.descriptor.styles, result.descriptor.template].filter(Boolean)) {
      if (block.src) {
        const tagStart = content.lastIndexOf('<', block.loc.start.offset)
        const opening = content.slice(tagStart, block.loc.start.offset)
        const attribute = [...opening.matchAll(/\bsrc\s*=\s*(['"])(.*?)\1/gu)].find(match => match[2] === block.src)
        if (!attribute) throw new Error(`Cannot locate SFC src: ${relative}`)
        const start = tagStart + attribute.index + attribute[0].indexOf(attribute[2])
        locations.push({ specifier: block.src, start, end: start + block.src.length })
      }
    }
    for (const block of result.descriptor.styles) cssLocations(block.content, block.loc.start.offset)
  }
  if (extension !== '.css') {
    for (const script of scripts) for (const item of ts.preProcessFile(script.content, true, true).importedFiles) {
      const start = script.offset + item.pos + 1
      const end = script.offset + item.end + 1
      if (content.slice(start, end) !== item.fileName) throw new Error(`Cannot locate import: ${relative} -> ${item.fileName}`)
      locations.push({ specifier: item.fileName, start, end })
    }
  } else cssLocations(content)
  return locations
}
function importsOf(relative) { return [...new Set(importLocations(relative, sourceBytes(relative).toString('utf8')).map(item => item.specifier))].sort() }

function resolveLocal(from, specifier) {
  const candidate = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
  const options = [candidate, ...['.ts', '.js', '.vue', '.json', '.css'].map(extension => candidate + extension),
    ...['index.ts', 'index.js', 'index.vue'].map(index => `${candidate}/${index}`)]
  const resolved = options.find(option => existsSync(path.resolve(root, option)) && lstatSync(path.resolve(root, option)).isFile())
  if (!resolved) throw new Error(`Unresolved import: ${from} -> ${specifier}`)
  repositorySource(resolved)
  return resolved
}

function localizedBytes(original) {
  const bytes = sourceBytes(original)
  if (assetExtensions.has(path.extname(original)) || path.extname(original) === '.html') return bytes
  let content = bytes.toString('utf8')
  const changes = importLocations(original, content).filter(item => item.specifier.startsWith('.')).map(item => {
    const target = resolveLocal(original, item.specifier)
    let relative = path.posix.relative(path.posix.dirname(chinesePath(original)), chinesePath(target))
    if (['.ts', '.js'].includes(path.extname(target)) && !path.posix.extname(item.specifier)) relative = relative.slice(0, -path.extname(target).length)
    if (!relative.startsWith('.')) relative = `./${relative}`
    return { ...item, replacement: relative }
  }).sort((a, b) => b.start - a.start)
  for (const change of changes) content = content.slice(0, change.start) + change.replacement + content.slice(change.end)
  return Buffer.from(content)
}

const graphCache = new Map()
function dependencies(relative) {
  if (graphCache.has(relative)) return graphCache.get(relative)
  const result = { local: [], npm: [] }
  for (const specifier of importsOf(relative)) {
    if (specifier.startsWith('.')) result.local.push(resolveLocal(relative, specifier))
    else if (!specifier.startsWith('node:')) result.npm.push(specifier)
  }
  graphCache.set(relative, result)
  return result
}

function closure(entries) {
  const included = new Set()
  const npm = new Set()
  function visit(file) {
    if (included.has(file)) return
    included.add(file)
    const related = dependencies(file)
    related.npm.forEach(specifier => npm.add(specifier))
    related.local.forEach(visit)
  }
  entries.forEach(visit)
  return { files: [...included].sort(), npm: [...npm].sort() }
}

const definitionsRoot = path.join(library, '效果定义')
const definitions = readdirSync(definitionsRoot).filter(name => name.endsWith('.json')).sort().map(name => {
  const definition = readJSON(path.join(definitionsRoot, name))
  validate(definition, schema, name)
  if (`${effectName(definition.id)}.json` !== name) throw new Error(`Filename/id mismatch: ${name}`)
  if (definition.entryFiles.some(file => !file.startsWith('src/'))) throw new Error(`Effect entries must be src/ code: ${name}`)
  for (const file of [...definition.entryFiles, ...definition.integrationFiles, ...definition.sourceSections.map(section => section.file)]) repositorySource(file)
  for (const section of definition.sourceSections) {
    const content = readFileSync(repositorySource(section.file), 'utf8')
    for (const symbol of section.symbols) if (!content.includes(symbol)) throw new Error(`${name}: unknown source symbol ${symbol}`)
  }
  return definition
})
if (!definitions.length) throw new Error('No effect definitions')
const ids = new Set(definitions.map(definition => definition.id))
if (ids.size !== definitions.length) throw new Error('Duplicate effect id')
for (const definition of definitions) for (const related of definition.relatedEffects) if (!ids.has(related)) throw new Error(`${definition.id}: unknown related effect ${related}`)

const expected = new Map()
const allSources = new Map()
const effects = []
function add(relative, content) {
  if (!relative.startsWith('效果组件/') || relative.includes('..') || relative.includes('\\')) throw new Error(`Unsafe output: ${relative}`)
  expected.set(relative, Buffer.isBuffer(content) ? content : Buffer.from(content))
}
for (const definition of definitions) {
  // Global variables/reset styles are an explicit dependency rather than a hidden
  // assumption of the copied component. Runtime ownership still stays in src/.
  const related = closure([...definition.entryFiles, 'src/style.css'])
  const directory = `效果组件/${effectName(definition.id)}`
  const records = related.files.map(original => ({ original, path: `源码/${chinesePath(original)}`,
    role: definition.entryFiles.includes(original) ? 'entry' : original === 'src/style.css' ? 'global-style' : assetExtensions.has(path.extname(original)) ? 'imported-asset' : 'dependency' }))
  for (const original of definition.integrationFiles) {
    if (!related.files.includes(original)) records.push({ original, path: `集成示例/${chinesePath(original)}`, role: 'integration-context' })
  }
  for (const record of records) {
    const originalContent = sourceBytes(record.original)
    const content = localizedBytes(record.original)
    record.originalSha256 = hash(originalContent)
    record.originalBytes = originalContent.length
    record.sha256 = hash(content)
    record.bytes = content.length
    allSources.set(record.original, record.originalSha256)
    add(`${directory}/${record.path}`, content)
  }
  const npmDependencies = related.npm.map(specifier => {
    const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
    const requested = packageJSON.dependencies?.[packageName] ?? packageJSON.devDependencies?.[packageName]
    if (!requested) throw new Error(`Undeclared package: ${specifier}`)
    return { specifier, package: packageName, requested, locked: lock.packages?.[`node_modules/${packageName}`]?.version ?? null }
  })
  const bundle = {
    format: 'repository-source-bundle', standalone: false, textEncoding: 'UTF-8, LF (CRLF normalized)',
    entryDirectory: '源码/', integrationContextDirectory: '集成示例/',
    entryFiles: definition.entryFiles.map(original => `源码/${chinesePath(original)}`),
    namingMap: '../../命名映射.json',
    imports: '源码/ 使用中文目录和文件名，按命名映射改写本地导入并包含传递源码依赖；集成示例/ 仅保留调用上下文，其依赖不保证完整。原始标识符及运行逻辑保持不变。',
    assets: 'Directly imported src/assets images are included with original bytes; public images/videos/PDF files and third-party packages remain external references.',
    sourceOfTruth: 'Edit the root src/ files, then npm run build:motion; do not edit generated snapshots.',
    browserOnly: true,
  }
  const manifest = { $schema: '../../解析格式规范.json', ...definition, bundle, npmDependencies, sources: records }
  validate(manifest, schema, `${effectName(definition.id)}/效果介绍与解析.json`)
  add(`${directory}/效果介绍与解析.json`, json(manifest))
  const sourceRows = records.map(record => `| ${record.role} | [${record.path}](./${record.path}) | \`${record.original}\` |`).join('\n')
  const readme = `# ${definition.title.zh}

${definition.summary}

先读取 [效果介绍与解析.json](./效果介绍与解析.json)，了解触发时机、动画阶段、时序、状态、依赖、接入、清理、交互分支、限制与验证方法。

这是当前仓库的源码阅读与迁移包，尚未封装为独立 npm 包。\`源码/\` 的中文文件已改写本地导入，并包含入口的传递依赖；\`集成示例/\` 只保留调用方参考，不作为本包构建入口。

## 阅读入口

| 角色 | 中文源码副本 | 原始维护路径 |
| --- | --- | --- |
${sourceRows}

JSON 的 \`entryFiles\` 与 \`sourceSections\` 指向仓库原始维护路径；\`bundle.entryFiles\` 和 \`sources.path\` 指向此效果文件夹中的中文副本。\`sources.originalSha256\` 记录规范化原文摘要，\`sources.sha256\` 记录导入改写后副本摘要。

## 接入顺序

${definition.integration.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

在浏览器中的 Vue 3 项目接入。依赖版本见 JSON 的 \`npmDependencies\`；全局样式见 \`源码/项目源码/全局样式.css\`。公开媒体与字体资源按 \`integration.assets\` 提供，授权边界见根目录 NOTICE。源码标识符与外部资源 URL 保留原应用约定。

## 维护

修改根目录 \`src/\`、\`动效组件库/效果定义/${effectName(definition.id)}.json\` 或 [命名映射](../../命名映射.json)，再运行 \`npm run build:motion\`。用 \`npm run check:motion\` 检查 JSON、中文导入闭包及原文/副本哈希。

状态：\`${definition.status}\`。关联效果：${definition.relatedEffects.map(id => `[${effectName(id)}](../${effectName(id)}/效果介绍与解析.json)`).join('、') || '无'}。
`
  add(`${directory}/使用说明.md`, readme)
  effects.push({ id: definition.id, title: definition.title, category: definition.category, status: definition.status,
    summary: definition.summary, tags: definition.tags,
    manifest: `${directory}/效果介绍与解析.json`, readme: `${directory}/使用说明.md`,
    entryFiles: definition.entryFiles.map(file => `${directory}/源码/${chinesePath(file)}`),
    sourceFileCount: related.files.length, contextFileCount: records.length - related.files.length })
}

// Every source that directly imports GSAP must be explained by an entry or a
// named source section, not merely incidentally included through a broad page.
function filesUnder(directory) {
  if (!existsSync(directory)) return []
  if (lstatSync(directory).isSymbolicLink()) throw new Error(`Symlink directory: ${directory}`)
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Symlink in generated/source tree: ${normalize(path.relative(root, absolute))}`)
    return entry.isDirectory() ? filesUnder(absolute) : [absolute]
  })
}
// Verify the rewritten copy, independently of the original dependency graph.
// Context snapshots intentionally remain partial; only 源码/ is a closed graph.
let localizedImportCount = 0
for (const [relative, bytes] of expected) {
  if (!relative.includes('/源码/') || !codeExtensions.has(path.extname(relative))) continue
  for (const item of importLocations(relative, bytes.toString('utf8'))) {
    if (!item.specifier.startsWith('.')) continue
    const candidate = path.posix.normalize(path.posix.join(path.posix.dirname(relative), item.specifier))
    const options = [candidate, ...['.ts', '.js', '.vue', '.json', '.css'].map(extension => candidate + extension)]
    if (!options.some(option => expected.has(option))) throw new Error(`Chinese source import does not resolve: ${relative} -> ${item.specifier}`)
    localizedImportCount += 1
  }
}
const explained = new Set(definitions.flatMap(definition => [...definition.entryFiles, ...definition.sourceSections.map(section => section.file)]))
const gsapSources = filesUnder(path.join(root, 'src')).map(absolute => normalize(path.relative(root, absolute)))
  .filter(file => ['.ts', '.js', '.vue'].includes(path.extname(file)))
  .filter(file => importsOf(file).some(specifier => specifier === 'gsap' || specifier.startsWith('gsap/'))).sort()
for (const file of gsapSources) if (!explained.has(file)) throw new Error(`GSAP source has no effect explanation: ${file}`)
const sourceDigest = hash(Buffer.from([...allSources].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([file, sha]) => `${file}\0${sha}\n`).join('')))
const catalog = {
  schemaVersion: '1.0.0', title: '求职者应聘模板网站 · 遮罩、转场与动效源码库',
  description: '按视觉效果归档的真实 Vue/TypeScript/CSS 源码与 agent 解析；包含 GSAP、原生 RAF、CSS 和 Web Animations 的协作边界。',
  language: 'zh-CN', repository: 'https://github.com/xuge1324652022-boop/job-application-template',
  sourceOfTruth: 'src/', definitionDirectory: '动效组件库/效果定义/',
  generatedDirectory: '动效组件库/效果组件/', definitionSchema: '解析格式规范.json', namingMap: '命名映射.json',
  sourceDigest, effectCount: effects.length, uniqueSourceFileCount: allSources.size,
  gsapCoverage: { directlyImportingGSAP: gsapSources, explainedCount: gsapSources.length, unexplained: [] },
  agentReadOrder: ['组件索引.json', '效果组件/<中文效果名>/效果介绍与解析.json', 'bundle.entryFiles 中的中文源码入口', 'sources 中 role 为 dependency 的文件', '集成示例与验证说明'],
  regeneration: { write: 'npm run build:motion', check: 'npm run check:motion' },
  licensing: { code: 'MIT; see ../LICENSE', mediaAndMarks: 'See ../NOTICE.md; artwork and third-party marks are not relicensed by this catalog.' },
  effects,
  generatedFiles: Object.fromEntries([...expected].map(([relative, content]) => [relative, hash(content)])),
}
const catalogBytes = json(catalog)
const catalogPath = path.join(library, '组件索引.json')
const existing = filesUnder(effectsRoot).map(absolute => normalize(path.relative(library, absolute)))
const obsolete = existing.filter(relative => !expected.has(relative))
if (mode[0] === '--write') {
  // Only remove a stale file if the last manifest proves it was generated and
  // nobody edited it. Never recursively delete an output directory or user file.
  const previous = existsSync(catalogPath) ? readJSON(catalogPath) : {}
  for (const relative of obsolete) {
    if (!relative.startsWith('效果组件/') || relative.includes('..') || previous.generatedFiles?.[relative] !== hash(readFileSync(path.join(library, relative)))) {
      throw new Error(`Refusing to remove an unowned or edited file: ${relative}`)
    }
  }
  for (const relative of obsolete) unlinkSync(path.join(library, relative))
  for (const [relative, content] of expected) {
    const absolute = path.join(library, relative)
    mkdirSync(path.dirname(absolute), { recursive: true })
    if (!existsSync(absolute) || !readFileSync(absolute).equals(content)) writeFileSync(absolute, content)
  }
  // Remove only empty directories after their individually verified generated
  // files were removed. Every absolute target is checked against this library.
  function pruneEmpty(directory) {
    const absolute = path.resolve(directory)
    if (!absolute.startsWith(`${effectsRoot}${path.sep}`) && absolute !== effectsRoot) throw new Error(`Unsafe directory cleanup: ${absolute}`)
    if (lstatSync(absolute).isSymbolicLink()) throw new Error(`Unsafe directory symlink: ${absolute}`)
    for (const entry of readdirSync(absolute, { withFileTypes: true })) if (entry.isDirectory()) pruneEmpty(path.join(absolute, entry.name))
    if (absolute !== effectsRoot && !readdirSync(absolute).length) rmdirSync(absolute)
  }
  pruneEmpty(effectsRoot)
  writeFileSync(catalogPath, catalogBytes)
} else {
  const mismatches = [...expected].filter(([relative, content]) => !existsSync(path.join(library, relative)) || !readFileSync(path.join(library, relative)).equals(content)).map(([relative]) => relative)
  if (!existsSync(catalogPath) || !readFileSync(catalogPath).equals(catalogBytes)) mismatches.push('组件索引.json')
  if (mismatches.length || obsolete.length) throw new Error(`Motion catalog is stale. Run npm run build:motion.\n${[...mismatches, ...obsolete].slice(0, 15).join('\n')}`)
}
console.log(JSON.stringify({ status: 'PASS', mode: mode[0], effects: effects.length, gsapSources: gsapSources.length,
  uniqueSourceFiles: allSources.size, generatedFiles: expected.size + 1, localizedImportCount, sourceDigest }, null, 2))
