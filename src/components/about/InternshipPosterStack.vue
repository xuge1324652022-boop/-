<template>
  <section ref="root" class="ims" :class="{ 'is-static': staticLayout, 'is-gathered': phase === 'gallery' || phase === 'complete' }" :aria-label="t.label">
    <div ref="stage" class="ims__stage">
      <header ref="heading" class="ims__heading">
        <span>01 / PRODUCT COMMUNICATION</span>
        <h2>{{ t.title }}</h2>
        <p>{{ t.lead }}</p>
        <p class="ims__hint">{{ t.hint }}</p>
      </header>
      <!-- 舞台不动；入场、收拢和每张遮罩只读取同一段滚动行程。 -->
      <div class="ims__space">
        <div v-for="(item, i) in items" :key="item.id" class="ims__sheet">
          <button class="ims__art" type="button" :tabindex="staticLayout || active === i ? 0 : -1" :aria-label="`${t.open}: ${pick(item.title, lang)}`"
            :data-cursor="lang === 'zh' ? '查看' : 'Explore'" data-cursor-action="view"
            :style="{ '--asset-ratio': item.width / item.height }"
            @click="emit('open', item, $event.currentTarget as HTMLElement)">
            <img :src="item.src" :srcset="i < preparedCount ? visualImageSources(item) : undefined"
              :sizes="displayWidths[i] ? `${Math.ceil(displayWidths[i]!)}px` : '(max-width: 760px) calc(100vw - 32px), min(90vw, 1280px)'"
              :width="item.width" :height="item.height"
              :alt="pick(item.alt, lang)" loading="eager" decoding="async" draggable="false" />
            <span class="ims__static-label">{{ pick(item.title, lang) }}</span>
          </button>
        </div>
      </div>
      <footer ref="footer" class="ims__footer">
        <div class="ims__caption">
          <span>{{ t.attribution }}</span><strong>{{ pick(items[active]!.title, lang) }}</strong>
          <span class="ims__status">{{ phase === 'complete' ? t.done : phase === 'gallery' ? t.watch : t.fold }}</span>
        </div>
        <nav class="ims__controls" :aria-label="t.chapters">
          <button v-for="(item, i) in items" :key="item.id" type="button"
            :aria-label="`${t.select}: ${pick(item.title, lang)}`" :aria-current="active === i ? 'true' : undefined"
            @click="go(i)">{{ projectNames[i] ?? pick(item.title, lang) }}</button>
        </nav>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../utils/responsiveImage'
