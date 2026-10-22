<template>
  <section ref="root" class="palette" :class="{ 'is-reduced': reduced, 'is-flow': reduced || compact }" :style="{ '--poster-count': items.length }" :aria-label="lang === 'zh' ? '海报色彩探索' : 'Explore poster colours'">
    <div ref="stage" class="palette__stage">
      <div class="palette__top"><span class="palette__title">02 / {{ pick(MILITARY_SERIES_TITLE, lang) }}</span><span class="palette__hint">{{ reduced || compact ? (lang === 'zh' ? '点击色带探索' : 'Select a colour strip') : (lang === 'zh' ? '滚动展开 · 点击色带探索' : 'Scroll to unfold · Select a colour strip') }}</span></div>
      <div class="palette__bands">
        <article v-for="(item, i) in items" :key="item.id" class="palette__band" :class="{ 'is-active': i === active }" :style="colours(i)">
          <button class="palette__tab" type="button" :aria-expanded="i === active" :aria-controls="`poster-panel-${item.id}`"
            :data-cursor="lang === 'zh' ? '探索' : 'Explore'" data-cursor-action="explore" data-cursor-blend="normal" :data-cursor-color="colours(i).color"
            :aria-label="`${lang === 'zh' ? '展开' : 'Explore'} ${pick(item.title, lang)}`" @click="select(i)"
            @keydown.right.prevent="select(Math.min(items.length - 1, i + 1), true)" @keydown.left.prevent="select(Math.max(0, i - 1), true)">
            <span>{{ String(i + 1).padStart(2, '0') }}</span><span>{{ pick(item.title, lang) }}</span><span aria-hidden="true">{{ i === active ? '−' : '+' }}</span>
          </button>
          <!-- 色带负责宽度；内部固定尺寸，展开仅改变遮罩，海报不会被挤压变形。 -->
          <div :id="`poster-panel-${item.id}`" class="palette__panel" :inert="i !== active" :aria-hidden="i !== active">
            <div class="palette__copy"><span>PERSONAL POSTER SERIES</span><h2>{{ pick(item.title, lang) }}</h2></div>
            <button class="palette__art" type="button" :data-cursor="lang === 'zh' ? '查看' : 'Explore'" data-cursor-action="view" :tabindex="i === active ? 0 : -1" :aria-label="`${lang === 'zh' ? '查看完整作品' : 'View full piece'}: ${pick(item.title, lang)}`" @click="emit('open', i, $event.currentTarget as HTMLElement)">
              <img :src="item.src" :srcset="visualImageSources(item)" sizes="(max-width: 760px) 90vw, 65vw" :width="item.width" :height="item.height" :alt="pick(item.alt, lang)" :loading="i < 2 ? 'eager' : 'lazy'" decoding="async" draggable="false" />
              <span>{{ lang === 'zh' ? '查看完整作品 ↗' : 'View full piece ↗' }}</span>
            </button>
            <div class="palette__caption"><p class="palette__description">{{ pick(MILITARY_PROFILES[item.id] ?? fallback, lang) }}</p><div aria-hidden="true" class="palette__swatches"><i v-for="c in tones[i % tones.length]" :key="c" :style="{background:c}" /></div></div>
          </div>
        </article>
      </div>
      <footer class="palette__bottom"><span>{{ String(active + 1).padStart(2, '0') }} / {{ String(items.length).padStart(2, '0') }}</span><span>{{ lang === 'zh' ? '颜色来自画面，作品保留原色' : 'Colour follows the image. The artwork stays unchanged' }}</span><div><button type="button" :disabled="active === 0" @click="select(active - 1)" :aria-label="lang === 'zh' ? '上一张海报' : 'Previous poster'">←</button><button type="button" :disabled="active === items.length - 1" @click="select(active + 1)" :aria-label="lang === 'zh' ? '下一张海报' : 'Next poster'">→</button></div></footer>
    </div>
  </section>
