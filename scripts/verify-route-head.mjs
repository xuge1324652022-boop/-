/** 无浏览器的页面交付回归；--dist 同时核对实际构建产物。 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { cloudflareRedirects, normalizeRoutePath, pageFileFor, renderRouteHtml, routeMetadata, siteOrigin } from './route-pages.mjs'
import worker from '../deploy/media-range.mjs'

const template = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const config = JSON.parse(await readFile(new URL('../deploy/cloudflare-assets.json', import.meta.url), 'utf8'))
const nginx = await readFile(new URL('../deploy/nginx.conf', import.meta.url), 'utf8')
assert.equal(config.assets.config._redirects, cloudflareRedirects(), '部署路由规则必须与共享元数据一致')
assert.equal(config.assets.config.not_found_handling, 'none', '不能开启所有坏链返回200的SPA fallback')
assert(nginx.includes('error_page 404 /not-found.html;'))
assert(!nginx.includes('try_files $uri $uri/ /index.html;'), 'Nginx不能把坏链伪装成首页')
const serverHeaders = nginx.slice(0, nginx.indexOf('location / {'))
assert(serverHeaders.includes('add_header Cache-Control "no-cache";'), '正式路由HTML必须继承服务器级no-cache')
assert.match(nginx, /location = \/color\/index\.html \{\s*try_files \$uri =404;\s*\}/u, '调色页物理HTML不能继承媒体长缓存')
assert.match(nginx, /location \^~ \/assets\/ \{[\s\S]*?public, immutable/u)
assert.match(nginx, /location = \/not-found\.html \{\s*add_header Cache-Control "no-store" always;/u)
const titles = new Set()
for (const page of routeMetadata.routes) {
  const html = renderRouteHtml(template, page.path, 'https://example.test')
  assert.match(html, /<meta name="description" content="[^"<>]+"/u)
  assert.match(html, /<meta property="og:image" content="https:\/\/example\.test\/[^"<>]+\.jpg"/u)
  assert(html.includes(`<link rel="canonical" href="https://example.test${page.path}"`))
  assert(html.includes(`<title>${page.title.zh}</title>`))
  assert.equal((html.match(/<title>/gu) || []).length, 1)
  titles.add(page.title.zh)
  assert(nginx.includes(pageFileFor(page.path)), `Nginx缺少页面HTML：${page.path}`)
  const withQuery = renderRouteHtml(template, `${page.path === '/' ? '' : page.path}/`, 'https://example.test')
  assert.equal(withQuery, html, '尾斜线必须沿用同一规范页面')
  const physicalPath = `/${pageFileFor(page.path)}`
  assert.equal(normalizeRoutePath(physicalPath), page.path)
  assert.equal(renderRouteHtml(template, physicalPath, 'https://example.test'), html, '物理HTML入口沿用正式页面head')
}
assert.equal(titles.size, routeMetadata.routes.length)
assert.equal(normalizeRoutePath('/unknown/index.html'), '/unknown/index.html')
assert.throws(() => siteOrigin('https://example.test/nested'), /SITE_ORIGIN/u)
assert.throws(() => siteOrigin('https://user:password@example.test'), /SITE_ORIGIN/u)
assert.throws(() => siteOrigin('javascript:alert(1)'), /SITE_ORIGIN/u)
const notFound = renderRouteHtml(template, '/bad-link', 'https://example.test')
assert(notFound.includes('noindex, follow'))
assert(!notFound.includes('rel="canonical"'))
assert(!notFound.includes('property="og:url"'))

// 验证真正的生产 Worker：错误页面是404且不重定向；静态资源仍真实委托。
for (const method of ['GET', 'HEAD']) {
  const seen = []
  const env = { ASSETS: { async fetch(request) {
    const path = new URL(request.url).pathname
    seen.push(path)
    return new Response(method === 'HEAD' ? null : path === '/not-found.html' ? notFound : 'missing', {
      status: path === '/not-found.html' ? 200 : 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } } }
  const response = await worker.fetch(new Request('https://example.test/bad-link?from=share', { method, headers: { Accept: 'text/html' } }), env)
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('location'), null)
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex')
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(seen, ['/bad-link', '/not-found.html'])
  assert.equal(method === 'HEAD' ? response.body : await response.text(), method === 'HEAD' ? null : notFound)
}
for (const path of ['/assets/missing.js', '/color/missing.mp4', '/.git/config']) {
  let calls = 0
  const env = { ASSETS: { async fetch() { calls++; return new Response('missing', { status: 404 }) } } }
  const response = await worker.fetch(new Request(`https://example.test${path}`), env)
  assert.equal(response.status, 404)
  assert.equal(calls, 1, path)
}
{
  const upstream = new Response('denied', { status: 403 })
  const response = await worker.fetch(new Request('https://example.test/private'), { ASSETS: { fetch: () => upstream } })
  assert.equal(response, upstream, '非404错误不能伪装成404')
}

if (process.argv.includes('--dist')) {
  const root = new URL('../dist/', import.meta.url)
  for (const page of routeMetadata.routes) {
    const html = await readFile(new URL(pageFileFor(page.path), root), 'utf8')
    assert.equal(renderRouteHtml(html, page.path), html, `实际构建 head 不正确：${page.path}`)
    assert.match(html, /<script[^>]+type="module"[^>]+\/assets\//u)
    assert(!html.includes('/src/main.js') && !html.includes('/src/main.ts'))
  }
  const html = await readFile(new URL('not-found.html', root), 'utf8')
  assert.equal(renderRouteHtml(html, '/bad-link'), html)
  const image = await readFile(new URL(routeMetadata.image.slice(1), root))
  assert(image.length > 0)
  assert.deepEqual([...image.subarray(0, 2)], [0xff, 0xd8], '分享图必须是实际JPEG')
  // 每个输出仍使用同一份编译入口与样式，不能重新打包八套运行时代码。
  const entries = await Promise.all(routeMetadata.routes.map(async page => {
    const source = await readFile(new URL(pageFileFor(page.path), root), 'utf8')
    return source.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/u)?.[1]
  }))
  assert.equal(new Set(entries).size, 1)
  console.log(`PASS: ${routeMetadata.routes.length} 个实际路由HTML、分享head/JPEG、共用JS入口、独立404`)
} else {
  console.log(`PASS: ${titles.size} 个独立head、规范域名验证、共享路由规则、Worker GET/HEAD真实404与静态委托`)
}