/**
 * 实习海报的连续 sticky 行程：空间入场、收拢、逐张向下擦入由同一滚动坐标决定。
 * 数学节奏在 internshipStackMotion.ts，组件负责测量和写样式，点击只改变文档位置。
 * 帧函数仅在可见且布局已就绪时运行；取消队列、RAF、观察器和监听均由本实例负责。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { pick, type Lang } from '../../data/aboutProfile'
import type { VisualAsset } from '../../data/visualPortfolio'
import { STACK_FOLD_END, stackPagePosition, stackState, stackTravel } from './internshipStackMotion'
import { prepareMotionLayout, requestMotionLayoutRefresh } from '../../utils/motionLayout'

const props = defineProps<{ items: readonly VisualAsset[]; lang: Lang }>()
const emit = defineEmits<{ open: [item: VisualAsset, trigger: HTMLElement] }>()
const t = computed(() => props.lang === 'zh'
  ? { label: '实习海报叠层', title: '技术，成为画面', lead: '工程引导 / 激光测量 / 智能草坪', attribution: '实习产出', open: '查看完整实习作品', chapters: '选择实习项目', select: '观看项目', hint: '向下滚动，收拢后逐张观看 · 点击查看完整作品', fold: '向下滚动，收拢叠层 ↓', watch: '继续下滑，逐张观看 ↓', done: '本组已看完，继续下滑 ↓' }
  : { label: 'Internship poster stack', title: 'Technology, in view', lead: 'Machine guidance / Laser surveying / Smart lawn care', attribution: 'Internship work', open: 'View full internship work', chapters: 'Select internship project', select: 'View project', hint: 'Scroll to gather and explore every card · Click to view the full piece', fold: 'Scroll to gather the stack ↓', watch: 'Scroll to explore each card ↓', done: 'All cards viewed. Continue scrolling ↓' })
const projectNames = ['EC100', 'V10L', 'VELA']
const root = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)
const footer = ref<HTMLElement | null>(null)
const media = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = ref(media.matches)
const compactMedia = window.matchMedia('(max-height: 500px)')
const compact = ref(compactMedia.matches)
// 横屏不足500px时，固定页脚和标题会把纸面压得过小，改按流展示原作。
const staticLayout = computed(() => reduced.value || compact.value)
const active = ref(0)
const phase = ref('enter')
const displayWidths = ref<number[]>([])
const preparedCount = ref(2)
let sheets: HTMLElement[] = []
let artworks: HTMLButtonElement[] = []
let images: HTMLImageElement[] = []
let origin = 0, width = 0, height = 1, target = 0, current = 0, raf = 0
let observer: ResizeObserver | undefined
let dead = false, inView = false
let visibility: IntersectionObserver | undefined
let cancelMeasure: (() => void) | undefined
let cancelRefresh: (() => void) | undefined
let layoutReady = false
let lastPaintedPosition = NaN



/**
 * 一段连续、可倒放的行程：先推入透视叠层，再展平，之后每张从上向下覆盖。
 * z-index 在收拢结束时一次切为固定页序，不能在快速滚动时重新排列纸张。
 * 舞台高度与按钮目标统一读取放慢后的数学行程；不会再叠加一层延迟补间。
 * sticky 行程包含所有切图和末张停留，滚完这段才进入下一栏目。
 */
function paint(position: number, force = false) {
  // 首尾停留时文档仍在滚动，纸张状态却相同；不要重复提交整组 3D/遮罩样式。
  // 尺寸刷新必须强制重绘，即使当前的滚动进度没有改变。
  if (!force && position === lastPaintedPosition) return
  lastPaintedPosition = position
  const state = stackState(position, props.items.length)
  active.value = state.active
  // 只逐步开放当前页和下一页的高清候选；回滚保留已开放资源，避免清晰度反复切换。
  preparedCount.value = Math.max(preparedCount.value, state.active + 2)
  phase.value = state.phase
  const spread = 1 - state.fold
  const narrow = width <= 760
  const initialScale = narrow ? .8 : .6
  const scale = initialScale * spread + state.fold
  const gathered = position >= STACK_FOLD_END
  if (heading.value) {
    heading.value.style.opacity = String(1 - state.fold)
    heading.value.style.transform = `translateY(${-state.fold * 24}px)`
  }
  if (footer.value) footer.value.style.opacity = String(state.entry)
  sheets.forEach((sheet, i) => {
    const depth = narrow ? 650 : 900
    const z = -i / Math.max(1, props.items.length - 1) * depth * spread
    const y = height * (.60 - state.entry * .45 - i * .075) * spread
    const tilt = -14.4 * spread
    // 纸面收拢为同一平面后退出 3D 合成，避免共面图层在擦入上缘留下细线。
    sheet.style.transform = gathered ? 'translate(-50%,-50%)'
      : `translate(-50%,-50%) translate3d(0,${y}px,${z}px) rotateX(${tilt}deg) scale(${scale})`
    const reveal = gathered ? state.reveals[i]! : 1
    // 新页向下展开时，同步裁掉旧页已被覆盖的上半部。只依赖上层纸色背景
    // 盖住旧宽图，会在小数像素的共边处漏出一条横线；双向裁切不会改变作品画幅。
    const occlusion = gathered ? Math.max(0, ...state.reveals.slice(i + 1)) : 0
    // 用真实裁切区域命中作品；中点active只管理文案和键盘焦点，不屏蔽可见旧/新图。
    sheet.style.clipPath = `inset(${occlusion * 100}% 0% ${(1 - reveal) * 100}% 0%)`
    sheet.style.zIndex = String(gathered ? i + 1 : props.items.length - i)
    // 新页完全覆盖后隐藏旧页，避免不同画幅在亚像素边缘露出细线。
    const covered = gathered && state.reveals.slice(i + 1).some(value => value === 1)
    sheet.style.visibility = reveal > 0 && !covered ? 'visible' : 'hidden'
    // 覆盖区与页面同色，只擦走旧图；可见纸张的尺寸由真实 PDF 比例决定。
    sheet.style.backgroundColor = gathered ? 'var(--ab-bg)' : 'transparent'
    const image = images[i]
    if (image) image.style.transform = gathered && i > 0
      ? `translateY(${-Math.min(64, height * .08) * (1 - reveal)}px) scale(${1 + .04 * (1 - reveal)})` : 'none'
  })
}