</template>
<script setup lang="ts">
import { visualImageSources } from '../../utils/responsiveImage'
/**
 * 个人海报色带：滚轮与按钮共用展开状态，图像保持固定内部画幅，只改变外侧权重。
 * 点击通过 open 把原列表索引交给页面，查看器不在这里创建；卸载撤销补间与观察器。
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { pick, type Lang } from '../../data/aboutProfile'
import type { VisualAsset } from '../../data/visualPortfolio'
import { MILITARY_PROFILES, MILITARY_SERIES_TITLE } from '../../data/posterPage'
import { prepareMotionLayout, requestMotionLayoutRefresh } from '../../utils/motionLayout'
const props = defineProps<{ items: readonly VisualAsset[]; lang: Lang }>()
const emit = defineEmits<{ change: [index: number]; open: [index: number, trigger: HTMLElement] }>()
const root = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const active = ref(0)
/**
 * 显式点选的语义状态与滚动展开项分开保存（null = 未点选）。
 * 当前页面只消费 open；仍保留 change 接口供组合页面同步选中作品，
 * 避免下游说明依赖它时，被随后滚动到末项的视觉状态无意覆盖。
 */
const chosen = ref<number | null>(null)
const media = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = ref(media.matches)
// 650px 的竖向色带舞台放不进短手机/横屏；这时保留手动展开，让整块随页面阅读。
const compactMedia = window.matchMedia('(max-width: 760px) and (max-height: 660px), (max-height: 500px)')
const compact = ref(compactMedia.matches)
const fallback = { zh: '个人主题海报系列', en: 'Personal poster series' }
// 根据现有作品的火光、麦田、雪地和天空选舞台色；不改动素材，不用滤镜模拟颜色。
const tones = [
  ['#453529','#F0E3D0','#BF753F'], ['#C6AE78','#29281E','#83AFCA'],
  ['#D8E0E3','#28363D','#6C7B62'], ['#73714B','#FBF3DC','#B4C5CE'],
  ['#B8CBD6','#24353B','#5A6350'], ['#AEBAC0','#202E34','#66704D'],
  ['#AEA16F','#262C26','#7DA4BA'], ['#514A37','#F5E8C9','#C39B56'],
  ['#C2A34F','#242716','#606739'],
]
/*
 * 色带自己的纸色 / 墨色直接写成 `background` / `color`。
 * ⚠️ 不再额外声明 `--paper` / `--ink`：这两条自定义属性写进 inline style 之后
 *    没有一处 `var()` 读它们（`background` / `color` 本身就是终值），
 *    留着只会让人以为「改 `--paper` 能换底色」。
 */
function colours(i: number) { const t = tones[i % tones.length]!; return { background:t[0], color:t[1] } }
let origin = 0
let step = 1
let raf = 0
let observer: ResizeObserver | undefined
let visibilityObserver: IntersectionObserver | undefined
let cancelMeasure: (() => void) | undefined
let cancelRefresh: (() => void) | undefined
let dead = false
let nearViewport = false
let measuredWidth = -1, measuredHeight = -1, measuredLang = ''
let bands: HTMLElement[] = []
let weights: number[] = []
let unfold: gsap.core.Tween | undefined

/**
 * 所有色带共用一个展开进度，权重之和始终为 1。
 * 快速滚动时从当前权重续接，取消上一轮补间；不能让九条 CSS 宽度动画各自收尾，
 * 否则临时总宽会超出舞台，焦点还可能把 overflow:hidden 容器向左滚走。
 */
function unfoldTo(index: number, immediate = false) {
  unfold?.kill()
  if (!bands.length) return
  const from = weights.slice()
  const progress = { value: 0 }
  const paint = () => {
    bands.forEach((band, i) => {
      const weight = from[i] ?? 0
      weights[i] = weight + ((i === index ? 1 : 0) - weight) * progress.value
      band.style.setProperty('--band-weight', String(weights[i]))
    })
  }
  if (immediate || reduced.value) { progress.value = 1; paint(); return }
  // 缓起、展开、落定各有时间；新选择始终从当前宽度续接，不把上一张强行补到终点。
  unfold = gsap.to(progress, { value: 1, duration: .92, ease: 'power2.inOut', onUpdate: paint })
}
/*
 * 点选 = **显式选择**：先记住 `chosen`（此后滚动不再改写对外上报的选择），
 * 再往外发 `change`，最后把视口定位到那一条自己的滚动段（这样「展开」与
 * 对外选择立刻对齐，不会出现「点了第 4 条但屏幕上展开的是第 7 条」）。
 * 减少动态下没有滚动轨道，直接落到视觉展开项上。
 */
