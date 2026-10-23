import gsap from 'gsap'
import { BaseAnimation, type CardTimeline } from './卡片动画基础'

/**
 * 01 / ABOUT —— 聚焦入场的活钩子。
 *
 * src/components/about/AboutExperience.vue 独立实现指针视差、环境动画和示例扫描线。
 * 本模块在 gallery → detail
 * 的过渡里给 .card-visual 跑一段轻微的淡入 + 缩放 + 落定入场（被
 * src/components/ThreeHome.vue 的 visuals[chosen]?.restart() 调用）。
 *
 * 所以这里几乎只剩一个 restart()：所有关于字母 / 描边 / 指针的
 * setter、listener、toBase 都已死代码，一起删掉。
 */
export class AboutAnimation extends BaseAnimation {
  readonly name = 'about'

  /** 基类入场保持禁用 —— 我们的入场是聚焦时跑。 */
  protected introDelay(): number {
    return -1
  }

  /** 基类要求实现的抽象成员。这里没有时间线要建，留空。 */
  protected build(_tl: gsap.core.Timeline, _host: HTMLElement): void {}

  protected buildIntro(_tl: CardTimeline, _host: HTMLElement): void {}

  /**
   * 聚焦入场。`killTweensOf(host)` 保证快速重新聚焦时不会叠加动画。
   * 关于我视觉层（巨型 ABOUT / DEMO / 文字信息）随 host 一起到位。
   */
  restart(): void {
    if (this.host) {
      gsap.killTweensOf(this.host)
      if (this.reduced()) gsap.set(this.host, { clearProps: 'transform,opacity' })
      else gsap.fromTo(
        this.host,
        { scale: 0.94, y: 14, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.75, ease: 'power2.out' },
      )
    }
    super.restart()
  }

  destroy(): void {
    if (this.host) {
      gsap.killTweensOf(this.host)
      // resize也会销毁后重挂载；宿主入场不属于基类intro，必须撤掉半途的淡入/位移。
      // 只还原.card-visual自身，父级卡片几何和内部ABOUT三层视差分别由各自持有者管理。
      gsap.set(this.host, { clearProps: 'transform,opacity' })
    }
    super.destroy()
  }
}
