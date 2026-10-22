/**
 * 滚动行程以舞台高度为单位，尺寸变化时保持相同的观看节奏。
 * 入场 → 收拢 → 首张停留 → 从上向下逐张覆盖 → 末张停留。
 * 所有阶段都由同一个 position 决定，倒滚和快速换向不另排补间。
 */
// 相比上一版 1.3 的节奏，实际入场、收拢与擦入行程延长约 46%。
// 阅读距离放在每张完整落位之后，末张仅保留正常停留，不为旧中点约束补空等。
const STACK_PACE = 1.9
export const STACK_ENTER_END = .42 * STACK_PACE
export const STACK_FOLD_START = .18 * STACK_PACE
export const STACK_FOLD_END = .65 * STACK_PACE
const FIRST_PAGE_HOLD = .32
export const STACK_GALLERY_START = STACK_FOLD_END + FIRST_PAGE_HOLD
export const STACK_WIPE_LENGTH = .35 * STACK_PACE
const PAGE_READING_HOLD = .28
export const STACK_PAGE_STEP = STACK_WIPE_LENGTH + PAGE_READING_HOLD
const LAST_PAGE_HOLD = .56

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
// 两端速度、加速度均为零；遮罩越过章节边界时不突然改变速度。
const ease = (value: number) => {
  const p = clamp01(value)
  return clamp01(p * p * p * (p * (p * 6 - 15) + 10))
}
// 正弦减速的起始速度小于原三次减速，避免前几格滚轮就把透视叠层迅速压平。
const easeOut = (value: number) => Math.sin(clamp01(value) * Math.PI / 2)

/** 返回按钮跳转的阅读停留点，避开该页尚未展开完的遮罩段。 */
export function stackPagePosition(index: number, count: number) {
  // 所有项目名共用同一条滚动行程，并跳到该页完整静止区的正中。
  const start = index === 0 ? STACK_FOLD_END
    : STACK_GALLERY_START + (index - 1) * STACK_PAGE_STEP + STACK_WIPE_LENGTH
  const end = index === count - 1 ? stackTravel(count)
    : STACK_GALLERY_START + index * STACK_PAGE_STEP
  return (start + end) / 2
}

/** 末张完成揭示的位置；单张也保留最初的收拢行程。 */
export function stackLastPagePosition(count: number) {
  return count <= 1 ? STACK_FOLD_END
    : STACK_GALLERY_START + (count - 2) * STACK_PAGE_STEP + STACK_WIPE_LENGTH
}

/** 组件据此设置 sticky 总高度，额外末张停留属于滚动行程的一部分。 */
export function stackTravel(count: number) {
  return stackLastPagePosition(count) + LAST_PAGE_HOLD
}

/** 纯计算：position 是已滚过的舞台高度倍数；函数不读 DOM，也不自行安排补间。 */
export function stackState(position: number, count: number) {
  // 推入尚未停止时就开始收拢，避免两个独立缓动在接缝处同时归零而停顿。
  const entry = easeOut(position / STACK_ENTER_END)
  const fold = easeOut((position - STACK_FOLD_START) / (STACK_FOLD_END - STACK_FOLD_START))
  const reveals = Array.from({ length: count }, (_, i) => i === 0 ? 1
    : ease((position - STACK_GALLERY_START - (i - 1) * STACK_PAGE_STEP) / STACK_WIPE_LENGTH))
  // 标题在新画面超过一半时才更新，不能先显示一张尚未揭开的作品名。
  let active = 0
  reveals.forEach((reveal, i) => { if (reveal >= .5) active = i })
  const complete = position >= stackLastPagePosition(count)
  const phase = position < STACK_FOLD_START ? 'enter'
    : position < STACK_FOLD_END ? 'fold' : complete ? 'complete' : 'gallery'
  return { entry, fold, reveals, active, complete, phase }
}
