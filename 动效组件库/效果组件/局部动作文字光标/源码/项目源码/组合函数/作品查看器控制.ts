/**
 * 完整作品查看器的开关状态 —— **模块级单例**。
 *
 * 为什么做成模块级而不是每屏各持一份：
 *   摄影精选、作品带、照片到版面、以及子页的序列与画廊，全都要「点开大图」，
 *   但**全页只该有一个查看器实例**。如果每个组件各自 `v-if` 一份，同时打开两个
 *   弹层时滚动锁、Escape、焦点会互相打架（后开的那个摘掉 `no-scroll`，页面就能滚了）。
 *   这与 `useCursor.ts` 的 `cursorLockState` 是同一个思路。
 *
 * ⚠️ 滚动位置与触发元素**在打开时就记下来**，关闭时还原：
 *   方案明确要求「关闭后恢复滚动位置与触发按钮焦点」。键盘用户关掉大图后
 *   如果焦点掉回 body，Tab 会从页头重新开始 —— 那是比「没恢复滚动」更烦的问题。
 *
 * ⚠️ 2026-10-10 扩展成**一组**作品（`/photo` 要 01/06 计数 + 缩略图 + 左右切换）。
 *    为了不破坏 `/about` 的单张用法，`open(item, el)` 仍然只开一张 ——
 *    它内部就是 `openAt([item], 0, el)`，`total` 为 1 时查看器不渲染任何翻页 UI。
 */

import { computed, nextTick, ref, type ComputedRef } from 'vue'
import type { VisualAsset } from '../数据/视觉作品资料'

/** 当前显示的作品；null = 关闭 */
const active = ref<VisualAsset | null>(null)
/** 本次打开的一组作品（单张时长度为 1） */
const list = ref<readonly VisualAsset[]>([])
/** 当前项在 `list` 中的下标 */
const index = ref(0)
/** 打开它的那个按钮：关闭后焦点要还回去 */
const trigger = ref<HTMLElement | null>(null)
/** 打开前的滚动位置 */
let savedScrollY = 0
/**
 * 关闭恢复任务：`close()` 在 `nextTick` + 一帧之后才 `scrollTo` / 还焦点。
 *
 * ⚠️ 这段延迟恢复**必须可取消**（2026-10-10 修）：用户关掉大图后立刻切路由，
 *    恢复任务会在新页面上跑，把**新页面**滚到一个陈旧坐标、焦点也还给一个
 *    已经离开文档的按钮。`reset()` 也必须取消它 —— 路由离开走的就是 reset。
 * ⚠️ 用**版本号**而不是「取消就置 0」：`requestAnimationFrame` 回调已经排队、
 *    取消不掉时，版本号对不上就直接 return，比 `cancelAnimationFrame` 更保险。
 */
let restoreRaf = 0
let restoreVersion = 0

/** 组内作品数（模板用；为 1 时不显示翻页 UI） */
const total: ComputedRef<number> = computed(() => list.value.length)

/** 取消尚未执行的关闭恢复（scrollTo + 焦点还原）。 */
function cancelRestore(): void {
  restoreVersion += 1
  if (restoreRaf !== 0) cancelAnimationFrame(restoreRaf)
  restoreRaf = 0
}

/**
 * 打开一组作品里的第 i 张。
 *
 * @param items 同组作品（至少一张）
 * @param i     初始下标（越界会被夹到合法范围）
 * @param el    触发元素。传进来最可靠 —— 有些浏览器点击 `<button>` 不会让它
 *              拿到焦点，只靠 `document.activeElement` 会还错地方。
 *
 * ⚠️ 打开时也要 `cancelRestore()`：上一次关闭的恢复任务若还挂着（用户关掉
 *    立刻又点开），它会把新弹层的滚动位置和焦点抢走。
 */
