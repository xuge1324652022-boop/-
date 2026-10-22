import gsap from 'gsap'

/**
 * 为传入碎片构造暂停的局部时间线：标题优先，图形随后进入。
 * 调用方决定入场/重播时机，并在 onComplete 换回原图；本函数不注册滚动或全局监听。
 * 返回值须由调用方或包围它的 GSAP context 撤销，不能留下脱离组件的补间。
 */
export function createInternshipArtworkMotion(fragments: readonly HTMLElement[], onComplete: () => void): gsap.core.Timeline {
  const sequence = gsap.timeline({ paused: true, defaults: { duration: .95, ease: 'power2.out' }, onComplete })
  const ordered = [...fragments].sort((a, b) => Number(b.dataset.kind === 'headline') - Number(a.dataset.kind === 'headline'))
  ordered.forEach((node, index) => {
    const graphic = node.dataset.kind === 'block'
    sequence.fromTo(node,
      { xPercent: 0, yPercent: graphic ? 12 : 103, scale: graphic ? .985 : 1, opacity: graphic ? 0 : 1 },
      { xPercent: 0, yPercent: 0, scale: 1, opacity: 1 }, index * .085)
  })
  return sequence
}
