import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { routeCurtainBlocked } from '../composables/usePageCurtain'
import { jumpPathFor } from '../composables/useTransition'

/**
 * 路由表：
 *   /              首页：六卡 CSS-3D 画廊
 *   /cards         卡片列表页：3D 堆叠 + 每张卡独立放大 + 全局遮罩转场
 *   /card/:id      兼容旧卡片入口
 *   /edit         02 / EDIT 的剪辑主题页
 *   /news         04 / NEWS 的新闻影像主题页
 *   /color         03 / COLOR：15 段调色成片、轻量预览与滚动叙事
 *   /about         01 / ABOUT：人物照片、完整经历、AI 工作流与联系方式
 *   /poster        05 / POSTER：实习海报叠层、空间构图与个人作品
 *   /photo         06 / PHOTO 的专属子页：色彩章节（滚动推进）+ 松散画廊（可拖动单张）
 *   *              独立 404 页面，保留错误地址
 *
 * 两种入口共用六个章节落点；子页 query.from 保留返回画廊或列表的来源。
 * 各页懒加载，避免进入任一子页时连带下载首页与其他页面的代码。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'gallery',
    component: () => import('../views/GalleryView.vue'),
  },
  {
    path: '/cards',
    name: 'cards',
    component: () => import('../views/CardListView.vue'),
  },
  {
    // 六个旧卡号统一进入现有正式子页，不能让 01/03/05/06 落入过期占位页。
    path: '/card/:id(0[1-6])',
    redirect: to => ({ path: jumpPathFor(String(to.params.id)), query: to.query, hash: to.hash }),
  },
  {
    path: '/edit',
    name: 'edit',
    component: () => import('../views/EditView.vue'),
  },
  {
    path: '/news',
    name: 'news',
    component: () => import('../views/NewsView.vue'),
  },
  {
    /*
     * 03 / COLOR 的专属落点。
     *
     * 走独立路径而不是 /card/03：那是**占位页**（黑底 + 大字编号），
     * 而这里要的是一整页白底滚动叙事（15 段真实调色成片 + 双语逐行揭示），
     * 两者的版式、背景、滚动行为都不是一回事。
     *
     * ⚠️ 必须排在兜底路由**之前**，否则会被 `*` 吃掉重定向回首页。
     */
    path: '/color',
    name: 'color',
    component: () => import('../views/ColorView.vue'),
  },
  {
    /*
     * 01 / ABOUT 的专属落点：人物专题页。
     *
     * 与 /color 一样拥有独立页面结构。两者都不走
     * 通用占位页 `/card/NN`，而是各自一条独立路由，由 useTransition 的
     * jumpPathFor 分流。
     *
     * ⚠️ 同样必须排在兜底路由之前。
     */
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
  },
  {
    /*
     * 05 / POSTER 的专属落点：海报与版面页（暖色纸）。
     *
     * 与 /color、/about 同构 —— 由 useTransition 的 jumpPathFor 分流。
     * ⚠️ 同样必须排在兜底路由之前，否则会被 `*` 吃掉重定向回首页。
     */
    path: '/poster',
    name: 'poster',
    component: () => import('../views/PosterView.vue'),
  },
  {
    /*
     * 06 / PHOTO 的专属落点：摄影页。
     *
     * ⚠️ 路径是 `/photo`（单数），与卡号 06 对应，别写成 `/photos`。
     * ⚠️ 同样必须排在兜底路由之前。
     */
    path: '/photo',
    name: 'photo',
    component: () => import('../views/PhotoView.vue'),
  },
  // 保留坏链便于修正；HTTP 404 由部署层与 Vite 预览中间件共同提供。
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue') },
]

// 静态服务器可直接提供这些真实 HTML；客户端统一进入规范路径，
// 避免幕布、索引及页面状态把物理入口误认成另一条路由。保留分享参数与锚点。
for (const route of [...routes]) {
  if (!route.name || route.name === 'not-found') continue
  const canonicalPath = route.path
  routes.splice(routes.length - 1, 0, {
    path: canonicalPath === '/' ? '/index.html' : `${canonicalPath}/index.html`,
    redirect: to => ({ path: canonicalPath, query: to.query, hash: to.hash, replace: true }),
  })
}

let preparedScrollTarget = ''

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, _from, savedPosition) => {
    const prepared = preparedScrollTarget === to.fullPath
    preparedScrollTarget = ''
    // 后退/前进恢复离开时的阅读位置，优先于地址中可能仍保留的旧章节 hash。
    if (savedPosition) return savedPosition
    // 刷新带章节 hash 的地址应落到该章节；未知/损坏 hash 仍安全回顶。
    if (to.hash) {
      try {
        const element = document.getElementById(decodeURIComponent(to.hash.slice(1)))
        if (element) return { el: element, top: 24, behavior: 'instant' }
      } catch { /* 无效编码不应让整次导航的 scrollBehavior reject。 */ }
    }
    // 全遮挡期间已在旧页面归零，避免新长页刚挂载时再次 scrollTo，
    // 把整页强制布局挤到标题入场的同一个主线程任务中。
    if (prepared) return false
    return { top: 0 }
  },
})

// 懒加载组件与守卫均成功、旧视图尚未卸载时才归零。
// 只在全遮挡的跨页导航中预处理，失败导航与同页锚点不提前改动可见页面。
router.beforeResolve((to, from) => {
  if (from.name && to.path !== from.path && routeCurtainBlocked.value) {
    if (window.scrollY || window.scrollX) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    preparedScrollTarget = to.fullPath
  }
})
