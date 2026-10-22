import { ref } from 'vue'

/**
 * 转场系统的共享状态。
 *
 * 画廊的聚焦卡号、点击锁和历史恢复面包屑跨路由保存。
 * App.vue 消费 jumpTarget，实际幕布状态由 usePageCurtain 管理；
 * 本文件保留旧交互入口的兼容标记，避免画廊与新路由系统各自发起一次转场。
 */

/** 旧卡片交互的遮罩兼容标记；实际 PageCurtain 可见性由 routeCurtainActive 驱动。 */
export const overlayActive = ref(false)

/** 转场进行中标志 —— 约束 7：转场期间忽略新的点击，处理快速连点。 */
export const isTransitioning = ref(false)

/** 旧遮罩覆盖时长的兼容导出（ms）；现行弧形幕时长定义在 PageCurtain.vue。 */
export const OVERLAY_COVER_MS = 300

/** 旧遮罩揭幕时长的兼容导出（ms），不参与现行路由揭幕计时。 */
export const OVERLAY_REVEAL_MS = 400

/**
 * 跳转目标卡编号（'01'..'06'）。非 null 表示画廊发起的导航尚未交接完毕。
 *
 * 用途：画廊里卡片铺满全屏后再点击，由 App.vue 路由守卫覆盖、等待、揭幕，
 * 进入 jumpPathFor 返回的独立子页；不再依赖百分比计数器切页。
 * 它同时充当「是否正在跳转」的标志，所以用 null 而不是布尔值。
 */
export const jumpTarget = ref<string | null>(null)

/**
 * 跳转前被铺满全屏的那张卡的下标（0..5）。
 *
 * 浏览器**后退**回画廊时用它把那张卡重新展开、铺满全屏 —— 即「回到动画
 * 主界面时，要再把卡片展开、覆盖全屏的动画展示一遍」。
 * 只在内存里，刷新即失效：刷新 `/` 就该走正常的开场流程。
 */
export const lastFocusedCard = ref<number | null>(null)

/**
 * 离开画廊那一刻，`/` 这条历史条目的 position（vue-router 写进
 * `history.state` 的自增序号）。
 *
 * 用来判断「这次进 `/` 是后退回来的，还是新推出来的」：
 *   · 后退 → 回到更早的条目，当前 position ≤ 记录的 position
 *   · 程序化导航（占位页的「← 返回作品集」）→ 新推一条，position 更大
 * 只有后退才重放「卡片展开 → 铺满全屏」；新推出的仍播完整开场。
 *
 * ⚠️ 为什么不用 popstate 监听：实测（`outputs/_probe-back.cjs`）`GalleryView` 的 setup
 *    比任何我们能在 main.js 里注册的 popstate 监听都先执行 —— vue-router 在
 *    `./router` 模块求值阶段就已经挂上自己的监听了，抢不到。
 *    而 history.state.position 在组件 setup 时就已经是最终值，不依赖顺序。
 */
export const galleryLeavePosition = ref<number | null>(null)

/**
 * 兼容的来源标记：main.js 在首个应用内导航后置 true，刷新重新回到 false。
 * 现行页面不再据此各自播加载器，首访与换页门禁由 App.vue 统一持有。
 */
export const inAppNavigation = ref(false)

/**
 * 面包屑载荷：子页的规范卡号 + 子页那条历史记录的 `position`。
 *
 * `position` 用来做**序位比较**（见 GalleryView 的 `entryIsBeforeSubpage`）：
 * 后退回 `/` 时当前条目必然排在子页条目**之前**，而程序化 push 到 `/`
 * 会拿到更大的 position。这条判据不依赖任何浏览器语义，刷新也照样成立。
 */
export type SubpageVisit = { id: string; position: number | null }

/**
 * 「本次会话里，上一个显示过的页面是某个卡片子页」的面包屑。
 *
 * 存在的理由：`history.state.forward` 兜不住这个场景。
 *
 * ⚠️ 曾经的写法是拿 `history.state.forward`（vue-router 写在历史条目上的
 *    「下一条」）当判据。实测（`outputs/_probe-subpage-back.cjs`，2026-10-10，Edge）
 *    它在**每一步都是 `null`** —— 跨文档后退时没有任何存活的文档去改写
 *    目标条目的 state，所以那条分支从来没生效过，专属页刷新后按后退
 *    一律重播开场。别再写回去。
 *
 * ⚠️ 另一个曾经的候选是 `PerformanceNavigationTiming.type`。源码注释一度
 *    断言它在「子页刷新过再后退」时是 'reload'（因为中间那次 reload 把
 *    条目改了标记）。实测**是 'back_forward'**，那个断言是错的。现在它
 *    是两条判据之一（见 GalleryView 的 `documentIsBackForward`），但
 *    仍然**不能单独用** —— SPA 内部导航不会改变文档的 load type。
 *
 * 于是自己留面包屑，且**读一次就删**：
 *   · 子页挂载 → 写下「我来过」（刷新子页会再写一次，正好）
 *   · 画廊挂载 → 读一次并立刻删掉
 *   · 刷新 `/`  → 上次进 `/` 时已经消费掉了 → 读不到 → 播完整开场
 *   · 后退到 `/` → 上一个页面确实是子页 → 读到 → 认出是哪张卡
 *
 * ⚠️ 用 sessionStorage 而不是 localStorage：只对当前标签页有效，
 *    新开一个标签访问 `/` 仍然是干净的首访。
 */
