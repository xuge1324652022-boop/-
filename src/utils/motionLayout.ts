import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * 全站动画布局队列：先读候选位置，再按离视口的距离每帧准备一个组件。
 * 分行、测量与 ScrollTrigger 刷新共享调度，避免长页在挂载时集中阻塞标题入场。
 * 返回的取消函数归调用组件持有，卸载时释放，队列清空后不保留空转 RAF。
 */
interface Preparation {
  element: HTMLElement
  run: () => void
}

const preparations = new Map<symbol, Preparation>()
const refreshRequests = new Set<symbol>()
let warmFrame = 0
let prepareFrame = 0
let refreshFrame = 0
let preparing = false

/** 等所有组件的 DOM 准备结束后合并一次全局刷新，避免每段双语介绍重复测整页。 */
function scheduleRefresh(): void {
  if (refreshFrame || preparing || preparations.size || !refreshRequests.size) return
  refreshFrame = requestAnimationFrame(() => {
    refreshFrame = 0
    if (preparing || preparations.size) return
    if (!refreshRequests.size) return
    refreshRequests.clear()
    ScrollTrigger.refresh()
  })
}

function flushPreparation(): void {
  prepareFrame = 0
  // 先批量读取位置，再允许选中的任务写分行 DOM；可见文字优先于预热区域。
  let selected: symbol | undefined
  let distance = Infinity
  for (const [id, task] of preparations) {
    if (!task.element.isConnected) { preparations.delete(id); continue }
    const rect = task.element.getBoundingClientRect()
    const next = Math.max(0, rect.top - innerHeight, -rect.bottom)
    if (next < distance) { selected = id; distance = next }
  }
  const task = selected ? preparations.get(selected) : undefined
  if (selected) preparations.delete(selected)
  preparing = true
  try { task?.run() }
  finally {
    preparing = false
    // 一帧只处理一个组件，避免所有双语段落集中在页面挂载/resize 的同一任务里分行。
    if (preparations.size) prepareFrame = requestAnimationFrame(flushPreparation)
    else scheduleRefresh()
  }
}

/** 登记可取消的布局任务；先让首屏完成一轮绘制，再处理按距离排序的准备工作。 */
export function prepareMotionLayout(element: HTMLElement, run: () => void): () => void {
  const id = Symbol()
  preparations.set(id, { element, run })
  if (refreshFrame) { cancelAnimationFrame(refreshFrame); refreshFrame = 0 }
  if (!warmFrame && !prepareFrame && !preparing) {
    warmFrame = requestAnimationFrame(() => {
      warmFrame = 0
      prepareFrame = requestAnimationFrame(flushPreparation)
    })
  }
  return () => {
    preparations.delete(id)
    if (!preparations.size && !preparing) {
      if (warmFrame) cancelAnimationFrame(warmFrame)
      if (prepareFrame) cancelAnimationFrame(prepareFrame)
      warmFrame = prepareFrame = 0
      scheduleRefresh()
    }
  }
}

/** 合并组件间的 ScrollTrigger 刷新请求；取消只撤销当前调用方的需求。 */
export function requestMotionLayoutRefresh(): () => void {
  const id = Symbol()
  refreshRequests.add(id)
  scheduleRefresh()
  return () => {
    refreshRequests.delete(id)
    if (!refreshRequests.size && refreshFrame) {
      cancelAnimationFrame(refreshFrame)
      refreshFrame = 0
    }
  }
}
