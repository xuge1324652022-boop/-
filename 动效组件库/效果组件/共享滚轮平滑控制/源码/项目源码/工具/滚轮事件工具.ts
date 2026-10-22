/**
 * 滚轮位移归一化 —— `useSmoothScroll`（页面阻尼）用它把「一次滚轮」折算成像素。
 *
 * 为什么要单独一个文件：不同浏览器的 deltaMode 语义不同（deltaMode=1 是「行」，
 * 一次滚轮只算 3px）。折算规则一旦分叉，同一个手势就会被两套刻度理解 ——
 * 早先它同时被页面阻尼和封页闸门引用，正是因为分叉过一次才抽出来的。
 * 封页闸门（CurtainScene）已整体作废删除，但这份折算仍然是页面阻尼的尺子。
 */

/**
 * 单次滚轮事件的最大位移（px）。
 *
 * 只用来挡**病态值**（某些驱动会送 deltaY = 1e5 这种「跳到底」），
 * **不是**用来限速的：真正的手感来自指数阻尼。设小了（试过 180）会把
 * 快速拨轮 / 触控板一甩整段砍掉，页面跟不上手指，比原生还涩。
 *
 * 不导出：只有下面这一个函数用它。谁需要限速，应该去调自己的阻尼，
 * 而不是把这个数字当公共旋钮。
 */
const WHEEL_MAX_STEP = 1000

/**
 * @param e         原始滚轮事件
 * @param viewportH 视口高度 —— `deltaMode === 2`（按页）时要拿它折算
 */
export function normalizeWheelDelta(e: WheelEvent, viewportH: number): number {
  // deltaMode：0 = 像素，1 = 行，2 = 页。Firefox 与部分鼠标送 1 / 2，
  // 不折算的话一次滚轮只动 3px，手感像卡住。
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewportH : 1
  const px = e.deltaY * unit
  return px < -WHEEL_MAX_STEP ? -WHEEL_MAX_STEP : px > WHEEL_MAX_STEP ? WHEEL_MAX_STEP : px
}
