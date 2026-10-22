// 应用入口：注册路由、装载全局样式，并交接 index.html 的静态开场幕。
// 六个子页按需加载；完整路由表见 router/index.ts。
// App.vue 持有唯一的 PageCurtain，页面组件不再各自控制换页遮罩。
import { createApp } from 'vue'
import './style.css' // 全局基础样式：reset、字体、CSS 变量
import App from './App.vue'
import { router } from './router'
import { inAppNavigation } from './composables/useTransition'
import { setupRouteHead } from './composables/useRouteHead'

const app = createApp(App).use(router)
setupRouteHead(router)
app.mount('#app')

/*
 * 区分「刷新 / 直接输地址」与「应用内跳转」。
 *
 * 首次导航时 vue-router 的 from 是 START_LOCATION，name 为 undefined；
 * 应用内任何跳转（点卡片、跳转幕、浏览器前进后退）都带着来源路由。
 * 该兼容标记供页面区分来源；实际初访与换页遮罩统一由 App.vue 决定。
 */
router.afterEach((_to, from) => {
  if (from.name) inAppNavigation.value = true
})

/*
 * 摘掉 index.html 里的静态黄幕。
 *
 * ⚠️ 摘除时机是这里唯一容易踩的坑。
 *    之前用「1.5s 后无条件摘除」，实测在慢网络下会露出空窗：
 *    黄幕 1.5s 消失 → GalleryView 的异步 chunk 还在路上 →
 *    视口只剩 body 的 #0a0a0a → 又是闪黑。
 *
 *    正确信号是「路由的首屏视图已经真正画出来」：
 *      router.isReady()  = 初始导航完成（含懒加载 chunk 与其 CSS）
 *      + 两帧 rAF        = 确保这一帧已经上屏，而不只是 DOM 就绪
 *    之后不管走哪条路由，视口都已经被视图自己的幕布覆盖了
 *    （/ 是 Preloader 的黄幕，/cards 与子页是 PageCurtain），摘掉无感。
 *
 * 另外两条退路：
 *   · 'preloader-complete'：Preloader 撕裂结束时会再喊一次，摘掉同样无感
 *   · 8s 硬兜底：万一上面全部失灵（脚本报错等），也不能把用户永久挡住
 * 摘除必须从 DOM 里 .remove()，不能用 display:none / class 切换 ——
 * 否则 Vue 之后再挂上 Preloader，两者会叠在一起。
 */
const splash = document.getElementById('boot-splash')
if (splash) {
  let removed = false
  /** 幂等摘除（三条退路都会调它，必须只生效一次）。 */
  const removeSplash = () => {
    if (removed) return
    removed = true
    splash.remove()
  }
  router.isReady().then(
    () => {
      // 双 rAF：第一帧等 Vue 把 DOM 刷进去，第二帧确认它已经上屏
      requestAnimationFrame(() => requestAnimationFrame(removeSplash))
    },
    // 初始路由失败时露出 App 的重试出口，不让静态开场幕继续挡住它。
    removeSplash,
  )
  window.addEventListener('preloader-complete', removeSplash, { once: true })
  // 纯兜底：8s 后无论如何放行
  setTimeout(removeSplash, 8000)
}
