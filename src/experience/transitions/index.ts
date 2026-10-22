// 全屏卡片转场（Fullscreen Card Transition）。
//
// 这是 Level-2 的机制：点击一张卡片，只驱动 `state.focus` 从 0 走到 1，
// 此外什么都不做。galleryMotion.ts 是「任意 focus 值下每张卡在哪」的唯一
// 事实来源，所以整个转场本质上就是对**一个数字**做插值 —— 被选中的卡片
// 长大铺满视口，其余五张在原地淡出。
//
//   环上六张  →  一张铺满整屏的版面，全程仅由 state.focus 驱动
//
// ────────────────────────────────────────────────────────────────
// 回归记录（2026-09-20）：本模块早期版本曾多加过两条轨道 ——
//   1. `retreat` 轨：把其余五张卡沿 -z 往后推
//   2. `camera` 推镜：把整个舞台 scale 从 1 拉到 1.18 再回 1
// 参考站的行为里**两者都不存在**。因为轨道倾斜了 -45° 且投影是正交的，
// `z` 根本不是深度，而是屏幕上的垂直偏移（见 projectCardCorners 里的公式
// `y = ... - localZ * sin(tilt)`）。于是「把退场的卡沿 z 后推 0.6 * radius」
// 的真实效果，是让那五张卡在 0.45 秒内**整体向上平移约 115px** ——
// 而此时 focus 还接近 0，用户看到的就是「所有卡片突然上弹」的瑕疵。
// 现在整个空间只靠淡出来退场，与修复前完全一致。
// ────────────────────────────────────────────────────────────────
//
// 本模块**刻意不做**的事：
//   - 绘制章节文案或巨型字母（Chapter Content 已退役）
//   - 管理虚拟滚动轨道（已经不存在章节滚动）
//   - 绑定 DOM 行数组（全屏舞台按设计就是空的）
//   - 沿 z 移动任何卡片，或缩放整个舞台（原因见上方回归记录）
//
// `transitionToChapter()` 的终止状态与画廊静止时是同一份 DOM，
// 唯一的区别是「有一张卡占据了整个视口」—— 这就是全屏舞台。
import gsap from 'gsap'
import { focusEase, type GalleryState } from '../../utils/galleryMotion'
import { createChapterMachine } from '../state'

/** 宿主需要提供给转场模块的接口 */
export interface TransitionHost {
  /** ⚠️ 必须是同一个对象引用：GSAP 原地修改它，宿主每帧也从它读值 */
  state: GalleryState
  pointer(): { x: number; y: number }
  focusDuration(): number
  reduced(): boolean
  /** 每帧的绘制钩子。卡片摆放逻辑放在宿主自己的 render() 里。 */
  render(): void
  onEnterChapter(): void
  onReturnToGallery(): void
}

/**
 * 造一个「画廊 ↔ 章节」的转场机。
 *
 * 它只管**时间线与状态机**（何时开始、何时结束、结束后告诉宿主什么），
 * 卡片怎么摆放由宿主自己的 `host.render()` 决定 —— 转场只推 `focus` 这一个
 * 进度值，几何全在 `layoutGallery()` 里算。这样「转场」与「布局」不会互相
 * 知道对方的细节。
 *
 * ⚠️ 同一时刻只允许一条时间线：每次开始先 `kill()` 旧的，否则快速连点会
 *    留下两条同时改 `focus` 的补间（时隐时现）。
 */
export function createChapterTransition(host: TransitionHost) {
  const machine = createChapterMachine()
  let timeline: gsap.core.Timeline | null = null

  /** 停掉并丢弃当前时间线 */
  function kill() {
    timeline?.kill()
    timeline = null
  }

  /** 每帧重绘一次。转场的所有视觉都由 `state.focus` 推导，所以只需重渲染。 */
  function paint() {
    host.render()
  }

  /** 进入某一章：把 focus 推到 1 */
  function transitionToChapter(): void {
    kill()
    machine.set('chapterTransition')

    timeline = gsap.timeline({
      onUpdate: paint,
      // 铺满动画结束 → 进入 chapter 阶段并通知宿主（宿主据此切 phase 等）
      onComplete: () => {
        machine.set('chapter')
        host.onEnterChapter()
      },
    })
    // 单轨。卡片铺满全屏、其余空间在它下方淡出，两者都由 layoutGallery
    // 内部的 `state.focus` 推导而来，不需要第二条轨道。
    timeline.to(host.state, { focus: 1, duration: host.focusDuration(), ease: focusEase }, 0)
    // 无障碍：用户开启了「减少动态效果」时直接跳到终态
    if (host.reduced()) timeline.progress(1)
  }

  /** 退出章节：把 focus 收回 0 */
  function leaveChapter(): void {
    kill()
    machine.set('chapterLeaving')
    // 退回时长与当前 focus 成正比：还没铺满就退出时，动画也更短
    const duration = host.reduced() ? 0.12 : Math.max(0.45, 1.25 * host.state.focus)
    timeline = gsap.timeline({
      onUpdate: paint,
      // 收回结束 → 回到 gallery 阶段并通知宿主
      onComplete: () => {
        machine.set('gallery')
        host.onReturnToGallery()
      },
    })
    timeline.to(host.state, { focus: 0, duration, ease: focusEase }, 0)
    if (host.reduced()) timeline.progress(1)
  }

  /** 硬停：索引面板跳转和 resize 时用它，不做动画，直接停在静止态。 */
  function settle(): void {
    kill()
    machine.set('gallery')
  }

  return {
    machine,
    transitionToChapter,
    leaveChapter,
    settle,
    kill,
    paint,
    // 暴露时间线，好让调试 API 能像拖动开场时间线那样，
    // 暂停和拖动章节转场
    get timeline() {
      return timeline
    },
  }
}
