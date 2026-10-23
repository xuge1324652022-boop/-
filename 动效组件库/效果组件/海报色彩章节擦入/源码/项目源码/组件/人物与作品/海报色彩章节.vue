<template>
  <section ref="root" class="pc" :class="{ 'is-static': staticLayout }" :aria-label="lang === 'zh' ? '海报色彩章节' : 'Poster colour chapters'">
    <div ref="stage" class="pc__stage">
      <article v-for="(frame, i) in frames" :key="frame.item.id" class="pc__frame"
        :style="{ background: frame.paper, color: frame.ink }">
        <div class="pc__text">
          <p class="pc__eyebrow">COLOUR / POSTER STUDIES</p>
          <div><h2>{{ pick(frame.name, lang) }}</h2><p class="pc__description">{{ pick(frame.description, lang) }}</p>
            <p class="pc__work">{{ pick(frame.item.title, lang) }} · {{ frame.position }} / {{ frame.total }}</p>
          </div>
          <footer><span>{{ String(frame.group + 1).padStart(2, '0') }} / 04</span><span>{{ lang === 'zh' ? '向下滚动，探索颜色 ↓' : 'Scroll to explore colour ↓' }}</span></footer>
        </div>
        <button class="pc__art" type="button" :tabindex="staticLayout || active === i ? 0 : -1" :data-cursor="lang === 'zh' ? '查看' : 'Explore'" data-cursor-action="view" :aria-label="`${lang === 'zh' ? '查看色彩作品' : 'View colour study'}: ${pick(frame.item.title, lang)}`" @click="emit('open', frame.index, $event.currentTarget as HTMLElement)">
          <img :src="frame.item.src" :srcset="visualImageSources(frame.item)" sizes="(max-width: 760px) 90vw, 52vw" :width="frame.item.width" :height="frame.item.height" :alt="pick(frame.item.alt, lang)" loading="lazy" decoding="async" draggable="false" />
          <span>{{ lang === 'zh' ? '查看完整海报 ↗' : 'View full poster ↗' }}</span>
        </button>
      </article>
      <nav v-if="!staticLayout" class="pc__nav" :aria-label="lang === 'zh' ? '色彩章节切换' : 'Colour chapter navigation'">
        <button type="button" :disabled="active === 0" :aria-label="lang === 'zh' ? '上一件色彩作品' : 'Previous colour study'" @click="move(-1)">←</button>
        <button type="button" :disabled="active === frames.length - 1" :aria-label="lang === 'zh' ? '下一件色彩作品' : 'Next colour study'" @click="move(1)">→</button>
      </nav>
    </div>
  </section>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../工具/响应式图片'
