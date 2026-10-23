<template>
  <footer id="contact" ref="root" class="end" aria-labelledby="contact-title">
    <div ref="curve" class="end__curve" aria-hidden="true"><div class="end__curve-shape"></div></div>
    <div class="end__inner">
      <div ref="content" class="end__content">
        <header class="end__head">
          <h2 id="contact-title"><span class="end__title-line"><img src="/about/portrait.webp" width="80" height="80" alt="" loading="lazy" />下一段内容</span><span>一起开始</span><small lang="en">Let’s work together</small></h2>
          <svg ref="headingArrow" class="end__heading-arrow" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M26 6 6 26M6 6v20h20" /></svg>
        </header>
        <div class="end__rail">
          <div ref="contactPosition" class="end__contact-position">
            <a ref="magnet" class="end__contact" :href="`mailto:${CONTACT.email}`" @pointerenter="measureMagnet" @pointermove="moveMagnet" @pointerleave="resetMagnet" @blur="resetMagnet">
              <span ref="orb" class="end__orb"><span class="end__orb-fill" aria-hidden="true"></span><span ref="orbText" class="end__orb-text">邮件联系<span lang="en">Get in touch</span></span></span>
            </a>
          </div>
        </div>
        <div class="end__body">
          <div class="end__identity">
            <dl class="end__rows">
              <div class="end__row"><dt>邮箱<span lang="en">Email</span></dt><dd><a class="end__a" :href="`mailto:${CONTACT.email}`">{{ CONTACT.email }}</a></dd></div>
              <div class="end__row"><dt>示例备用邮箱<span lang="en">Example alternate email</span></dt><dd><a class="end__a" :href="`mailto:${CONTACT.gmail}`">{{ CONTACT.gmail }}</a></dd></div>
            </dl>
            <div class="end__availability"><p v-if="targetRole">{{ targetRole.v.zh }}<span lang="en">{{ targetRole.v.en }}</span></p><p v-if="availability">{{ availability.v.zh }}<span lang="en">{{ availability.v.en }}</span></p></div>
          </div>
          <div class="end__actions">
            <RouterLink class="end__action" :to="workTo"><span class="end__action-copy"><span class="end__action-title">查看作品</span><span class="end__action-translation" lang="en">View work</span></span><svg class="end__action-arrow" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M6 26 26 6M6 6h20v20" /></svg></RouterLink>
            <a class="end__action" :href="CONTACT.resume" :download="lang === 'zh' ? '示例求职者-简历.pdf' : 'Example-Candidate-resume.pdf'"><span class="end__action-copy"><span class="end__action-title">查看示例简历 PDF</span><span class="end__action-translation" lang="en">Sample résumé PDF</span></span><svg class="end__action-arrow" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 4v22M7 17l9 9 9-9" /></svg></a>
          </div>
        </div>
        <div class="end__base"><RouterLink class="end__next" :to="nextTo"><span>继续看剪辑<span lang="en">Explore editing</span></span><span aria-hidden="true">↗</span></RouterLink><button class="end__top" type="button" @click="toTop"><span>{{ lang === 'zh' ? '回到顶部' : 'Back to top' }}</span><span aria-hidden="true">↑</span></button></div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
