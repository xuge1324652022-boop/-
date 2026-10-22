import type { Ref } from 'vue'
import { CARD_COUNT, clamp, layoutGallery } from '../工具/画廊动画控制'
import type { GalleryState } from '../工具/画廊动画控制'

interface GalleryRendererOptions {
  state: GalleryState
  getViewport(): { width: number; height: number }
  isDisposed(): boolean
  drift: { x: number; y: number }
  proximity: readonly number[]
  visuals: readonly ({ play(): void; pause(): void } | null)[]
  stageRef: Readonly<Ref<HTMLElement | null>>
  orbitRef: Readonly<Ref<HTMLElement | null>>
  titleRef: Readonly<Ref<HTMLElement | null>>
  positions: readonly HTMLElement[]
  drifts: readonly HTMLElement[]
  planes: readonly HTMLElement[]
  outlines: readonly HTMLElement[]
  labels: readonly HTMLElement[]
}

// 四层视差中每一层的最大位移（px）：stage 最弱，卡片内容最强
const DRIFT = {
  camera: { x: 5, y: 4 },
  gallery: { x: 10, y: 7 },
  card: { x: 20, y: 14 },
} as const

/**
 * 画廊的唯一 DOM 渲染边界。纯几何仍由 galleryMotion 计算；这里持有样式缓存与可见性播放开关。
 * 不创建 timeline/ticker 或监听；调用频率、输入及销毁状态由 ThreeHome 的交互生命周期控制。
 */
export function createGalleryRenderer({
  state,
  getViewport,
  isDisposed,
  drift,
  proximity,
  visuals,
  stageRef,
  orbitRef,
  titleRef,
  positions,
  drifts,
  planes,
  outlines,
  labels,
}: GalleryRendererOptions) {
  const cardAnimating = new Array<boolean>(CARD_COUNT).fill(true)
  // 缓存上一次写入的样式值，避免重复写同样的字符串触发无谓重排
  const lastWritten = new Map<string, string>()

  /** 只在值真的变化时才写 DOM 样式 */
  function writeStyle(node: HTMLElement | null, key: string, value: string) {
    if (!node) return
    const id = (node.dataset.layerIndex ??= String(lastWritten.size)) + key
    if (lastWritten.get(id) === value) return
    lastWritten.set(id, value)
    node.style.setProperty(key, value)
  }

  /** 切换元素可见性（用 display，值必须合法 —— 不能写 '1'/'0'） */
  function setVisibility(node: HTMLElement | null, visible: boolean) {
    if (!node) return
    if (visible) node.style.removeProperty('display')
    else node.style.display = 'none'
  }

  /** 把数字格式化成固定小数位，减少字符串抖动 */
  function number(value: number) {
    return Math.round(value * 1000) / 1000
  }

  /**
   * ⚠️ 核心渲染：每帧根据 state 计算并写出所有卡片的 transform / clip-path / 明暗。
   * 卡片在 3D 空间中的摆放只由这里产出，galleryMotion 负责算，这里负责写。
   */
  function render() {
    if (isDisposed() || !orbitRef.value) return

    const viewport = getViewport()
    const layout = layoutGallery(viewport.width, viewport.height, state)
    const dx = drift.x
    const dy = drift.y

    // 视差的「可达范围」随选中卡逼近全屏而淡出 ——
    // 否则当卡片铺满视口后，它那 ±20px 的漂移会露出一条黑边。
    // 思路与参考站一致：运动只属于画廊态。
    const reach = 1 - clamp(state.focus)
    const stageDx = dx * DRIFT.camera.x * reach
    const stageDy = dy * DRIFT.camera.y * reach
    const orbitDx = dx * DRIFT.gallery.x * reach
    const orbitDy = dy * DRIFT.gallery.y * reach
    const cardDx = dx * DRIFT.card.x * reach
    const cardDy = dy * DRIFT.card.y * reach

    writeStyle(
      stageRef.value,
      'transform',
      `translate3d(${number(stageDx)}px, ${number(stageDy)}px, 0)`,
    )
    writeStyle(
      orbitRef.value,
      'transform',
      `translate3d(${number(orbitDx)}px, ${number(orbitDy)}px, 0) rotateX(${number(layout.tilt)}deg)`,
    )

    for (const pose of layout.poses) {
      const index = pose.index
      const selected = index === state.selected
      // 邻近度也随 focus 淡出，原因和漂移一样：
      // 一旦某张卡占据了整个视口，就再没有什么「邻近」可言了。
      const near = proximity[index] * reach
      const opacity = pose.opacity
      const visible = opacity > 0.004
      setVisibility(positions[index], visible)
      if (cardAnimating[index] !== visible) {
        cardAnimating[index] = visible
        if (visible) visuals[index]?.play()
        else visuals[index]?.pause()
      }
      if (!visible) continue

      writeStyle(
        drifts[index],
        'transform',
        `translate3d(${number(cardDx)}px, ${number(cardDy)}px, 0)`,
      )
      writeStyle(
        positions[index],
        'transform',
        `translate3d(${number(pose.x)}px, ${number(pose.y)}px, ${number(pose.z)}px)`,
      )
      writeStyle(
        planes[index],
        'transform',
        `rotateY(${number(pose.rotateY)}deg) scale(${number(pose.scale)})`,
      )
      writeStyle(
        planes[index],
        'clip-path',
        `inset(${number(pose.insetY)}% ${number(pose.insetX)}%)`,
      )
      writeStyle(planes[index], 'opacity', String(number(opacity)))
      // ⚠️ 这里曾经每帧再写一遍 `background-color: #111111`。那行是 no-op
      //    （与 CSS 里的底色完全相同），却把背景色锁进了内联样式 —— 之后
      //    任何人改 CSS 里的底色都会失效，且查不到是谁在写。底色归 CSS。

      const outline = outlines[index]
      writeStyle(
        outline,
        'inset',
        `${number(pose.insetY + near * 0.6)}% ${number(pose.insetX + near * 0.6)}%`,
      )
      writeStyle(outline, 'border-width', `${number(1 / pose.scale)}px`)
      writeStyle(outline, 'opacity', String(number((selected ? 0.7 : 0.46) + near * 0.34)))

      const label = labels[index]
      writeStyle(label, 'inset', `${number(pose.insetY)}% ${number(pose.insetX)}%`)
      // 最前方那张卡的标签在画廊态会前伸 +40px，并随着该卡接管视口
      // 滑回边距位置，这样它就不会压在全屏构图上面。
      // 非最前方的标签则永不移动。
      const labelLift = selected ? 1 - clamp(state.focus / 0.8) : 0
      writeStyle(label, 'transform', `translate3d(${number(40 * labelLift)}px, 0, 0)`)
      const labelBase = selected ? 1 - clamp(state.focus / 0.8) : 0.8
      writeStyle(label, 'opacity', String(number(Math.min(1, labelBase + near * 0.2))))
    }

    // 标题走的是与卡片相同的那条轨道淡出，因此它是随着选中卡接管视口
    // 而离去，而不是在相位翻转的一瞬间闪断。
    // 当 focus=1 时这个值恰好为 0，这也正是它在 detail 相
    // 不会透过全屏卡片渗出来的原因。
    writeStyle(
      titleRef.value,
      'opacity',
      String(number(Math.min(1, state.entrance * 3) * (1 - clamp(state.focus / 0.4)))),
    )
    writeStyle(
      titleRef.value,
      'transform',
      `translate(-50%, -50%) scale(${number(1 + state.focus * 0.1)})`,
    )
  }

  return render
}