/**
 * 合成海报示例的色彩阅读段：稳定素材 id 决定章节，frame.index 保留原列表索引，
 * 因此重新按颜色分组后仍能打开正确的大图。换组纵向揭示，同组横向揭示。
 * render 是仅有的遮罩写入者；95ms 指数追赶使用实际帧间隔，偏好变更会清掉旧裁切。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { pick, type Lang } from '../../数据/人物资料'
import type { VisualAsset } from '../../数据/视觉作品资料'
import { prepareMotionLayout, requestMotionLayoutRefresh } from '../../工具/动效布局调度'
const props = defineProps<{ items: readonly VisualAsset[]; lang: Lang }>()
const emit = defineEmits<{ open: [index: number, trigger: HTMLElement] }>()
// 按画面环境归组，使用稳定 id，避免素材排序改变时把作品配到错误颜色。
const groups = [
  { ids: ['sample-poster-01'], paper: '#513b2c', ink: '#f5e9d6', name: { zh: '暖棕', en: 'Warm brown' }, description: { zh: '以暖棕舞台承托合成几何图，演示明暗层次', en: 'A warm brown stage frames synthetic geometry to demonstrate tonal layers' } },
  { ids: ['sample-poster-02', 'sample-poster-04', 'sample-poster-07'], paper: '#b5a06b', ink: '#22251c', name: { zh: '沙金', en: 'Sand gold' }, description: { zh: '以沙金舞台比较色块、圆环和留白的关系', en: 'A sand gold stage compares colour blocks, rings and negative space' } },
  { ids: ['sample-poster-03', 'sample-poster-05', 'sample-poster-06'], paper: '#bccbd1', ink: '#202c30', name: { zh: '冷灰', en: 'Cool grey' }, description: { zh: '浅灰舞台与合成示例构成冷暖对照', en: 'A pale grey stage contrasts with the synthetic sample palette' } },
  { ids: ['sample-poster-08', 'sample-poster-09'], paper: '#77764f', ink: '#faf2dc', name: { zh: '灰绿', en: 'Grey green' }, description: { zh: '低饱和舞台呈现图形与文字的层级示例', en: 'A muted stage presents examples of hierarchy in shapes and text' } },
]
const frames = computed(() => groups.flatMap((group, n) => {
  const found = group.ids.flatMap(id => { const index = props.items.findIndex(item => item.id === id); return index < 0 ? [] : [{ item: props.items[index]!, index }] })
  return found.map((entry, i) => ({ ...group, ...entry, group: n, position: i + 1, total: found.length }))
}))
const root = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const media = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = ref(media.matches)
const compactMedia = window.matchMedia('(max-width: 760px) and (max-height: 660px), (max-height: 580px)')
const compact = ref(compactMedia.matches)
// 短视口容不下固定舞台时按流逐张阅读，内容、完整图和查看入口都保留。
const staticLayout = computed(() => reduced.value || compact.value)
const active = ref(0)
let panels: HTMLElement[] = []
let origin = 0, step = 1, raf = 0
let observer: ResizeObserver | undefined
let visibilityObserver: IntersectionObserver | undefined
let cancelMeasure: (() => void) | undefined
let cancelRefresh: (() => void) | undefined
let dead = false
let nearViewport = false
let groupChanges: boolean[] = []
const clamp = (v: number) => Math.max(0, Math.min(1, v))
gsap.registerPlugin(CustomEase)
// 与 CSS cubic-bezier(.42,0,.3,1) 同义：缓起、推进、缓停，不越过遮罩终点。
const revealEase = CustomEase.create('', '.42,0,.3,1')
// 每件作品最后一半行程揭开下一件；步长延长后，推进与完整阅读各增加约四成。
const REVEAL_WINDOW = .5
const SMOOTH_TAU = 120
let lastReveal: number[] = []
let lastVisibility: boolean[] = []
/** 每件作品先完整停留，再揭开下一件；末件也保留一个完整阅读段才解除 sticky。 */
let displayedScroll = window.scrollY
let lastFrame = 0
function render(now = performance.now()) {
  raf = 0
  if (dead || staticLayout.value) return
  // 只追赶本章节的有效行程；远离舞台或切到后台时直接落位，不为全页滚动空转。
  const target = Math.max(origin, Math.min(origin + Math.max(0, panels.length - 1) * step, window.scrollY))
  const dt = lastFrame ? Math.min(64, now - lastFrame) : 16
  lastFrame = now
  const immediate = !nearViewport || document.hidden || Math.abs(target - displayedScroll) > step
  displayedScroll = immediate ? target : displayedScroll + (target - displayedScroll) * (1 - Math.exp(-dt / SMOOTH_TAU))
  if (Math.abs(target - displayedScroll) < .2) { displayedScroll = target; lastFrame = 0 }
  else raf = requestAnimationFrame(render)
  const position = (displayedScroll - origin) / step
  let current = 0
  let base = 0, top = 0
  const reveals = panels.map((_, i) => {
    const t = i === 0 ? 1 : clamp((position - i + REVEAL_WINDOW) / REVEAL_WINDOW)
    // 曲线只映射滚动进度，不叠加独立 transition；快速反向时从当前遮罩连续回退。
    const p = revealEase(t)
    if (p >= .5) current = i
    if (p >= 1) base = i
    if (p > 0) top = i
    return p
  })
  panels.forEach((panel, i) => {
    const p = reveals[i]!
    if (p !== lastReveal[i]) {
      lastReveal[i] = p
      panel.style.clipPath = groupChanges[i] ? `inset(${(1-p)*100}% 0 0)` : `inset(0 ${(1-p)*100}% 0 0)`
    }
    // 可见区域保留触摸命中；不以active的中点切inert，避免擦入中的新图点穿旧图。
    // 完全覆盖后只保留顶层；过渡时最多绘制底图和正在揭开的图，反向时仍可恢复。
    const visible = i === base || i === top
    if (visible !== lastVisibility[i]) {
      lastVisibility[i] = visible
      panel.style.visibility = visible ? 'visible' : 'hidden'
    }
  })
  active.value = current
}
function scroll() {
  if (!raf && !staticLayout.value && nearViewport && !document.hidden) raf = requestAnimationFrame(render)
}
function measure() {
  if (dead || !root.value || !stage.value) return
  origin = root.value.getBoundingClientRect().top + window.scrollY
  // 与CSS的100svh使用同一把尺子；手机地址栏收合不应重排整段长滚动距离。
  step = Math.max(840, stage.value.clientHeight * 1.75)
  panels = Array.from(root.value.querySelectorAll<HTMLElement>('.pc__frame'))
  const height = staticLayout.value ? 'auto' : `${stage.value.clientHeight + frames.value.length * step}px`
  groupChanges = frames.value.map((frame, i) => i === 0 || frame.group !== frames.value[i - 1]?.group)
  lastReveal = []
  lastVisibility = []
  // 只有真实行程变化才刷新整页；共享队列会合并前后章节的刷新请求。
  if (root.value.style.height !== height) {
    root.value.style.height = height
    cancelRefresh?.()
    cancelRefresh = requestMotionLayoutRefresh()
  }
  cancelAnimationFrame(raf)
  raf = 0
  displayedScroll = window.scrollY
  lastFrame = 0
  render()
}
function queueMeasure() {
  if (dead || !root.value) return
  cancelMeasure?.()
  cancelMeasure = prepareMotionLayout(root.value, measure)
}
function move(direction: number) { window.scrollTo({ top: origin + (active.value + direction + .25) * step, behavior: 'smooth' }) }
async function preference() {
  reduced.value = media.matches
  compact.value = compactMedia.matches
  cancelAnimationFrame(raf); raf = 0
  await nextTick()
  if (dead) return
  panels.forEach(panel => { panel.style.removeProperty('clip-path'); panel.style.removeProperty('visibility') })
  queueMeasure()
}
function visibility() {
  cancelAnimationFrame(raf)
  raf = 0
  lastFrame = 0
  if (document.hidden) { displayedScroll = window.scrollY; render() }
  else scroll()
}
watch(() => props.lang, () => { void nextTick(queueMeasure) })
watch(frames, () => { void nextTick(queueMeasure) })
onMounted(() => {
  queueMeasure()
  observer = new ResizeObserver(queueMeasure)
  if (stage.value) observer.observe(stage.value)
  visibilityObserver = new IntersectionObserver(([entry]) => {
    nearViewport = entry?.isIntersecting ?? false
    if (nearViewport) scroll()
    else { cancelAnimationFrame(raf); raf = 0; lastFrame = 0; render() }
  }, { rootMargin: '120px 0px' })
  if (stage.value) visibilityObserver.observe(stage.value)
  window.addEventListener('scroll', scroll, { passive: true })
  window.addEventListener('resize', queueMeasure)
  document.addEventListener('visibilitychange', visibility)
  // 前面的堆叠或 pin 行程变化不会改变固定舞台尺寸，必须在全局刷新后重量 origin。
  ScrollTrigger.addEventListener('refresh', queueMeasure)
  media.addEventListener('change', preference)
  compactMedia.addEventListener('change', preference)
  void document.fonts.ready.then(queueMeasure)
})
onBeforeUnmount(() => {
  dead = true
  cancelMeasure?.(); cancelRefresh?.(); observer?.disconnect(); visibilityObserver?.disconnect(); cancelAnimationFrame(raf)
  window.removeEventListener('scroll', scroll)
  window.removeEventListener('resize', queueMeasure)
  document.removeEventListener('visibilitychange', visibility)
  ScrollTrigger.removeEventListener('refresh', queueMeasure)
  media.removeEventListener('change', preference)
  compactMedia.removeEventListener('change', preference)
})
</script>

