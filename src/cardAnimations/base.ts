import gsap from 'gsap'
import type { CardAnimation, CardMedia } from './types'

/** GSAP 时间线类型，转出来好让子类不必再自己 import gsap */
export type CardTimeline = gsap.core.Timeline

/**
 * 一个已绑定 `gsap.quickTo` 的视差图层 —— 幅度与设置器在**同一个对象**里。
 *
 * ⚠️ 为什么必须绑在一起，而不是「setters 数组」与「LAYERS 数组」按下标对齐：
 *    mount() 里某个 selector 找不到就会跳过那一层，setters 数组因此比
 *    LAYERS 短一截，之后**每一层都用错幅度** —— 而且不报错，只表现为
 *    「某个图层的位移不太对」，几乎没法查。把 ax / ay 和 sx / sy 放进同一
 *    个对象，少一层也只是少一层。
 *
 * ⚠️ `sx` / `sy` 的类型是**承重的**：必须取自 GSAP 自己的返回值，不能手写
 *    成 `(v: number) => void`。手写的函数类型**不能赋值**给 `QuickToFunc`
 *    （后者还额外带一个 `tween` 属性），一旦拿它去做类型谓词 `s is T` 的 T，
 *    而类型谓词要求 T 可赋值给参数类型，就会直接编译报错。
 */
export interface BoundLayer {
  /** 满偏转时沿 X 轴的位移（px） */
  ax: number
  /** 满偏转时沿 Y 轴的位移（px） */
  ay: number
  sx: gsap.QuickToFunc
  sy: gsap.QuickToFunc
}

/**
 * 所有卡片内容动画共享的生命周期基类。
 *
 * 之所以是**两条**时间线，是因为它们语义不同：
 *
 *   - `tl`    —— 环境循环，`repeat: -1`。一张卡建立完成之后，就只有它
 *                在动；构图因此永远不会被定时销毁重建。
 *   - `intro` —— 可选的一次性入场动画，通过 `introDelay()` 返回值来开启。
 *                每次 `restart()` 跑一遍；同一实例再次 mount 时保留已完成标记，
 *                避免重新测量本身就重放入场。销毁后创建的新实例不继承该标记。
 *
 * 两条时间线都创建为 paused，且只允许作用于 `host` 内部的节点。
 * `delay` 是每张卡的相位偏移：它错开循环首次启动的时刻，让六张卡
 * 永远不会同时开始或同时结束。
 */
export abstract class BaseAnimation implements CardAnimation {
  abstract readonly name: string

  protected host: HTMLElement | null = null
  protected tl: gsap.core.Timeline | null = null
  protected intro: gsap.core.Timeline | null = null
  private readonly delay: number
  /** 入场动画是否已经跑过一次（resize 后据此决定是否直接跳到终态） */
  private introDone = false

  /** @param delay 相位偏移秒数，见类注释里的 `delay` 说明；默认 0 表示不偏移。 */
  constructor(delay = 0) {
    this.delay = delay
  }

  /**
   * 把动画挂到一个新 host 上：先杀掉旧时间线，再重建环境循环与（可选）入场。
   *
   * 同一实例可再次挂载 —— 所以这里必须先释放旧时间线，且不能重放已完成的入场
   * （靠 `introDone` 判断，已跑过就直接 `progress(1)` 跳到终态）。
   * `host` 换新时旧引用不保留，所有 tween 只作用于传入的这一棵子树。
   */
  mount(host: HTMLElement): void {
    this.host = host
    this.kill()
    this.tl = gsap.timeline({
      repeat: -1,
      delay: this.delay,
      paused: true,
      // 中途掉帧时防止循环节奏漂移
      smoothChildTiming: true,
    })
    this.build(this.tl, host)

    // introDelay() 返回 -1 表示这张卡没有入场动画，到此为止
    const introDelay = this.introDelay()
    if (introDelay < 0) return
    const it = gsap.timeline({
      delay: introDelay,
      paused: true,
      // 入场跑完一次就置标记 —— resize 后据此直接跳到终态，不重放
      onComplete: () => {
        this.introDone = true
      },
    })
    this.buildIntro(it, host)
    // 子类没有往里加任何 tween，就没有入场这回事
    if (!it.getChildren().length) {
      it.kill()
      return
    }
    // 已经建立过一次：直接跳到完成后的构图，而不是在 resize 之后重放一遍
    if (this.introDone) it.progress(1)
    this.intro = it
  }

  /** 子类在这里添加环境循环的 tween；目标必须位于 `host` 内部。 */
  protected abstract build(tl: gsap.core.Timeline, host: HTMLElement): void

  /** 一次性入场动画。让 `introDelay()` 返回 >= 0 即可启用。 */
  protected buildIntro(_tl: gsap.core.Timeline, _host: HTMLElement): void {}

  /** 入场动画开始前的等待秒数。返回 -1 表示禁用。 */
  protected introDelay(): number {
    return -1
  }

  /**
   * 恢复环境循环。**这里不播入场动画** —— intro 时间线创建时就是 paused，
   * 只有 `restart()` 才会让它动起来。这样一张卡可以先停在它的 "from"
   * 状态（构图之外），直到章节真正被打开。
   */
  play(): void {
    this.tl?.play()
  }

  /** 同时冻结入场与环境循环（章节收起、页面隐藏时调用）。 */
  pause(): void {
    this.intro?.pause()
    this.tl?.pause()
  }

  /** 停下并倒回第一帧 */
  reset(): void {
    this.intro?.pause(0)
    this.tl?.pause(0)
  }

  /**
   * 跑一遍入场动画，并把环境循环拨回相位 0。章节被打开时放的就是这个，
   * 好让「抛入」的动作发生在用户眼前。
   * `restart(false, true)` 会跳过 intro 自身的初始延迟，让字母立刻进场，
   * 而不是再让用户干等一段。
   */
  restart(): void {
    if (this.intro) this.intro.restart(false, true)
    if (this.tl) {
      this.tl.pause(0)
      this.tl.play()
    }
  }

  /** 选择性实现：只有需要交互的卡片才关心自己是否在屏幕上。 */
  setActive(_active: boolean): void {}

  /**
   * 彻底释放：杀掉两条时间线并解除 host 引用。
   * 之后 `play()` / `pause()` 都是空操作（`tl` / `intro` 已为 null），
   * 想再用必须重新 `mount()`。
   */
  destroy(): void {
    this.kill()
    this.host = null
  }

  /**
   * 注入真实媒体（视频 / 图片）。默认实现什么都不做，保持占位图；
   * 拥有真实媒体的子类覆写它，并在里面自行处理加载与解码失败。
   */
  setMedia(_media: CardMedia): void {
    // 默认实现：只用占位图。拥有真实媒体的子类自行覆写。
  }

  protected kill(): void {
    this.intro?.kill()
    this.intro = null
    this.tl?.kill()
    this.tl = null
  }

  /**
   * 用户是否要求「减少动态效果」。
   *
   * 仅仅暂停环境循环是不够的：一张跟随鼠标的卡仍在运动，而这恰恰就是
   * 该项无障碍设置想要消除的那类运动。子类据此**干脆不注册**鼠标监听，
   * 让构图停在它被设计好的位置上。
   */
  protected reduced(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  /** 给子类提供的快捷查询：只在自己子树内找单个元素 */
  protected q<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    return this.host?.querySelector<T>(selector) ?? null
  }

  /** 给子类提供的快捷查询：只在自己子树内找一组元素 */
  protected qa<T extends HTMLElement = HTMLElement>(selector: string): T[] {
    return this.host ? Array.from(this.host.querySelectorAll<T>(selector)) : []
  }
}
