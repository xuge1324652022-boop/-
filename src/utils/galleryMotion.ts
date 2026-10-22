// 保留当前作品集的正交 CSS-3D 环。参考站不同章节使用不同投影，
// Campaign 的空间图库与 Motion 的透视堆叠不能当作同一套几何。
// 本文件是纯数学层：所有尺寸都根据视口实时重算，因此改变窗口大小
// 永远不会重置已经走完的动画进度。

/** 卡片数量：六张，与六个章节一一对应 */
export const CARD_COUNT = 6
/** 开场动画总时长（秒），ThreeHome.vue 的 intro 时间线用它做 duration */
// 开场时长。原本 5s 偏拖沓，观感上「旋转慢慢磨完」而不是「利落地落位」。
// 按 0.72 缩到 3.6s（目标区间 0.7~0.8），配合下面更陡的出场缓动，
// 六张卡是快速绽开再长长地收住，而不是匀速转完。
export const INTRO_DURATION = 3.6
/** 画廊内 focus 从 0 走到 1 的时长（秒）；与跨页面的 PageCurtain 分别计时。 */
// 全视口卡片的移动距离较长，沿用单一进度轨并在 1.4s 内落定。
export const FOCUS_DURATION = 1.4
/** 每张卡静止时的 rotateY 角度，正负交替，营造环上的错落朝向 */
export const ROTATIONS = [40, -45, 40, -45, 40, -45]

/** 把数值限制在 [min, max] 区间内，默认 [0, 1] */
export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
/** 线性插值：t=0 返回 a，t=1 返回 b */
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
/** 把任意整数下标规整到 0..CARD_COUNT-1，支持负数（用于环上的前后翻页） */
export const normalizeIndex = (index: number) => ((index % CARD_COUNT) + CARD_COUNT) % CARD_COUNT

// 三次贝塞尔缓动：对 x 做反解，因此既能给 GSAP 用，也能给数值化的校验脚本用。
// 只被下面两个常量用掉，全项目没有第二处 import —— 不导出。
// 需要新缓动时在这里加常量，而不是把这个三阶贝塞尔当公共工具用出去。
function bezierEase(x1: number, y1: number, x2: number, y2: number) {
  // 一维贝塞尔基函数，u 为参数，a/b 为两个控制点坐标
  const coordinate = (u: number, a: number, b: number) =>
    3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u ** 2 * b + u ** 3
  return (progress: number) => {
    if (progress <= 0 || progress >= 1) return clamp(progress)
    // 二分法反解出满足 x(u) = progress 的 u，24 次迭代精度足够
    let low = 0
    let high = 1
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2
      if (coordinate(mid, x1, x2) < progress) low = mid
      else high = mid
    }
    return coordinate((low + high) / 2, y1, y2)
  }
}

/** 开场缓动 */
// 开场使用出场型三次贝塞尔，获得接近 easeOutQuart 的快速展开与长尾减速。
// 它是实际控制点定义的曲线，不与 GSAP power3.out 严格等同。
// 原来是 (0.3, 0, 0.25, 1) 这种接近匀速的曲线，收尾没有明显的减速尾巴。
// 换成 out 型后：起步就进入状态（此时卡片还只有 2.5% 大小，不会显得生硬），
// 尾段长时间减速，六张卡「飘着落定」而不是「转到位就停」。
// 注意：不加 overshoot / back / elastic —— 落点必须精确停在既定角度上。
export const entranceEase = bezierEase(0.165, 0.84, 0.44, 1)
/** 聚焦缓动：转场单轨专用 */
export const focusEase = bezierEase(0.215, 0.61, 0.355, 1)

/** 画廊几何状态；GSAP 原地推进进度/角度，selected 由交互逻辑切换。 */
export interface GalleryState {
  entrance: number // 开场进度 0→1
  orbit: number // 环的旋转角度（度）
  focus: number // 聚焦进度 0→1，唯一的转场轨道
  selected: number // 当前选中的卡片下标
}

/**
 * 把「视口尺寸 + 当前动画状态」算成六张卡各自的位姿。
 *
 * 纯函数、无副作用：每帧被调用一次，输入相同则输出相同（便于回归比对）。
 * 所有几何量都在这里现算，卡片组件只负责把结果写进 transform / clip-path。
 *
 * @param width  / `height` 视口（或舞台）的 CSS 像素尺寸
 * @param state   当前进度、角度与选中下标（见 `GalleryState`）
 * @returns       六张卡的位姿数组，顺序与 `CARD_COUNT` 一致
 */
