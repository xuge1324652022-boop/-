// 整个体验所依赖的状态机。
// 它刻意与 CSS 使用的渲染级 `phase` 分开：这里描述的是「观看者处在哪个阶段」，
// 因此转场可以被打断、被查询、被断言，而不必深入动画内部去取状态。

// 下面两个类型都只在本文件里用（`ChapterPhase` 给状态机当词汇，
// `ChapterMachine` 当 `createChapterMachine` 的返回类型），全项目没有
// 第二处 import —— 所以不导出。要显式标注状态机变量时再加回 export。
type ChapterPhase =
  | 'gallery' // 六张卡在环上，没有选中任何一张
  | 'chapterTransition' // 整个空间正在移动，此时输入被冻结
  | 'chapter' // 已进入某一章
  | 'chapterLeaving' // 正在退回环上

interface ChapterMachine {
  readonly current: ChapterPhase
  set(next: ChapterPhase): void
  is(next: ChapterPhase): boolean
  /** 为 true 时观看者无法操作：不能拖拽、不能滚轮、不能点卡片。 */
  readonly frozen: boolean
}

/**
 * 创建章节状态机。
 * @param onChange 状态发生**实际变化**时的回调（设成相同值不会触发）
 */
export function createChapterMachine(
  onChange?: (next: ChapterPhase) => void,
): ChapterMachine {
  let current: ChapterPhase = 'gallery'
  return {
    get current() {
      return current
    },
    /** 推进到下一阶段。**幂等**：与当前值相同则直接返回，不重复触发 onChange。 */
    set(next: ChapterPhase) {
      // 幂等：设成当前值直接返回，避免重复回调导致动画被无谓重启
      if (next === current) return
      current = next
      onChange?.(next)
    },
    /** 当前是不是某个阶段。只读查询，不改状态。 */
    is(next: ChapterPhase) {
      return current === next
    },
    // 转场进行中与退回途中都算冻结。
    // 这两个阶段卡片位置仍在变化，此时若让用户拖拽或点击，
    // 会落到「动画走到一半」的诡异中间态
    get frozen() {
      return current === 'chapterTransition' || current === 'chapterLeaving'
    },
  }
}