const SUBPAGE_BREADCRUMB = 'wb:lastSubpage'

/** 子页挂载时留下痕迹：本次会话里刚显示过某个卡片子页。 */
export function markSubpageVisit(id: string): void {
  try {
    const position =
      (window.history.state as { position?: number } | null)?.position ?? null
    const payload: SubpageVisit = { id, position }
    sessionStorage.setItem(SUBPAGE_BREADCRUMB, JSON.stringify(payload))
  } catch {
    // 隐私模式 / 存储被禁用：拿不到面包屑就退回「播完整开场」，不致命
  }
}

/**
 * 画廊挂载时读一次面包屑并**立刻消费（删掉）**。
 * 必须删 —— 否则下一次刷新 `/` 还会读到它，开场就再也不播了。
 */
export function consumeSubpageVisit(): SubpageVisit | null {
  try {
    const raw = sessionStorage.getItem(SUBPAGE_BREADCRUMB)
    if (raw === null) return null
    sessionStorage.removeItem(SUBPAGE_BREADCRUMB)
    // 旧格式（纯卡号字符串）仍认，position 缺失时退化为只靠 load type 判定
    if (!raw.startsWith('{')) return /^0[1-6]$/u.test(raw) ? { id: raw, position: null } : null
    const parsed = JSON.parse(raw) as Partial<SubpageVisit>
    if (typeof parsed.id !== 'string' || !/^0[1-6]$/u.test(parsed.id)) return null
    return {
      id: parsed.id,
      position: typeof parsed.position === 'number' && Number.isFinite(parsed.position) ? parsed.position : null,
    }
  } catch {
    return null
  }
}

/** 发起一次跳转。已经在跳转中则忽略（等价于快速连点防护）。 */
export function startJump(id: string): void {
  if (jumpTarget.value) return
  jumpTarget.value = id
}

/**
 * 跳转幕底下该切到哪条路由 —— 按卡片**分流**。
 *
 * 01 / ABOUT → 人物专题与经历（`/about`）
 * 02 / EDIT  → 剪辑主题页（`/edit`）
 * 03 / COLOR → 白底滚动叙事页（`/color`）
 * 04 / NEWS  → 新闻影像主题页（`/news`）
 * 05 / POSTER → 海报与版面页（`/poster`）
 * 06 / PHOTO  → 摄影页（`/photo`）
 * 六张卡片均有独立落点，旧 `/card/01` 至 `/card/06` 统一由路由表重定向兼容
 *
 * ⚠️ 写成**映射表**而不是 if 链：`/cards` 的点击处理也要按同一张表分流
 *    （它自己拼 `/card/${id}` 的旧写法会把 05 / 06 送到占位页 —— 卡片列表上
 *    点「海报」「摄影」进的是黑底大字编号页，而画廊里点同一张卡进的是专属页）。
 *    一张表只有一处真相。
 */
const CHAPTER_PATHS: Record<string, string> = {
  '01': '/about',
  '02': '/edit',
  '03': '/color',
  '04': '/news',
  '05': '/poster',
  '06': '/photo',
}

/**
 * @param id 两位卡号 '01'..'06'
 * @returns 该卡的专属路径；没有专属页的卡回落到 `/card/NN`
 */
export function jumpPathFor(id: string): string {
  return CHAPTER_PATHS[id] ?? `/card/${id}`
}

/**
 * 子页写面包屑时用**规范卡号**：'01'..'06'。
 *
 * `/color` 不是 `/card/NN`，如果按路径去反推卡号就得再写一个正则分支。
 * 统一成规范卡号（`/color` 写 '03'），画廊侧只需要一个 `Number(id) - 1`
 * 就能还原，将来再给别的卡加专属页也不用改画廊。
 */
export const COLOR_PAGE_ID = '03'
export const ABOUT_PAGE_ID = '01'
export const POSTER_PAGE_ID = '05'
export const PHOTO_PAGE_ID = '06'

/** 揭幕开始或导航取消时清掉画廊目标；实际输入锁仍由全局幕布单独管理。 */
export function endJump(): void {
  jumpTarget.value = null
}