export function layoutGallery(width: number, height: number, state: GalleryState) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  // 在不同尺寸之间平滑过渡几何参数，而不是在某个「手机断点」处硬切换
  const responsive = clamp((w - 500) / 500)
  const entrance = clamp(state.entrance)
  const focus = clamp(state.focus)
  const selected = normalizeIndex(state.selected)
  // 横屏手机（844×390 等，高度 < 520）曾经会退回到「按高度封顶」的分支：
  // h * 0.46 ≈ 179px，导致六张卡挤在中间一条窄带里，而标题却横跨整个视口。
  // 现在改用更宽的系数，并给半径设一个下限，保证环在横屏下依然可读。
  const isShort = h < 520
  const widthFactor = isShort ? 0.34 : mix(0.38, 0.26, responsive)
  const heightCap = isShort ? Math.max(h * 0.46, 230) : h * 0.46
  const targetRadius = Math.min(w * widthFactor, heightCap)
  // 半径随开场进度从「很小」长到目标值，制造环从中心绽开的感觉
  const radius = mix(Math.min(w * 0.07, 90), targetRadius, entrance)
  const baseScale = mix(0.025, mix(0.25, 0.3, responsive), entrance)
  const cardAspect = mix(1, 1.3, responsive)
  // 未聚焦时卡片被 clip-path 裁成一条横带（参考站的遮罩行语法）
  const clippedWidth = Math.min(w, h * cardAspect) * mix(0.8, 0.6, responsive)
  const clippedHeight = clippedWidth / cardAspect
  const insetX = (1 - clippedWidth / w) * 50
  const insetY = (1 - clippedHeight / h) * 50
  // 轨道倾斜：画廊态 -45°，聚焦后回正到 0°，卡片由此「躺平」对准视口
  const tilt = mix(-45, 0, focus)

  const poses = Array.from({ length: CARD_COUNT }, (_, index) => {
    const isSelected = index === selected
    // 只有被选中的那张走 focus；其余五张 p 恒为 0，原地不动
    const p = isSelected ? focus : 0
    const angle = ((state.orbit - 110 + index * 60) * Math.PI) / 180
    // 到环正前方的距离（0..3）。正面那张为 1，正对面的那张衰减到 0.7。
    // 这就是参考站的明暗语法：当前项最亮，其余按距离成比例变暗。
    const diff = (((index - selected) % CARD_COUNT) + CARD_COUNT) % CARD_COUNT
    const ringDistance = Math.min(diff, CARD_COUNT - diff)
    const dim = isSelected ? 1 : 1 - (ringDistance / 3) * 0.3
    return {
      index,
      x: Math.cos(angle) * radius * (1 - p),
      y: 0,
      z: Math.sin(angle) * radius * (1 - p),
      rotateY: mix(ROTATIONS[index], 0, p),
      scale: mix(baseScale, 1, p),
      insetX: insetX * (1 - p),
      insetY: insetY * (1 - p),
      opacity:
        Math.min(1, entrance * 5) *
        (isSelected ? 1 : (1 - clamp(focus / 0.65)) * dim),
      // 卡片内容（文字等）要等到 focus 快走完才浮现，避免铺满过程中文字糊在一起
      contentOpacity: isSelected ? clamp((focus - 0.88) / 0.12) : 0,
    }
  })
  return { width: w, height: h, radius, tilt, poses }
}

// 屏幕空间下的四角投影，严格对应下面 CSS transform 的应用顺序。
// 注意：这里只复算当前画廊的正交投影，不概括参考站其它带 perspective 的章节。
//
// ⚠️ 关键几何陷阱：因为轨道倾斜 tilt 且投影是正交的，
//    y_screen = h/2 + y·cos(tilt) − localZ·sin(tilt)
//    也就是说 **z 在这里不是深度，而是屏幕上的垂直偏移**。
//    任何想「把卡片沿 z 往后推」的操作，实际效果是让它在屏幕上整体上下移动。
export function projectCardCorners(
  layout: ReturnType<typeof layoutGallery>,
  index: number,
) {
  const pose = layout.poses[index]
  const ry = (pose.rotateY * Math.PI) / 180
  const rx = (layout.tilt * Math.PI) / 180
  const halfW = layout.width * (0.5 - pose.insetX / 100) * pose.scale
  const halfH = layout.height * (0.5 - pose.insetY / 100) * pose.scale
  return [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ].map(([x, y]) => {
    const localZ = -x * Math.sin(ry) + pose.z
    return {
      x: layout.width / 2 + pose.x + x * Math.cos(ry),
      y: layout.height / 2 + y * Math.cos(rx) - localZ * Math.sin(rx),
    }
  })
}
