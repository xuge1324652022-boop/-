/** 给分享爬虫提供不依赖 JavaScript 的逐路由 head，并保留 SPA 的客户端导航。 */
import { readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export const routeMetadata = JSON.parse(readFileSync(new URL('../src/data/routeMetadata.json', import.meta.url), 'utf8'))
const siteConfig = JSON.parse(readFileSync(new URL('../deploy/site-config.json', import.meta.url), 'utf8'))
export const pageFileFor = path => path === '/' ? 'index.html' : `${path.slice(1)}/index.html`
export function normalizeRoutePath(path) {
  const normalized = path === '/' ? '/' : path.replace(/\/$/u, '')
  // 只识别实际输出的八个 HTML 入口，未知目录下的 index.html 仍是坏链。
  return routeMetadata.routes.find(route => normalized === `/${pageFileFor(route.path)}`)?.path ?? normalized
}

export function siteOrigin(value = process.env.SITE_ORIGIN || siteConfig.siteOrigin) {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_ORIGIN 必须是无路径、参数与凭据的 HTTP(S) 网站根网址')
  }
  return url.origin
}

const escape = value => String(value).replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
export function renderRouteHtml(html, path, origin = siteOrigin()) {
  const page = routeMetadata.routes.find(route => route.path === normalizeRoutePath(path))
  const content = page ?? routeMetadata.notFound
  const image = new URL(routeMetadata.image, origin).href
  const entries = [
    `<title>${escape(content.title.zh)}</title>`,
    `<meta name="description" content="${escape(content.description.zh)}" />`,
    `<meta name="robots" content="${page ? 'index, follow' : 'noindex, follow'}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:site_name" content="${escape(routeMetadata.siteName.zh)}" />`,
    `<meta property="og:title" content="${escape(content.title.zh)}" />`,
    `<meta property="og:description" content="${escape(content.description.zh)}" />`,
    `<meta property="og:image" content="${escape(image)}" />`,
    `<meta property="og:image:alt" content="${escape(routeMetadata.imageAlt.zh)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(content.title.zh)}" />`,
    `<meta name="twitter:description" content="${escape(content.description.zh)}" />`,
    `<meta name="twitter:image" content="${escape(image)}" />`,
  ]
  if (page) {
    const canonical = new URL(page.path, origin).href
    entries.push(`<link rel="canonical" href="${escape(canonical)}" />`, `<meta property="og:url" content="${escape(canonical)}" />`)
  }
  const head = `<!-- route-head:start -->\n    ${entries.join('\n    ')}\n    <!-- route-head:end -->`
  if (!/<!-- route-head:start -->[\s\S]*?<!-- route-head:end -->/u.test(html)) throw new Error('index.html 缺少 route-head 标记')
  return html.replace(/<!-- route-head:start -->[\s\S]*?<!-- route-head:end -->/u, head)
}

export function cloudflareRedirects() {
  const lines = routeMetadata.routes.flatMap(({ path }) => path === '/'
    ? [`/ /index.html 200`]
    : [`${path} /${pageFileFor(path)} 200`, `${path}/ /${pageFileFor(path)} 200`])
  for (const [from, to] of Object.entries(routeMetadata.legacyPaths)) lines.push(`${from} ${to} 301`, `${from}/ ${to} 301`)
  return `${lines.join('\n')}\n`
}

/** Vite 8 的 generateBundle 后置钩子复制已编译的 HTML，不增加第二套 JS 入口。 */
export function routePages() {
  let config
  const middleware = (server, preview) => async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next()
    let url
    try { url = new URL(req.url || '/', 'http://vite.local') } catch { return next() }
    let path
    try { path = decodeURIComponent(url.pathname) } catch { res.statusCode = 400; res.end('bad request'); return }
    if (path.includes('\\') || path.split('/').some(part => part === '..')) return next()
    if (/^\/(?:@|src\/|node_modules\/)/u.test(path)) return next()
    const normalized = normalizeRoutePath(path)
    const legacy = routeMetadata.legacyPaths[normalized]
    if (legacy) {
      res.statusCode = 301
      res.setHeader('Location', `${legacy}${url.search}`)
      res.end()
      return
    }
    const page = routeMetadata.routes.find(route => route.path === normalized)
    const wantsHtml = (req.headers.accept || '').includes('text/html') || !/\.[^/]+$/u.test(path)
    if (!page && !wantsHtml) return next()
    if (!page) {
      // 真实静态文件仍交给 Vite（例如用户直接打开 /resume.pdf）。
      const publicBase = preview ? resolve(config.root, config.build.outDir) : config.publicDir
      if (publicBase && (await stat(join(publicBase, path)).catch(() => null))?.isFile()) return next()
    }
    try {
      const html = preview
        ? await readFile(join(config.root, config.build.outDir, page ? pageFileFor(page.path) : 'not-found.html'), 'utf8')
        : await server.transformIndexHtml(url.pathname, await readFile(join(config.root, 'index.html'), 'utf8'), req.url)
      const output = renderRouteHtml(html, page?.path || '/__not-found__')
      res.statusCode = page ? 200 : 404
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Length', Buffer.byteLength(output))
      res.end(req.method === 'HEAD' ? undefined : output)
    } catch (error) { next(error) }
  }
  return {
    name: 'route-pages',
    configResolved(resolved) { config = resolved },
    transformIndexHtml: { order: 'post', handler(html, context) {
      const path = context.server ? new URL(context.originalUrl || context.path, 'http://vite.local').pathname : '/'
      return renderRouteHtml(html, path)
    } },
    generateBundle: { order: 'post', handler(_options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') throw new Error('构建没有输出 index.html')
      const html = String(index.source)
      for (const page of routeMetadata.routes) {
        if (page.path !== '/') this.emitFile({ type: 'asset', fileName: pageFileFor(page.path), source: renderRouteHtml(html, page.path) })
      }
      this.emitFile({ type: 'asset', fileName: 'not-found.html', source: renderRouteHtml(html, '/__not-found__') })
    } },
    configureServer(server) { server.middlewares.use(middleware(server, false)) },
    configurePreviewServer(server) { server.middlewares.use(middleware(server, true)) },
  }
}