<style scoped>
.pc { position:relative; }
.pc__stage { position:sticky; top:0; height:var(--stable-viewport-height,100vh); min-height:580px; isolation:isolate; }
.pc__frame { position:absolute; inset:0; display:grid; grid-template-columns:minmax(0, 42fr) minmax(0, 58fr); padding:90px 4vw 48px; gap:3vw; overflow:hidden; box-sizing:border-box; }
.pc__frame:not(:first-child) { clip-path:inset(100% 0 0); }
.pc__text { display:flex; flex-direction:column; justify-content:space-between; min-width:0; padding-right:3vw; }
.pc__eyebrow { font-size:10px; letter-spacing:.18em; }
.pc h2 { margin:0 0 28px; font-size:clamp(56px,8vw,132px); line-height:1.05; font-weight:400; letter-spacing:-.04em; }
.pc__description { max-width:450px; font-size:clamp(17px,1.7vw,28px); line-height:1.5; }
.pc__work { font-size:12px; margin-top:28px; opacity:.8; }
.pc footer { display:flex; justify-content:space-between; gap:12px; font-size:12px; }
.pc__art { min-width:0; min-height:0; width:100%; padding:0; background:none; border:0; color:inherit; display:flex; flex-direction:column; justify-content:center; gap:16px; cursor:zoom-in; }
.pc__art img { display:block; width:100%; height:calc(100% - 36px); min-height:0; object-fit:contain; }
.pc__art span { font-size:11px; text-align:right; }
.pc__nav { position:absolute; z-index:10; bottom:12px; right:4vw; display:flex; gap:8px; }
.pc__nav button { appearance:none; border:0; border-radius:0; color:#fff; mix-blend-mode:difference; background:transparent; width:44px; height:44px; cursor:pointer; }
.pc__nav button:disabled { opacity:.35; cursor:default; }
.pc button:focus-visible { outline:2px solid currentColor; outline-offset:4px; }
.is-static .pc__stage { height:auto; position:relative; }
.is-static .pc__frame { position:relative; min-height:calc(var(--stable-viewport-height,100vh) * .8); clip-path:none; }
.is-static .pc__art img { height:auto; max-height:calc(var(--stable-viewport-height,100vh) * .7); }
@media(max-width:760px) {
 .pc__stage { min-height:620px; }
 .pc__frame { grid-template-columns:1fr; grid-template-rows:46% 54%; gap:0; padding:76px 6vw 54px; }
 .pc__text { padding:0; }
 .pc__eyebrow { margin:0 0 12px; }
 .pc h2 { font-size:52px; margin-bottom:12px; }
 .pc__description { font-size:16px; margin:0; }
 .pc__work { margin:12px 0; }
 .pc footer { font-size:10px; }
 .pc__art { padding:18px 0 0; gap:8px; }
 .pc__art img { height:calc(100% - 20px); }
 .is-static .pc__stage { min-height:0; }
 .is-static .pc__frame { min-height:0; grid-template-rows:auto auto; padding-bottom:48px; }
 .is-static .pc__art { padding-top:32px; }
}
</style>