function frame() {
  raf = 0
  if (dead || staticLayout.value || !inView || !layoutReady) return
  // 页面已有统一平滑滚动，卡片直接读取这一帧的文档位置，不再次叠加105ms追赶。
  current = target
  paint(current)
}
function requestFrame() {
  if (!raf && inView && !staticLayout.value && !dead && layoutReady) raf = requestAnimationFrame(frame)
}
function scroll() {
  // 离屏不读文档坐标；重新进入时 IntersectionObserver 会补采样当前位置。
  if (dead || staticLayout.value || !inView) return
  target = Math.max(0, Math.min(stackTravel(props.items.length), (scrollY - origin) / height))
  requestFrame()
}
function measure() {
  if (dead || !root.value || !stage.value) return
  origin = root.value.getBoundingClientRect().top + scrollY
  height = stage.value.clientHeight
  width = stage.value.clientWidth
  sheets = [...root.value.querySelectorAll<HTMLElement>('.ims__sheet')]
  artworks = sheets.map(sheet => sheet.querySelector<HTMLButtonElement>('.ims__art')!)
  images = sheets.map(sheet => sheet.querySelector('img')!)
  // Read every paper before changing any art/root size. Interleaving each
  // getComputedStyle with the previous card's write forces a full-page layout.
  const measuredWidths = artworks.map((art, i) => {
    if (staticLayout.value) return art.getBoundingClientRect().width
    const sheet = sheets[i]!
    const item = props.items[i]!
    const ratio = item.width / item.height
    // clientWidth/Height 会取整，容易让图片比擦除层大半个像素；读取实际 CSS 尺寸。
    const bounds = getComputedStyle(sheet)
    return Math.min(parseFloat(bounds.width), parseFloat(bounds.height) * ratio)
  })
  // CSS 会把 4628.400000000001px 规范化为 4628.4px；先归一精度再比较，
  // 避免测量→refresh→测量无限循环，否则原生平滑跳转会被反复刷新打断。
  const nextHeight = staticLayout.value ? 'auto' : `${Math.round(height * (1 + stackTravel(props.items.length)) * 1000) / 1000}px`
  if (root.value.style.height !== nextHeight) {
    root.value.style.height = nextHeight
    cancelRefresh?.()
    cancelRefresh = requestMotionLayoutRefresh()
  }
  if (!staticLayout.value) artworks.forEach((art, i) => {
    const nextWidth = `${measuredWidths[i]!}px`
    const nextArtHeight = `${measuredWidths[i]! / (props.items[i]!.width / props.items[i]!.height)}px`
    if (art.style.width !== nextWidth) art.style.width = nextWidth
    if (art.style.height !== nextArtHeight) art.style.height = nextArtHeight
  })
  if (measuredWidths.length !== displayWidths.value.length || measuredWidths.some((value, i) => value !== displayWidths.value[i])) displayWidths.value = measuredWidths
  if (staticLayout.value) preparedCount.value = props.items.length
  layoutReady = true
  target = Math.max(0, Math.min(stackTravel(props.items.length), (scrollY - origin) / height))
  requestFrame()
  current = target
  if (!staticLayout.value) paint(current, true)
}
function requestMeasure() {
  if (dead || !root.value || cancelMeasure) return
  cancelMeasure = prepareMotionLayout(root.value, () => {
    cancelMeasure = undefined
    measure()
  })
}
function go(index: number) {
  if (staticLayout.value || index < 0 || index >= props.items.length) return
  // 按钮跳到同一段行程的阅读位置；它不再另建一个与滚轮打架的 GSAP 时间线。
  // 上方字体/双语重分行可能先于合并测量队列落位，点击时只补读最新起点和舞台高。
  const liveOrigin = root.value ? root.value.getBoundingClientRect().top + scrollY : origin
  const liveHeight = stage.value?.clientHeight || height
  origin = liveOrigin
  height = liveHeight
  window.scrollTo({ top: origin + stackPagePosition(index, props.items.length) * height, behavior: 'smooth' })
}
async function configure() {
  reduced.value = media.matches
  compact.value = compactMedia.matches
  root.value?.toggleAttribute('data-motion-active', inView && !staticLayout.value)
  layoutReady = false
  cancelAnimationFrame(raf); raf = 0
  await nextTick()
  if (dead) return
  sheets.forEach(sheet => {
    sheet.removeAttribute('style')
  })
  images.forEach(image => image.style.removeProperty('transform'))
  artworks.forEach(art => { art.style.removeProperty('width'); art.style.removeProperty('height') })
  heading.value?.removeAttribute('style')
  footer.value?.removeAttribute('style')
  requestMeasure()
}
onMounted(() => {
  requestMeasure()
  observer = new ResizeObserver(requestMeasure)
  if (stage.value) observer.observe(stage.value)
  visibility = new IntersectionObserver(entries => {
    inView = !!entries[0]?.isIntersecting
    root.value?.toggleAttribute('data-motion-active', inView && !staticLayout.value)
    if (inView) scroll()
    else { cancelAnimationFrame(raf); raf = 0 }
  })
  if (root.value) visibility.observe(root.value)
  window.addEventListener('scroll', scroll, { passive: true })
  // 前方双语文字重分行/字体载入会改变本段文档起点，自身尺寸未变时 RO 不会通知。
  // 共享布局刷新后补测一次，防止滚轮与按钮仍按旧 origin 跳转。
  ScrollTrigger.addEventListener('refresh', requestMeasure)
  media.addEventListener('change', configure)
  compactMedia.addEventListener('change', configure)
  void document.fonts.ready.then(requestMeasure)
})
// 语言改变首屏介绍的行数后，重新读取舞台在文档中的起点。
watch(() => props.lang, async () => { await nextTick(); requestMeasure() })
onBeforeUnmount(() => {
  dead = true; cancelAnimationFrame(raf)
  cancelMeasure?.(); cancelRefresh?.()
  observer?.disconnect(); visibility?.disconnect()
  window.removeEventListener('scroll', scroll)
  ScrollTrigger.removeEventListener('refresh', requestMeasure)
  media.removeEventListener('change', configure)
  compactMedia.removeEventListener('change', configure)
})
</script>

