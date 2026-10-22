import { watch } from 'vue'
import type { Router } from 'vue-router'
import metadata from '../data/routeMetadata.json'
import type { Lang } from '../data/aboutProfile'
import { subpageLanguage } from './useSubpageLanguage'

// 初始404没有canonical，仍能从构建时的OG地址恢复规范域名；后续导航不丢失它。
const canonicalOrigin = new URL(
  document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ?? document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content
    ?? window.location.origin,
).origin

/** 构建输出提供首次抓取的 head；这里同步应用内导航与语言切换。 */
export function updateRouteHead(path: string, language: Lang = subpageLanguage.value): void {
  const normalized = path === '/' ? '/' : path.replace(/\/$/u, '')
  const page = metadata.routes.find(route => route.path === normalized
    || normalized === (route.path === '/' ? '/index.html' : `${route.path}/index.html`))
  const content = page ?? metadata.notFound
  document.title = content.title[language]
  const setMeta = (attribute: 'name' | 'property', key: string, value: string) => {
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute(attribute, key)
      document.head.append(tag)
    }
    tag.content = value
  }
  setMeta('name', 'description', content.description[language])
  setMeta('name', 'robots', page ? 'index, follow' : 'noindex, follow')
  setMeta('property', 'og:title', content.title[language])
  setMeta('property', 'og:description', content.description[language])
  setMeta('property', 'og:type', 'website')
  setMeta('property', 'og:site_name', metadata.siteName[language])
  setMeta('property', 'og:locale', language === 'zh' ? 'zh_CN' : 'en_US')
  // 沿用构建时的规范域名；本地开发则使用当前 origin。
  const initialCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  const origin = canonicalOrigin
  setMeta('property', 'og:image', new URL(metadata.image, origin).href)
  setMeta('property', 'og:image:alt', metadata.imageAlt[language])
  setMeta('name', 'twitter:card', 'summary_large_image')
  setMeta('name', 'twitter:title', content.title[language])
  setMeta('name', 'twitter:description', content.description[language])
  setMeta('name', 'twitter:image', new URL(metadata.image, origin).href)
  if (page) {
    const canonical = initialCanonical ?? document.createElement('link')
    canonical.rel = 'canonical'
    canonical.href = new URL(page.path, origin).href
    if (!initialCanonical) document.head.append(canonical)
    setMeta('property', 'og:url', canonical.href)
  } else {
    initialCanonical?.remove()
    document.head.querySelector('meta[property="og:url"]')?.remove()
  }
}

export function setupRouteHead(router: Router): void {
  router.afterEach((to, _from, failure) => {
    if (!failure) updateRouteHead(to.path)
  })
  watch(subpageLanguage, language => {
    updateRouteHead(router.currentRoute.value.matched.length ? router.currentRoute.value.path : window.location.pathname, language)
  })
}
