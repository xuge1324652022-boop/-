import gsap from 'gsap'
import { BaseAnimation, type BoundLayer, type CardTimeline } from './卡片动画基础'

/**
 * 03 / COLOR —— Tone / Color / Grade，被指针推着走。
 *
 * 五个深度图层，各有自己的响应幅度：
 *
 *   巨型 COLOR    50 / 35 px   最前，最灵敏
 *   色条          35 / 25 px
 *   胶片框        28 / 20 px
 *   色调曲线      24 / 17 px
 *   色轮          20 / 12 px   最后，最克制
 *
 * 静态信息（03 / COLOR / 调色 / 调色参数 / LUT 注释）**完全不动** ——
 * 它是衡量这个色彩空间的固定参照框。
 *
 * 这里**故意没有**环境循环，也**没有**入场动画：没有漂移的光标、
 * 没有呼吸的色阶、没有自动旋转的色轮。这张卡是一幅只有指针才能打扰的构图。
 * `gsap.quickTo` 就是全部机制 —— 每个属性一条可复用的 tween，
 * 指针移动时复用已有 tween，只重新设定目标值；
 * 缓动滑行本身就是惯性。
 *
 * 只允许位移。不旋转、不缩放，而且**重要的是**：不让指针去改变颜色。
 * 鼠标位置移动的是空间，它永远不重绘空间 —— 因为「鼠标往左就变蓝」
 * 读起来像个廉价的网页特效，而不像一间调色师的房间。
 *
 * ⚠️ 这里曾经有**第二套机制**：六段真实调色画面按「指针离这一片有多近」
 * 被从空间里拨出来（`CLIPS` / `REVEAL_TAU` / 逐帧 ticker / play-pause）。
 * 2026-09-23 整体退役 —— 同一批素材在画廊和专属页 `/color` 各出现一次，
 * 等于同一件东西被看到两次，读起来像重复而不是呼应。素材现在只在
 * `/color`（`ColorWave.vue`），这一页回归纯粹的卡面构图。
 * `verify-color-media.cjs` 改成断言这层不得复活。
 */
export class ColorAnimation extends BaseAnimation {
  readonly name = 'color'

  /** 每个图层的响应参数，单位是「满偏转时卡片局部坐标的像素数」。 */
  private static readonly LAYERS = [
    { selector: '.cv-color__type', ax: 50, ay: 35, duration: 1.0 },
    { selector: '.cv-color__strips', ax: 35, ay: 25, duration: 1.1 },
    { selector: '.cv-color__frames', ax: 28, ay: 20, duration: 1.15 },
    { selector: '.cv-color__curves', ax: 24, ay: 17, duration: 1.25 },
    { selector: '.cv-color__wheel', ax: 20, ay: 12, duration: 1.35 },
  ] as const

  private layers: BoundLayer[] = []
  private active = true
  private onMove: ((e: PointerEvent) => void) | null = null
  private onLeave: (() => void) | null = null
  private nx = 0
  private ny = 0

  /** 没有入场动画 —— 不抛入、不淡入、不逐字揭示。 */
  protected introDelay(): number {
    return -1
  }

  /** 没有环境循环 —— 不漂移光标、不呼吸色阶、不自动转色轮。 */
  protected build(_tl: CardTimeline, _host: HTMLElement): void {}

  /**
   * 为五个图层各建一组 `quickTo` 设置器，并注册指针监听。
   * 先调 `super.mount()`：它负责杀掉旧时间线、建（本例为空的）环境循环。
   * 某个 selector 没匹配上就跳过那一层 —— 幅度与设置器同对象，不会错位。
   */
  mount(host: HTMLElement): void {
    super.mount(host)
    // 为五个图层各建一组 quickTo 设置器。幅度与设置器绑在同一个对象上，
    // 少一层（selector 没匹配上）也不会让后面的层用错幅度。
    this.layers = []
    for (const l of ColorAnimation.LAYERS) {
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

  /**
   * 这张卡是不是「当前被聚焦的那张」。只有 active 时才响应指针；
   * 从 active 变 false 时**滑回**基线，而不是把偏移冻结在原地。
   */
  setActive(active: boolean): void {
    if (this.active === active) return
    this.active = active
    // 离开章节时是滑回原位，而不是冻结在某个偏移上。
    if (!active) this.toBase()
  }

  /**
   * 摘掉两个全局监听并清空图层引用，最后交给基类杀时间线。
   * 监听必须在这里成对移除 —— mount 可以重复调用，漏一次就多一组监听。
   */
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
    // 把屏幕坐标归一化到 [-1, 1]：五个图层的偏转量
    this.nx = Math.max(-1, Math.min(1, (clientX / w) * 2 - 1))
    this.ny = Math.max(-1, Math.min(1, (clientY / h) * 2 - 1))
    for (const l of this.layers) {
      l.sx(this.nx * l.ax)
      l.sy(this.ny * l.ay)
    }
  }

  /** 指针移出窗口（或章节关闭）：漂回基线。 */
  private toBase(): void {
    for (const l of this.layers) {
      l.sx(0)
      l.sy(0)
    }
    this.nx = 0
    this.ny = 0
  }
}
