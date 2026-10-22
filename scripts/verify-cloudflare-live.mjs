/** 上线后的只读验收；不需要 Cloudflare 凭据，也不会调用 Cloudflare 管理 API。 */
import { createHash } from 'node:crypto'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pageFileFor, routeMetadata, siteOrigin } from './route-pages.mjs'

const CONCURRENCY = 4
const REQUEST_TIMEOUT = 20_000
const MIME_TYPES = {
  '.html': ['text/html'], '.js': ['application/javascript', 'text/javascript'],
  '.mjs': ['application/javascript', 'text/javascript'], '.css': ['text/css'],
  '.json': ['application/json'], '.txt': ['text/plain'], '.xml': ['application/xml', 'text/xml'],
  '.svg': ['image/svg+xml'], '.png': ['image/png'], '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'], '.gif': ['image/gif'], '.avif': ['image/avif'], '.ico': ['image/x-icon', 'image/vnd.microsoft.icon'],
  '.mp4': ['video/mp4'], '.webm': ['video/webm'], '.mp3': ['audio/mpeg'], '.ogg': ['audio/ogg', 'video/ogg'],
  '.pdf': ['application/pdf'], '.woff': ['font/woff', 'application/font-woff'],
  '.woff2': ['font/woff2'], '.ttf': ['font/ttf', 'application/x-font-ttf'],
}
const SPA_PATHS = routeMetadata.routes.flatMap(({ path }) => path === '/' ? [path] : [path, `${path}/`])
const MISSING_PATHS = [
  '/color/__verify_missing_video__.mp4', '/assets/__verify_missing_script__.js',
  '/assets/__verify_missing_image__.png', '/.env', '/.git/config',
  '/__verify_missing_page__', '/about/__verify_missing_page__', '/card/99',
]
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const assetHash = (buffer, path) => sha256(buffer.toString('base64') + extname(path).slice(1)).slice(0, 32)
const typeOf = response => (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

function validatePath(path) {
  requireCondition(path.startsWith('/') && !path.includes('\\') && !path.includes('\0') &&
    path.slice(1).split('/').every(part => part && part !== '.' && part !== '..'), '素材清单包含无效路径')
}

async function concurrent(items, operation) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) await operation(items[next++])
  }))
}

async function readPrefix(path, length) {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally { await handle.close() }
}