function select(index: number, focus = false) {
  if (!props.items.length) return
  index = Math.max(0, Math.min(props.items.length - 1, index))
  // 显式选择：先钉住（之后滚动不再覆盖），再往外发
  chosen.value = index
  emit('change', index)
  // 点选与滚动共用同一段的阅读位置，定位后仍由同一个展开补间自然落定。
  setActive(index)
  if (!reduced.value && !compact.value) window.scrollTo({ top: origin + (index + .5) * step, behavior: 'instant' })
  if (focus) root.value?.querySelectorAll<HTMLButtonElement>('.palette__tab')[index]?.focus({preventScroll:true})
}
/**
 * 只改**视觉上的展开项**，并按 `chosen` 决定要不要往外发 `change`。
 * ⚠️ 视觉展开**仍然**跟着滚动走（那是「滚动展开」这条展示本身），
 *    但对外的语义选择在用户显式点过之后就不再由滚动改写。
 */
function setActive(index: number, immediate = false) {
  if (active.value === index) {
    if (immediate && unfold?.isActive()) unfoldTo(index, true)
    return
  }
  active.value = index
  unfoldTo(index, immediate)
  if (chosen.value === null) emit('change', index)
}
function render() {
  raf = 0
  if (dead || !root.value || reduced.value || compact.value) return
  const progress = (window.scrollY - origin) / step
  const index = Math.max(0, Math.min(props.items.length - 1, Math.floor(progress)))
  // 段落中点不再强制收尾；仍在舞台内时完整播放展开，只有离开章节才直接同步。
  setActive(index, !nearViewport || document.hidden || progress < 0 || progress >= props.items.length)
}
function onScroll() {
  if (!raf && !reduced.value && !compact.value && nearViewport && !document.hidden) raf = requestAnimationFrame(render)
}
function measure() {
  if (dead || !root.value || !stage.value) return
  const host = stage.value.querySelector<HTMLElement>('.palette__bands')!
  if (!bands.length) {
    bands = [...host.querySelectorAll<HTMLElement>('.palette__band')]
    weights = bands.map((_, i) => i === active.value ? 1 : 0)
    unfoldTo(active.value, true)
  }
  // 固定内部画幅，外侧色带只负责揭开；使用容器宽度，避免 vw 包含滚动条的偏差。
  const hostWidth = host.getBoundingClientRect().width
  const hostHeight = host.clientHeight
  const stageHeight = stage.value.clientHeight
  origin = root.value.getBoundingClientRect().top + window.scrollY
  // 标题轨道始终等于收起色带的宽度，不随激活状态或展开补间重新居中。
  const tabWidth = hostWidth * .038
  const expandedShare = 1 - Math.max(0, props.items.length - 1) * .038
  if (hostWidth !== measuredWidth || hostHeight !== measuredHeight || props.lang !== measuredLang) {
    measuredWidth = hostWidth; measuredHeight = hostHeight; measuredLang = props.lang
    stage.value.style.setProperty('--tab-width', `${tabWidth}px`)
    stage.value.style.setProperty('--panel-width', `${Math.max(0, hostWidth * expandedShare - tabWidth)}px`)
    stage.value.style.setProperty('--panel-height', `${Math.max(0, hostHeight - props.items.length * 29)}px`)
    // 仅在宽高或语言真正变化时计算最长说明；全局刷新只更新起点，不重复强制布局。
    stage.value.style.removeProperty('--description-height')
    const descriptions = [...host.querySelectorAll<HTMLElement>('.palette__description')]
    const descriptionHeight = Math.max(0, ...descriptions.map((description) => description.scrollHeight))
    stage.value.style.setProperty('--description-height', `${descriptionHeight}px`)
  }
  // 每件作品分到一屏行程，展开后留出完整阅读距离；点击与滚动始终共用这个步长。
  step = Math.max(480, stageHeight)
  const height = reduced.value || compact.value ? 'auto' : `${stageHeight + props.items.length * step}px`
  if (root.value.style.height !== height) {
    root.value.style.height = height
    cancelRefresh?.()
    cancelRefresh = requestMotionLayoutRefresh()
  }
  render()
}
function queueMeasure() {
  if (dead || !root.value) return
  cancelMeasure?.()
  cancelMeasure = prepareMotionLayout(root.value, measure)
}
function preference() {
  reduced.value = media.matches
  compact.value = compactMedia.matches
  cancelAnimationFrame(raf); raf = 0
  unfoldTo(active.value, true)
  // 等 is-flow 改变舞台的真实高度再测，横竖屏切换不能留下长滚动轨道。
  void nextTick(queueMeasure)
}
function visibility() {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; unfoldTo(active.value, true) }
  else render()
}
// 语言切换会改变章节标题的换行数及前序页面高度，更新画幅和滚动起点。
watch(() => props.lang, () => { void nextTick(queueMeasure) })
onMounted(() => {
  queueMeasure()
  observer = new ResizeObserver(queueMeasure)
  if (stage.value) observer.observe(stage.value)
  visibilityObserver = new IntersectionObserver(([entry]) => {
    nearViewport = entry?.isIntersecting ?? false
    if (!nearViewport) { cancelAnimationFrame(raf); raf = 0 }
    render()
  }, { rootMargin: '120px 0px' })
  if (stage.value) visibilityObserver.observe(stage.value)
  void document.fonts.ready.then(() => {
    // 字体会改变说明高度，即便容器尺寸不变也需要重新预留。
    measuredLang = ''
    queueMeasure()
  })
  window.addEventListener('scroll', onScroll, {passive:true})
  // stage 的高度可能不变而宽度/760px排版已变，ResizeObserver 仅看stage不足以覆盖。
  window.addEventListener('resize', queueMeasure, { passive:true })
  document.addEventListener('visibilitychange', visibility)
  ScrollTrigger.addEventListener('refresh', queueMeasure)
  media.addEventListener('change', preference)
  compactMedia.addEventListener('change', preference)
})
onBeforeUnmount(() => {
  dead = true; cancelMeasure?.(); cancelRefresh?.(); observer?.disconnect(); visibilityObserver?.disconnect(); cancelAnimationFrame(raf); unfold?.kill()
  window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', visibility)
  window.removeEventListener('resize', queueMeasure)
  ScrollTrigger.removeEventListener('refresh', queueMeasure); media.removeEventListener('change', preference)
  compactMedia.removeEventListener('change', preference)
})
</script>
<style scoped>
.palette { position:relative; background:#e9e7e1; color:#232421; }
.palette__stage { position:sticky; top:0; height:var(--stable-viewport-height,100vh); min-height:560px; padding:76px 0 0; box-sizing:border-box; display:flex; flex-direction:column; }
.palette__top,.palette__bottom { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:20px 4vw; font-size:11px; }
.palette__title { min-width:0; line-height:1.65; }
.palette__hint { flex-shrink:0; line-height:1.65; }
/* clip 不建立可滚动容器，色带内焦点变化也不会悄悄改变 scrollLeft。 */
.palette__bands { display:flex; flex:1; min-height:0; overflow:clip; }
.palette__band { position:relative; min-width:0; min-height:0; flex:0 0 calc(3.8% + (100% - 3.8% * var(--poster-count)) * var(--band-weight,0)); overflow:clip; }
.palette__tab { position:absolute; top:0; left:0; bottom:0; width:var(--tab-width,44px); box-sizing:border-box; background:transparent; color:inherit; border:0; display:flex; align-items:center; flex-direction:column; justify-content:space-between; padding:22px 0; cursor:pointer; font-size:12px; z-index:2; }
/* 分隔线只改变透明度，不参与布局，避免边框使文字中心偏移半个像素。 */
.palette__tab::after { content:''; position:absolute; top:0; right:0; bottom:0; width:1px; background:#8884; opacity:var(--band-weight,0); pointer-events:none; }
.palette__tab span { flex-shrink:0; white-space:nowrap; }
.palette__tab span:nth-child(2) { writing-mode:vertical-rl; letter-spacing:.1em; }
.palette__panel { position:relative; margin-left:var(--tab-width,44px); width:var(--panel-width,calc(69.6vw - 44px)); height:100%; box-sizing:border-box; padding:22px 24px; display:flex; flex-direction:column; justify-content:space-between; gap:16px; opacity:clamp(0,calc(var(--band-weight,0) * 4),1); clip-path:inset(0 calc((1 - var(--band-weight,0)) * 100%) 0 0); }
.palette__copy { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.palette__copy span { font-size:9px; letter-spacing:.12em; }
.palette__copy h2 { font-size:clamp(20px,2.6vw,42px); font-weight:500; margin:0; }
.palette__art { display:flex; flex:1; min-height:0; width:100%; flex-direction:column; align-items:center; justify-content:center; padding:0; border:0; background:transparent; color:inherit; cursor:zoom-in; }
.palette__art img { display:block; width:100%; height:100%; min-height:0; object-fit:contain; }
.palette__art span { margin-top:10px; font-size:10px; }
.palette__caption { display:flex; align-items:flex-end; flex-shrink:0; gap:20px; font-size:11px; line-height:1.7; }
/* 预留说明高度，切换装备时图片不会随介绍的长短上下跳动。 */
.palette__description { display:flex; align-items:flex-end; flex:1; min-width:0; min-height:var(--description-height,6.8em); margin:0; text-align:left; }
.palette__swatches { display:flex; margin-left:auto; flex-shrink:0; }
.palette__swatches i { width:24px; height:24px; border:1px solid #8884; }
.palette__bottom button { appearance:none; background:transparent; border:0; border-radius:0; color:#fff; mix-blend-mode:difference; padding:8px 6px; margin-left:16px; font-size:18px; line-height:1; cursor:pointer; }
.palette__bottom button:disabled { opacity:.3; cursor:default; }
.palette button:focus-visible { outline:2px solid currentColor; outline-offset:-4px; }
.is-reduced .palette__stage { position:relative; }
.is-reduced .palette__band,.is-reduced .palette__panel { transition:none; }
.is-flow .palette__stage { position:relative; height:auto; min-height:0; }
.is-flow .palette__bands { flex:none; height:clamp(420px,calc(var(--stable-viewport-height,100vh) * .75),760px); }
@media(max-width:760px) {
 .palette__stage { min-height:650px; padding-top:60px; }
 .palette__top { flex-direction:column; align-items:flex-start; gap:6px; font-size:9px; padding:14px 5vw; }
 .palette__bands { flex-direction:column; }
 .palette__band { flex-basis:calc(29px + (100% - 29px * var(--poster-count)) * var(--band-weight,0)); }
 .palette__tab { width:100%; height:29px; bottom:auto; flex-direction:row; padding:0 5vw; font-size:10px; }
 .palette__tab::after { display:none; }
 .palette__tab span:nth-child(2) { writing-mode:horizontal-tb; }
 .palette__panel { margin:29px 0 0; width:100%; height:var(--panel-height); padding:8px 5vw 12px; gap:8px; clip-path:inset(0 0 calc((1 - var(--band-weight,0)) * 100%)); }
 .palette__copy { display:none; }
 .palette__caption { font-size:10px; line-height:1.5; }
 .palette__description { min-height:var(--description-height,10.5em); }
 .palette__swatches { display:none; }
 .palette__bottom { padding:12px 5vw; font-size:10px; }
 .palette__bottom>span:nth-child(2) { display:none; }
 /* 色带和同一张完整作品仍在原Accordion中；普通流使说明与底部切换都可滚到。 */
 .is-flow .palette__stage { min-height:0; }
 .is-flow .palette__bands { height:calc(var(--poster-count) * 29px + max(360px,calc(var(--stable-viewport-height,100vh) * .68))); }
}
@media(prefers-reduced-motion:reduce) { .palette__band,.palette__panel { transition:none; } }
</style>