/**
 * 关于页结尾：滚动控制弧形衔接与内容位移，精细鼠标控制独立的联系球磁吸。
 * 磁吸壳、球体、文字分层，避免滚动轨迹和指针补间争写同一个 transform。
 * 邮箱用原生 mailto，导航保留入口来源；靠近视口才准备动画，卸载统一释放资源。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CONTACT, FACTS, type Lang } from '../../数据/人物资料'
import { prepareMotionLayout } from '../../工具/动效布局调度'
defineProps<{ lang: Lang }>()
const route = useRoute()
const source = computed(() => route.query.from === 'cards' ? 'cards' : 'gallery')
// 每次打开关于页分配一个不同作品入口；本次浏览期间固定，悬停与切语言不会换目标。
// 剪辑已有独立入口，其余四类按会话轮换，避免回到当前页或画廊后再找一次作品。
const workPaths = ['/poster', '/photo', '/color', '/news'] as const
const workPath = ref<(typeof workPaths)[number]>(workPaths[0])
const workTo = computed(() => ({ path: workPath.value, query: { from: source.value } }))
function selectWorkDestination(): void {
  try {
    const saved = Number(sessionStorage.getItem('portfolio:view-work:next') ?? '0')
    const index = Number.isInteger(saved) && saved >= 0 && saved < workPaths.length ? saved : 0
    workPath.value = workPaths[index]!
    sessionStorage.setItem('portfolio:view-work:next', String((index + 1) % workPaths.length))
  } catch {
    // 禁用会话存储时仍直接打开有效的海报页；不影响主导航和简历下载。
  }
}
const nextTo = computed(() => ({ path: '/edit', query: { from: source.value } }))
const targetRole = FACTS.find(fact => fact.k.en === 'Target role')
const availability = FACTS.find(fact => fact.k.en === 'Availability')
const root = ref<HTMLElement | null>(null), curve = ref<HTMLElement | null>(null), content = ref<HTMLElement | null>(null)
const headingArrow = ref<SVGElement | null>(null), contactPosition = ref<HTMLElement | null>(null)
const magnet = ref<HTMLElement | null>(null), orb = ref<HTMLElement | null>(null), orbText = ref<HTMLElement | null>(null)
let media: gsap.MatchMedia | undefined
let preparationObserver: IntersectionObserver | undefined
let cancelPreparation: (() => void) | undefined
let dead = false
let pointerBounds: DOMRect | null = null
let updateMagnet: (x: number, y: number) => void = () => {}
let releaseMagnet = () => {}
// 悬停时缓存未位移外壳的边界；滚动或失焦清掉缓存，避免吸附中心跟着球体漂移。
function measureMagnet(event: PointerEvent) { if (event.pointerType === 'mouse') pointerBounds = magnet.value?.getBoundingClientRect() ?? null }
function moveMagnet(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.buttons) return
  if (!pointerBounds) pointerBounds = magnet.value?.getBoundingClientRect() ?? null
  if (!pointerBounds) return
  const b = pointerBounds
  updateMagnet(gsap.utils.clamp(-1, 1, (event.clientX - b.left) / b.width * 2 - 1), gsap.utils.clamp(-1, 1, (event.clientY - b.top) / b.height * 2 - 1))
}
function resetMagnet() { pointerBounds = null; releaseMagnet() }
function toTop() { window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }
function contactTravel(direction: -1 | 1): number {
  const position = contactPosition.value
  const rail = position?.offsetParent as HTMLElement | null
  if (!position || !rail) return 0
  const room = direction > 0 ? rail.clientWidth - position.offsetLeft - position.offsetWidth : position.offsetLeft
  return direction * Math.max(0, Math.min(70, room))
}
gsap.registerPlugin(ScrollTrigger)
function initializeContact(): void {
  cancelPreparation = undefined
  if (dead || !root.value) return
  media = gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)', () => {
    // Reference: footer curve collapses over the footer's full scroll range; the arrow turns 15 degrees.
    const timeline = gsap.timeline({ scrollTrigger: { trigger: root.value!, start: 'top bottom', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } })
    timeline.fromTo(curve.value!, { scaleY: 1 }, { scaleY: 0, ease: 'none' }, 0)
      .fromTo(content.value!, { y: -100 }, { y: 0, ease: 'none' }, 0)
      .fromTo(headingArrow.value!, { rotation: 15 }, { rotation: 0, ease: 'none' }, 0)
      .fromTo(contactPosition.value!, { x: () => contactTravel(1) }, { x: () => contactTravel(-1), ease: 'none' }, 0)
  }, root.value)
  media.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
    const x = gsap.quickTo(orb.value!, 'x', { duration: .6, ease: 'power4.out' })
    const y = gsap.quickTo(orb.value!, 'y', { duration: .6, ease: 'power4.out' })
    const tx = gsap.quickTo(orbText.value!, 'x', { duration: .6, ease: 'power4.out' })
    const ty = gsap.quickTo(orbText.value!, 'y', { duration: .6, ease: 'power4.out' })
    const returnOrb = gsap.to(orb.value!, { x: 0, y: 0, duration: 1.5, ease: 'elastic.out(1, .4)', paused: true })
    const returnText = gsap.to(orbText.value!, { x: 0, y: 0, duration: 1.5, ease: 'elastic.out(1, .4)', paused: true })
    let moved = false
    updateMagnet = (dx, dy) => { moved = true; returnOrb.pause(); returnText.pause(); x(dx * 30); y(dy * 30); tx(dx * 12); ty(dy * 12) }
    releaseMagnet = () => { if (!moved) return; moved = false; x.tween.pause(); y.tween.pause(); tx.tween.pause(); ty.tween.pause(); returnOrb.invalidate().restart(); returnText.invalidate().restart() }
    return () => { updateMagnet = () => {}; releaseMagnet = () => {}; pointerBounds = null }
  }, root.value)
  window.addEventListener('scroll', resetMagnet, { passive: true })
  window.addEventListener('blur', resetMagnet)
}
function prepareContact(): void {
  if (dead || !root.value) return
  cancelPreparation = prepareMotionLayout(root.value, initializeContact)
}
onMounted(() => {
  selectWorkDestination()
  if (!root.value) return
  // The footer is far below the first title. Prepare its existing curve and
  // magnetic interaction just before entry instead of spending first-frame time.
  preparationObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    preparationObserver?.disconnect()
    preparationObserver = undefined
    prepareContact()
  }, { rootMargin: '500px' })
  preparationObserver.observe(root.value)
})
onBeforeUnmount(() => { dead = true; preparationObserver?.disconnect(); cancelPreparation?.(); window.removeEventListener('scroll', resetMagnet); window.removeEventListener('blur', resetMagnet); media?.revert() })
</script>

<style scoped>
.end { --ab-ink:#f7f7f5; --ab-soft:#acadb2; --ab-line:#44454a; position:relative; width:100vw; margin-inline:calc(50% - 50vw); background:#1c1d20; color:var(--ab-ink); scroll-margin-top:0; overflow:clip; }
.end__curve { position:absolute; z-index:2; top:-1px; left:0; width:100%; height:10vh; height:10svh; overflow:hidden; transform-origin:top center; pointer-events:none; }
.end__curve-shape { position:absolute; width:150%; height:750%; left:50%; top:0; border-radius:50%; transform:translate(-50%,-86.6666%); background:var(--ab-bg); }
.end__inner { width:100%; max-width:1440px; margin:auto; padding:clamp(136px,17vh,190px) clamp(20px,4.4vw,64px) 30px; }
.end__head { display:flex; position:relative; justify-content:space-between; gap:40px; align-items:center; }
.end__head h2 { margin:0; font-size:clamp(46px,6.2vw,88px); line-height:1.13; font-weight:400; letter-spacing:-.055em; }
.end__head h2 > span { display:block; }.end__title-line { color:#b7b8ba; }.end__title-line img { display:inline-block; vertical-align:baseline; margin-right:22px; width:.82em; height:.82em; border-radius:50%; object-fit:cover; object-position:50% 24%; }
.end__head small { display:block; margin-top:22px; font-size:clamp(18px,2.2vw,30px); line-height:1.3; font-weight:400; letter-spacing:-.025em; color:var(--ab-soft); }
.end__heading-arrow { width:28px; height:28px; stroke:currentColor; stroke-width:1.5; margin:0 5vw 0 0; }
.end__rail { position:relative; height:1px; margin:clamp(112px,12vw,172px) 0 clamp(112px,11vw,158px); background:var(--ab-line); }
.end__contact-position { position:absolute; right:10%; top:0; }.end__contact { position:relative; display:grid; place-items:center; width:clamp(128px,13vw,184px); aspect-ratio:1; transform:translateY(-50%); color:white; text-decoration:none; }
.end__orb { position:relative; display:grid; place-items:center; width:100%; height:100%; border-radius:50%; overflow:hidden; background:#455ce9; isolation:isolate; }
.end__orb-fill { position:absolute; z-index:-1; inset:0; border-radius:50%; background:#344bd5; transform:translateY(101%); transition:transform .6s cubic-bezier(.65,0,.35,1); }
.end__contact:hover .end__orb-fill,.end__contact:focus-visible .end__orb-fill { transform:translateY(0); }
.end__orb-text { display:block; text-align:center; font-size:17px; line-height:1.4; }.end__orb-text > span { display:block; margin-top:5px; font-size:12px; }
.end__body { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr); gap:clamp(40px,8vw,110px); }
.end__rows { display:flex; flex-wrap:wrap; gap:28px 40px; margin:0; }.end__row { min-width:0; }.end__row dt { display:flex; gap:10px; margin-bottom:10px; font-size:11px; line-height:1.5; color:var(--ab-soft); }.end__row dt > span { font-size:10px; }.end__row dd { margin:0; min-width:0; font-size:clamp(16px,1.6vw,22px); line-height:1.5; }
.end__a { color:inherit; overflow-wrap:anywhere; text-decoration:none; text-underline-offset:6px; }.end__a:hover,.end__a:focus-visible { text-decoration:underline; }
.end__availability { display:flex; flex-wrap:wrap; gap:22px 40px; margin-top:36px; }.end__availability p { font-size:13px; line-height:1.5; }.end__availability span { display:block; color:var(--ab-soft); margin-top:5px; font-size:11px; }
.end__actions { display:flex; flex-direction:column; }.end__action { display:flex; align-items:center; justify-content:space-between; gap:24px; min-width:0; min-height:100px; padding:20px 0; border-top:1px solid var(--ab-line); color:inherit; text-decoration:none; }.end__action-copy { display:flex; flex-direction:column; gap:8px; min-width:0; }.end__action-title { font-size:clamp(24px,2.5vw,32px); line-height:1.2; letter-spacing:-.035em; }.end__action-translation { font-size:12px; color:var(--ab-soft); }.end__action-arrow { flex:0 0 25px; width:25px; height:25px; stroke:currentColor; stroke-width:1.3; transition:transform .4s ease; }.end__action:hover .end__action-arrow { transform:translate(4px,-4px); }.end__action[download]:hover .end__action-arrow { transform:translateY(4px); }
.end__base { display:flex; align-items:center; justify-content:space-between; gap:24px; margin-top:clamp(60px,8vw,100px); padding-top:22px; border-top:1px solid var(--ab-line); }.end__next { display:flex; align-items:center; gap:32px; min-height:44px; color:inherit; text-decoration:none; font-size:15px; line-height:1.5; }.end__next > span > span { display:block; margin-top:3px; font-size:11px; color:var(--ab-soft); }.end__next > span:last-child { font-size:24px; transition:transform .35s ease; }.end__next:hover > span:last-child { transform:translate(3px,-3px); }.end__top { display:flex; align-items:center; gap:16px; min-height:44px; padding:0; border:0; background:none; color:inherit; font:inherit; font-size:12px; cursor:pointer; }.end a:focus-visible,.end button:focus-visible { outline:2px solid currentColor; outline-offset:6px; }
@media(max-width:760px) { .end__inner { padding-top:120px; }.end__head h2 { font-size:clamp(42px,9.5vw,66px); }.end__title-line img { margin-right:12px; }.end__heading-arrow { margin-right:0; flex:0 0 22px; }.end__rail { margin:100px 0 110px; }.end__contact-position { right:12%; }.end__body { grid-template-columns:1fr; gap:40px; }.end__actions { display:grid; grid-template-columns:1fr 1fr; gap:22px; }.end__action { min-height:92px; gap:12px; }.end__action-title { font-size:22px; }.end__action-arrow { width:20px; height:20px; flex-basis:20px; } }
@media(max-width:380px) { .end__head { gap:12px; }.end__head h2 { font-size:38px; }.end__heading-arrow { display:none; }.end__action-title { font-size:19px; }.end__orb-text { font-size:16px; }.end__contact-position { right:4%; } }
@media(prefers-reduced-motion:reduce) { .end__curve { transform:scaleY(.4); }.end__orb-fill,.end__action-arrow,.end__next > span:last-child { transition:none; }.end__contact-position { transform:none; } }
</style>