// 错误页面不整页读取；GET 的响应体也设上限，避免错误配置下载完整视频。
async function limitedBody(response, maximum) {
  const reader = response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      requireCondition(size <= maximum, `响应体超过验收上限 ${maximum} 字节`)
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, size)
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function main() {
  const [baseUrl, outputArgument, ...extra] = process.argv.slice(2)
  requireCondition(baseUrl && outputArgument && !extra.length,
    '用法：node scripts/verify-cloudflare-live.mjs <baseUrl> <outputRoot>')
  const outputRoot = resolve(outputArgument)
  const reportPath = join(outputRoot, '上线验证.json')
  const started = Date.now()
  const report = { startedAt: new Date(started).toISOString(), status: 'FAIL', checks: [] }
  try {
    let base
    try { base = new URL(baseUrl) } catch { throw new Error('baseUrl 不是有效网址') }
    requireCondition(['https:', 'http:'].includes(base.protocol) && !base.username && !base.password &&
      !base.search && !base.hash && base.pathname === '/', 'baseUrl 必须为无凭据、无参数的网站根网址')
    report.baseUrl = base.origin
    const site = join(outputRoot, 'site')
    const manifest = JSON.parse(await readFile(join(outputRoot, 'manifest.json'), 'utf8'))
    requireCondition(manifest && typeof manifest === 'object' && !Array.isArray(manifest), '素材清单格式无效')
    const entries = Object.entries(manifest)
    requireCondition(entries.length > 0 && manifest['/index.html'], '素材清单为空或缺少 /index.html')
    // 先核对本地内容，确保后续比对针对本次发布的同一批素材。
    for (const [path, entry] of entries) {
      validatePath(path)
      requireCondition(entry && /^[a-f0-9]{32}$/.test(entry.hash) && Number.isSafeInteger(entry.size) && entry.size >= 0,
        `素材清单条目无效：${path}`)
      const buffer = await readFile(join(site, path.slice(1)))
      requireCondition(buffer.length === entry.size && assetHash(buffer, path) === entry.hash,
        `本地素材与清单不一致：${path}`)
    }
    const index = await readFile(join(site, 'index.html'))
    report.manifestAssets = entries.length
    report.localIndexSha256 = sha256(index)

    async function check(group, path, operation) {
      const checkStarted = Date.now()
      const result = { group, path, ok: false }
      report.checks.push(result)
      try {
        await operation(result)
        result.ok = true
      } catch (error) {
        // fetch 的底层异常可能包含网址或代理信息，只报告异常类别。
        result.error = error.name === 'TimeoutError' || error.name === 'AbortError'
          ? '请求或响应体读取超过 20 秒'
          : error.name === 'TypeError' ? '网络请求失败（TypeError）' : error.message
      } finally { result.durationMs = Date.now() - checkStarted }
    }

    async function request(path, options, result, operation) {
      const queryAt = path.indexOf('?')
      const rawPath = queryAt < 0 ? path : path.slice(0, queryAt)
      const encodedPath = rawPath.split('/').map(encodeURIComponent).join('/') + (queryAt < 0 ? '' : path.slice(queryAt))
      const response = await fetch(new URL(encodedPath, base.origin), {
        ...options, redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        headers: { 'Accept-Encoding': 'identity', ...options.headers },
      })
      result.status = response.status
      result.contentType = typeOf(response)
      try { await operation(response) }
      finally { await response.body?.cancel().catch(() => {}) }
    }

    await concurrent(entries, ([path, entry]) => check('asset-head', path, result =>
      request(path, { method: 'HEAD' }, result, async response => {
        requireCondition(response.status === 200, `HEAD 应为 200，实际 ${response.status}`)
        const allowed = MIME_TYPES[extname(path).toLowerCase()] || ['application/octet-stream']
        requireCondition(allowed.includes(typeOf(response)), `Content-Type 应为 ${allowed.join(' 或 ')}，实际 ${typeOf(response) || '(缺失)'}`)
        result.expectedSize = entry.size
        result.contentLength = response.headers.get('content-length')
      })))

    await concurrent(SPA_PATHS, path => check('spa', path, result =>
      request(path, { method: 'GET' }, result, async response => {
        requireCondition(response.status === 200, `SPA 应为 200，实际 ${response.status}`)
        requireCondition(typeOf(response) === 'text/html', 'SPA Content-Type 应为 text/html')
        const body = await limitedBody(response, Math.max(2 * 1024 * 1024, index.length + 256 * 1024))
        result.bytes = body.length
        result.sha256 = sha256(body)
        const canonicalPath = path === '/' ? '/' : path.replace(/\/$/u, '')
        const expected = await readFile(join(site, pageFileFor(canonicalPath)))
        if (!body.equals(expected)) {
          result.expectedBytes = expected.length
          let difference = 0
          while (difference < Math.min(body.length, expected.length) && body[difference] === expected[difference]) difference++
          result.firstDifferenceAt = difference
          throw new Error('HTML 与本路由的静态 HTML 不一致；请检查 CDN 动态注入或路由配置')
        }
        const html = body.toString('utf8')
        requireCondition(html.includes('<meta name="description"') && html.includes('<meta property="og:image"'), '路由初始 HTML 缺少分享 description / OG 图片')
        requireCondition(html.includes(`<link rel="canonical" href="${new URL(canonicalPath, siteOrigin()).href}"`), '路由 canonical 与 SITE_ORIGIN 不符')
      })))

    await concurrent(Object.entries(routeMetadata.legacyPaths), ([path, target]) => check('legacy-redirect', path, result =>
      request(`${path}?from=gallery`, { method: 'GET' }, result, async response => {
        requireCondition(response.status === 301, `旧卡链接应为 301，实际 ${response.status}`)
        const location = response.headers.get('location')
        requireCondition(location, '旧卡链接缺少 Location')
        const destination = new URL(location, base.origin)
        requireCondition(destination.origin === base.origin && destination.pathname === target && destination.searchParams.get('from') === 'gallery', '旧卡链接未保留目标或 query')
      })))

    async function rangeCheck(path, group, requirePdf = false) {
      await check(group, path, async result => {
        const entry = manifest[path]
        requireCondition(entry && entry.size >= 64, '本地清单缺少该素材或素材不足 64 字节')
        const expectedPrefix = await readPrefix(join(site, path.slice(1)), 64)
        await request(path, { method: 'GET', headers: { Range: 'bytes=0-63' } }, result, async response => {
          requireCondition(response.status === 206, `Range 应为 206，实际 ${response.status}`)
          requireCondition(typeOf(response) === (requirePdf ? 'application/pdf' : 'video/mp4'),
            `Range Content-Type 应为 ${requirePdf ? 'application/pdf' : 'video/mp4'}`)
          result.contentRange = response.headers.get('content-range')
          requireCondition(result.contentRange === `bytes 0-63/${entry.size}`, `Content-Range 应为 bytes 0-63/${entry.size}，实际 ${result.contentRange}`)
          const body = await limitedBody(response, 64)
          requireCondition(body.length === 64 && body.equals(expectedPrefix), 'Range 字节内容与本地素材前 64 字节不一致')
          if (requirePdf) requireCondition(body.subarray(0, 5).toString('ascii') === '%PDF-', 'PDF 魔数不是 %PDF-')
          result.bytes = body.length
        })
      })
    }
    await concurrent(Array.from({ length: 15 }, (_, i) => `/color/color grade-${i + 1}.mp4`),
      path => rangeCheck(path, 'video-range'))
    const pdfPath = manifest['/resume.pdf'] ? '/resume.pdf' : entries.find(([path]) => extname(path).toLowerCase() === '.pdf')?.[0]
    if (pdfPath) await rangeCheck(pdfPath, 'pdf-range', true)
    else report.pdfNote = '清单中没有 PDF，跳过可选 PDF Range 验证'

    await concurrent(MISSING_PATHS, path => check('missing-404', path, result =>
      request(path, { method: 'GET' }, result, async response => {
        requireCondition(response.status === 404, `不存在路径应为 404，实际 ${response.status}${typeOf(response) === 'text/html' ? ' text/html' : ''}`)
        requireCondition(!response.headers.has('location'), '未知路径不能跳转首页')
        if (!/\.[^/]+$/u.test(path) && !path.startsWith('/.')) {
          const html = (await limitedBody(response, 2 * 1024 * 1024)).toString('utf8')
          requireCondition(html.includes('noindex, follow') && html.includes('页面未找到'), '未知页面缺少独立 404 外壳或 noindex')
        }
      })))
    report.status = report.checks.every(check => check.ok) ? 'PASS' : 'FAIL'
  } catch (error) {
    report.fatalError = error instanceof SyntaxError ? '无法读取有效的本地 JSON 清单' : error.message
  } finally {
    report.finishedAt = new Date().toISOString()
    report.durationMs = Date.now() - started
    report.total = report.checks.length
    report.passed = report.checks.filter(check => check.ok).length
    report.failed = report.total - report.passed
    report.byGroup = Object.fromEntries([...new Set(report.checks.map(check => check.group))].map(group => {
      const checks = report.checks.filter(check => check.group === group)
      return [group, { total: checks.length, passed: checks.filter(check => check.ok).length }]
    }))
    await mkdir(outputRoot, { recursive: true })
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify({
      status: report.status, total: report.total, passed: report.passed, failed: report.failed,
      durationMs: report.durationMs, byGroup: report.byGroup, reportPath,
      ...(report.fatalError ? { fatalError: report.fatalError } : {}),
      ...(report.failed ? { failures: report.checks.filter(check => !check.ok).slice(0, 12).map(({ group, path, error }) => ({ group, path, error })) } : {}),
    })}\n`)
    if (report.status !== 'PASS') process.exitCode = 1
  }
}

main().catch(error => {
  process.stdout.write(`${JSON.stringify({ status: 'FAIL', fatalError: error.message })}\n`)
  process.exitCode = 1
})