<style scoped>
.ims { position:relative; background:var(--ab-bg); color:var(--ab-ink); }
.ims__stage { position:sticky; top:0; height:var(--stable-viewport-height,100vh); overflow:clip; }
.ims__heading { position:absolute; z-index:10; top:86px; left:4.4vw; right:4.4vw; pointer-events:none; }
.ims__heading span { font-size:10px; letter-spacing:.18em; color:var(--ab-soft); }
.ims__heading h2 { margin:14px 0 10px; font-size:clamp(34px,4.2vw,68px); font-weight:400; line-height:1; letter-spacing:-.04em; }
.ims__heading p { font-size:12px; color:var(--ab-soft); }
.ims__space { position:absolute; inset:0; perspective:1200px; perspective-origin:50% 50%; transform-style:preserve-3d; pointer-events:none; }
.ims.is-gathered .ims__space { perspective:none; transform-style:flat; }
/* 用统一纸面控制遮罩尺寸；限制最大宽度并留出顶栏、作品名和按钮的阅读空间。 */
.ims__sheet { position:absolute; left:50%; top:calc(50% - 10px); width:min(calc(100% - clamp(40px,10vw,160px)),1280px,calc((var(--stable-viewport-height,100vh) - 220px) * 1.912)); height:auto; aspect-ratio:1.912; transform-origin:center; backface-visibility:hidden; }
.ims[data-motion-active] .ims__sheet { will-change:transform,clip-path; }
.ims__art { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:100%; height:100%; aspect-ratio:var(--asset-ratio); display:block; padding:0; border:0; background:transparent; pointer-events:auto; cursor:zoom-in; overflow:clip; }
/* 绝对定位避免 grid 的自动最小尺寸把 PDF 页面撑出卡片；整页始终 contain。 */
.ims__sheet img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; pointer-events:none; }
.ims__static-label { display:none; }
.ims__art:focus-visible { outline:2px solid var(--ab-ink); outline-offset:4px; }
.ims__footer { position:absolute; left:4.4vw; right:4.4vw; bottom:24px; z-index:15; display:grid; grid-template-columns:1fr auto; align-items:end; gap:12px 24px; pointer-events:none; }
.ims__caption { display:grid; gap:8px; }
.ims__caption span { font-size:10px; color:var(--ab-soft); }
.ims__caption { min-width:0; }
.ims__caption strong { min-height:24px; font-size:clamp(13px,1.4vw,20px); font-weight:400; line-height:1.2; }
.ims__caption .ims__status { font-size:10px; }
.ims__controls { display:flex; gap:clamp(20px,2.4vw,36px); align-items:center; font-size:11px; pointer-events:auto; }
.ims__controls button { appearance:none; padding:14px 0; border:0; background:transparent; color:inherit; font:inherit; font-weight:400; letter-spacing:.04em; line-height:1.2; opacity:.46; cursor:pointer; transition:opacity .2s ease; }
.ims__controls button[aria-current="true"] { font-weight:500; opacity:1; }
.ims__controls button:hover { opacity:.8; }
.ims__controls button:focus-visible { opacity:1; outline:1px solid currentColor; outline-offset:6px; }
.ims__heading .ims__hint { margin-top:24px; font-size:10px; }
.is-static .ims__stage { height:auto; position:relative; padding:230px 5vw 140px; }
.is-static .ims__space { position:relative; perspective:none; display:grid; gap:30px; }
.is-static .ims__sheet { position:relative; top:auto; left:auto; width:min(100%,1280px); margin-inline:auto; height:auto; aspect-ratio:auto; transform:none; box-shadow:none; will-change:auto; }
.is-static .ims__art { position:relative; top:auto; left:auto; width:100%; height:auto; aspect-ratio:auto; transform:none; }
.is-static .ims__sheet img { position:static; height:auto; max-height:calc(var(--stable-viewport-height,100vh) * .75); }
.is-static .ims__static-label { display:block; margin-top:12px; font-size:12px; }
.is-static .ims__caption strong, .is-static .ims__status { display:none; }
.is-static .ims__controls { display:none; }
@media(max-width:760px) {
  .ims__heading { top:80px; }
  .ims__sheet { width:min(calc(100% - 32px),calc(var(--stable-viewport-height,100vh) - 264px)); height:auto; aspect-ratio:1; top:calc(50% - 30px); }
  .ims__footer { bottom:24px; gap:14px; }
  .ims__caption { grid-column:1/-1; }
  .ims__controls { grid-column:1/-1; }
}
</style>