function openAt(items: readonly VisualAsset[], i: number, el?: HTMLElement | null): void {
  // 已经开着就不再记一次滚动位置，否则还原点会被覆盖成「大图里」的位置
  if (active.value || !items.length) return
  cancelRestore()
  savedScrollY = window.scrollY
  trigger.value = el ?? (document.activeElement as HTMLElement | null)
  list.value = items.slice()
  const safeIndex = Number.isFinite(i) ? Math.trunc(i) : 0
  index.value = Math.max(0, Math.min(safeIndex, list.value.length - 1))
  active.value = list.value[index.value] ?? null
}

/** 打开单张（`/about` 的三处作品用这个）。 */
function open(item: VisualAsset, el?: HTMLElement | null): void {
  openAt([item], 0, el)
}

/**
 * 组内前后翻。**循环**：到最后一张再往后回到第一张。
 * ⚠️ 单张时直接返回 —— 否则一次误触滚轮会把 `active` 换成自己，
 *    触发一次无意义的重新解码。
 */
function step(dir: -1 | 1): void {
  const n = list.value.length
  if (n < 2) return
  index.value = (index.value + dir + n) % n
  active.value = list.value[index.value] ?? null
}

/** 跳到指定下标（缩略图导航用）。 */
function goTo(i: number): void {
  if (i < 0 || i >= list.value.length || i === index.value) return
  index.value = i
  active.value = list.value[i] ?? null
}

/**
 * 关闭并复位。
 *
 * ⚠️ 顺序不能反：
 *   ① 先把 `active` 置空 → 查看器卸载 → 它在 `onBeforeUnmount` 里摘掉
 *      `html.no-scroll`。**在滚动锁还在的时候 `scrollTo` 是无效的**，
 *      所以必须等卸载完成（`nextTick` + 一帧）。
 *   ② 再还原滚动位置，然后才还焦点 —— 而且必须 `preventScroll: true`，
 *      否则浏览器为了把按钮滚进视口会**覆盖**掉刚还原的位置。
 */
async function close(): Promise<void> {
  if (!active.value) return
  cancelRestore()
  const version = restoreVersion
  const y = savedScrollY
  const focusTarget = trigger.value

  active.value = null
  list.value = []
  index.value = 0
  trigger.value = null

  await nextTick()
  // 等 nextTick 期间可能已经被 reset()（路由离开）或再次 open —— 两种都不该恢复
  if (version !== restoreVersion) return
  restoreRaf = requestAnimationFrame(() => {
    restoreRaf = 0
    if (version !== restoreVersion) return
    window.scrollTo(0, y)
    if (focusTarget?.isConnected) {
      focusTarget.focus({ preventScroll: true })
    }
  })
}

/**
 * 同步复位，**不做**滚动/焦点还原，并**取消**尚未执行的恢复任务。
 *
 * ⚠️ 路由离开时必须用这个，不能用 `close()`：`close()` 会在 `nextTick` + 一帧
 *    之后 `scrollTo(savedScrollY)` 并把焦点还给触发按钮 —— 那时页面已经换成
 *    下一条路由，等于把**新页面**滚到一个陈旧的坐标上。清理要的是「把状态清零」，
 *    不是「优雅关闭」。
 * ⚠️ 模块级单例的状态**不随组件卸载自动清**：`/about` 打开大图后直接后退，
 *    没人调 reset 的话 `active` 会留着旧作品，前进回这一页就自动弹出一张
 *    「上次的大图」。所以每个用查看器的页面都必须在 `onBeforeUnmount` 调它。
 */
function reset(): void {
  cancelRestore()
  active.value = null
  list.value = []
  index.value = 0
  trigger.value = null
  savedScrollY = 0
}

/**
 * 取查看器的**共享状态与操作**（模块级单例，见文件头）。
 *
 * 每个用查看器的页面都拿到同一份 `active` / `list` / `index`，
 * 所以「同时只开一个弹层」是结构保证的，不靠调用方自觉。
 * ⚠️ 用了它的页面必须在 `onBeforeUnmount` 调 `reset()`（模块级状态不随组件卸载清）。
 */
export function useVisualViewer() {
  return { active, list, index, total, open, openAt, step, goTo, close, reset, trigger }
}
