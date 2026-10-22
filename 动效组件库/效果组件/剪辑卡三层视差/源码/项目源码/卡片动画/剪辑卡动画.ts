import gsap from 'gsap'
import { BaseAnimation, type BoundLayer, type CardTimeline } from './卡片动画基础'

/**
 * 02 / EDIT —— Time / Sequence / Cut，被指针推着走。
 *
 * 三个深度图层，各有自己的响应幅度：
 *
 *   巨型 EDIT    55 / 36 px   最前，最灵敏
 *   时间线        30 / 20 px   中间
 *   帧            20 / 13 px   最后，最克制
 *
 * 静态信息（02 / EDIT / 视频剪辑 / VIDEO EDITOR / CUT · SEQUENCE · RHYTHM）
 * **完全不动** —— 它是衡量这个剪辑空间的固定参照框，
 * 正因为有它不动，深度才读起来像深度。
 *
 * 这里**故意没有**环境循环，也**没有**入场动画。规格明确禁止
 * 自动扫描的播放头、任何 `repeat: -1`、以及任何抛入 / 淡入：
 * 唯一能让这张卡动起来的就是指针。`gsap.quickTo` 就是全部机制 ——
 * 每个属性一条可复用的 tween，指针移动时不再反复创建动画，
 * 只是重新设定目标值。缓动滑行本身就是惯性：指针停下后图层还会继续走一段，
 * 然后落定且不过冲。
 *
 * 只允许位移。不旋转、不缩放、不改透明度 —— 视觉语言必须保持扁平的排版感。
 */
export class EditAnimation extends BaseAnimation {
  readonly name = 'edit'

  /** 每个图层的响应参数，单位是「满偏转时卡片局部坐标的像素数」。 */
  private static readonly LAYERS = [
    { selector: '.cv-edit__type', ax: 55, ay: 36, duration: 1.0 },
    { selector: '.cv-edit__timeline', ax: 30, ay: 20, duration: 1.15 },
    { selector: '.cv-edit__frames', ax: 20, ay: 13, duration: 1.3 },
  ] as const

  private layers: BoundLayer[] = []
  private active = true
  private onMove: ((e: PointerEvent) => void) | null = null
  private onLeave: (() => void) | null = null

  /** 没有入场动画 —— 不抛入、不淡入、不逐字揭示。 */
  protected introDelay(): number {
    return -1
  }

  /** 没有环境循环 —— 规格明确禁止自动扫描的播放头。 */
  protected build(_tl: CardTimeline, _host: HTMLElement): void {}

  /**
   * 为三个图层各建一组 `quickTo` 设置器，并注册指针监听。
   * 先调 `super.mount()`：杀掉旧时间线、建（本例为空的）环境循环。
   * 减少动态效果时不注册监听 —— 构图停在设计位置。
   */
  mount(host: HTMLElement): void {
    super.mount(host)
    // 为三个图层各建一组 quickTo 设置器。幅度与设置器绑在同一个对象上 ——
    // 少一层（selector 没匹配上）也不会让后面的层用错幅度。
    this.layers = []
    for (const l of EditAnimation.LAYERS) {
      const el = host.querySelector<HTMLElement>(l.selector)
      if (!el) continue
      this.layers.push({
        ax: l.ax,
        ay: l.ay,
        sx: gsap.quickTo(el, 'x', { duration: l.duration, ease: 'power3.out' }),
        sy: gsap.quickTo(el, 'y', { duration: l.duration, ease: 'power3.out' }),
      })
    }

    this.onMove = (e: PointerEvent) => this.apply(e.clientX, e.clientY)
    this.onLeave = () => this.toBase()
    // passive: 只读坐标，绝不拦截画廊自己的拖拽转环逻辑。
    // 开启「减少动态效果」时**完全跳过注册**：一张跟随鼠标的卡本身仍在运动，
    // 让构图就停在被设计好的位置上才对。
    if (!this.reduced()) {
      window.addEventListener('pointermove', this.onMove, { passive: true })
      document.addEventListener('pointerleave', this.onLeave)
    }
  }

  /** 只在自己被聚焦时响应指针；失焦时滑回基线，而不是冻结在偏移上。 */
  setActive(active: boolean): void {
    if (this.active === active) return
    this.active = active
    // 离开章节时是滑回原位，而不是冻结在某个偏移上
    if (!active) this.toBase()
  }

  /** 成对摘掉两个全局监听并清空图层引用，最后交给基类杀时间线。 */
  destroy(): void {
    if (this.onMove) window.removeEventListener('pointermove', this.onMove)
    if (this.onLeave) document.removeEventListener('pointerleave', this.onLeave)
    this.onMove = null
    this.onLeave = null
    this.layers = []
    super.destroy()
  }

  private apply(clientX: number, clientY: number): void {
    if (!this.active) return
    const w = window.innerWidth || 1
    const h = window.innerHeight || 1
    // 把屏幕坐标归一化到 [-1, 1]
    const nx = Math.max(-1, Math.min(1, (clientX / w) * 2 - 1))
    const ny = Math.max(-1, Math.min(1, (clientY / h) * 2 - 1))
    for (const l of this.layers) {
      l.sx(nx * l.ax)
      l.sy(ny * l.ay)
    }
  }

  /** 指针移出窗口（或章节关闭）：漂回基线。 */
  private toBase(): void {
    for (const l of this.layers) {
      l.sx(0)
      l.sy(0)
    }
  }
}
