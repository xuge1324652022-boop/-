<template>
  <!-- 正式作品迁入前的主题基础页；这里的时间线与取景框是交互排版研究。 -->
  <main ref="root" class="foundation" :class="`foundation--${kind}`">
    <section class="foundation__hero foundation__container" :aria-label="page.title.zh">
      <p class="foundation__chapter">{{ page.id }} / {{ page.title.zh }} <span lang="en">{{ page.title.en }}</span></p>
      <h1 ref="heading" class="foundation__heading">{{ page.heading }}</h1>
      <ReferenceIntroduction class="foundation__introduction" :label="page.title" :text="page.introduction" :active="ready" />
    </section>

    <section class="foundation__study foundation__container" :aria-label="page.studyLabel.zh">
      <div class="foundation__study-top">
        <p><span>{{ page.studyLabel.zh }}</span><span lang="en">{{ page.studyLabel.en }}</span></p>
        <span>{{ kind === 'edit' ? '移动时间线，试试不同的停顿' : '选择主题，改变观察的角度' }}<small lang="en">{{ kind === 'edit' ? 'Move the playhead to explore the pace' : 'Choose a different point of view' }}</small></span>
      </div>
      <div class="foundation__tabs" role="tablist" :aria-label="page.studyLabel.zh">
        <button v-for="(theme, index) in page.themes" :id="`${kind}-tab-${theme.key}`" :key="theme.key" role="tab" type="button"
          data-cursor="Explore" data-cursor-zh="切换" data-cursor-en="Explore" data-cursor-action="explore"
          :aria-selected="selected === index" :tabindex="selected === index ? 0 : -1" :aria-controls="`${kind}-study-panel`"
          @click="selectTheme(index)" @keydown="onTabKeydown($event, index)">
          <span>{{ theme.title.zh }}</span><span lang="en">{{ theme.title.en }}</span>
        </button>
      </div>
      <div :id="`${kind}-study-panel`" class="foundation__panel" role="tabpanel" tabindex="0" :aria-labelledby="`${kind}-tab-${activeTheme.key}`" :style="{ '--playhead': playhead / 100, '--word-size': `${110 / Math.max(1, activeTheme.words[visibleWord]!.length)}vw` }">
        <div class="foundation__screen">
          <div v-if="kind === 'news'" class="foundation__frame" aria-hidden="true"><i /><i /><i /><i /></div>
          <Transition name="foundation-type" mode="out-in">
            <div :key="activeTheme.key" class="foundation__screen-copy">
              <p class="foundation__screen-note">{{ activeTheme.title.zh }} <span lang="en">{{ activeTheme.title.en }}</span></p>
              <p class="foundation__screen-word" lang="en">{{ activeTheme.words[visibleWord] }}</p>
              <p class="foundation__screen-subtitle">{{ activeTheme.description.zh }}<span lang="en">{{ activeTheme.description.en }}</span></p>
            </div>
          </Transition>
          <span class="foundation__screen-register" aria-hidden="true">{{ kind === 'edit' ? 'Picture / Sound / Time' : 'People / Place / Context' }}</span>
        </div>
        <div v-if="kind === 'edit'" class="foundation__timeline">
          <div class="foundation__tracks" aria-hidden="true">
            <div class="foundation__picture-track"><span>Image</span><i /><i /><i /><i /></div>
            <div class="foundation__sound-track"><span>Sound</span><i v-for="n in 48" :key="n" :style="{ '--level': `${24 + ((n * 17) % 65)}%` }" /></div>
            <div class="foundation__playhead" />
          </div>
          <div class="foundation__transport">
            <button type="button" :data-cursor="playing ? 'Pause' : 'Play'" :data-cursor-zh="playing ? '暂停' : '播放'" :data-cursor-en="playing ? 'Pause' : 'Play'" data-cursor-action="playback" :aria-label="playing ? '暂停节奏演示 / Pause study' : '播放节奏演示 / Play study'" :aria-pressed="playing" @click="togglePlayback"><span aria-hidden="true">{{ playing ? 'Ⅱ' : '▷' }}</span><span>{{ playing ? '暂停' : '播放' }}</span><span lang="en">{{ playing ? 'Pause' : 'Play' }}</span></button>
            <input :value="playhead" type="range" min="0" max="100" step="0.1" aria-label="节奏时间线 / Rhythm timeline" @input="seek" />
            <output>{{ String(Math.round(playhead / 100 * 12)).padStart(2, '0') }} / 12s</output>
          </div>
        </div>
        <div v-else class="foundation__news-links" aria-hidden="true"><span>Who / 谁</span><span>Where / 哪里</span><span>Why / 为什么</span></div>
      </div>
      <p class="foundation__study-caption"><span>动态排版与主题研究</span><span lang="en">Motion type & theme studies</span></p>
    </section>

    <section class="foundation__notes foundation__container" :aria-label="kind === 'edit' ? '剪辑主题' : '新闻影像主题'">
      <article v-for="theme in page.themes" :id="`${kind}-${theme.key}`" :key="theme.key" class="foundation__note">
        <h2><span>{{ theme.title.zh }}</span><span lang="en">{{ theme.title.en }}</span></h2>
        <div class="foundation__note-copy"><p>{{ theme.description.zh }}</p><p lang="en">{{ theme.description.en }}</p><div class="foundation__detail"><p>{{ theme.detail.zh }}</p><p lang="en">{{ theme.detail.en }}</p></div></div>
      </article>
    </section>
    <section class="foundation__closing foundation__container"><ReferenceIntroduction :label="{ zh: '继续创作', en: 'An ongoing practice' }" :text="page.closing" variant="section" /></section>
    <WorkContinuation :next="kind === 'edit' ? 'color' : 'poster'" />
  </main>
</template>

<script setup lang="ts">
/**
 * /edit 与 /news 共用的页面骨架，差异由 kind 和 FOUNDATION_PAGES 驱动。
 * 不虚构项目案例：主题切换、12 秒文字时间线仅演示节奏与信息组织。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import ReferenceIntroduction from '../components/ReferenceIntroduction.vue'
import { referenceIntroductionGate } from '../components/ReferenceIntroduction'
import WorkContinuation from '../components/WorkContinuation.vue'
import { FOUNDATION_PAGES, type FoundationKind } from '../data/foundationPages'
import { isTransitioning, jumpTarget, markSubpageVisit, overlayActive } from '../composables/useTransition'
import { routeCurtainBlocked } from '../composables/usePageCurtain'
import { useFitText } from '../composables/useFitText'
import { requestMotionLayoutRefresh } from '../utils/motionLayout'

gsap.registerPlugin(ScrollTrigger)
const props = defineProps<{ kind: FoundationKind }>()
const page = computed(() => FOUNDATION_PAGES[props.kind])
const root = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)
const selected = ref(0)
const activeTheme = computed(() => page.value.themes[selected.value]!)
const introDone = ref(false)
// 全局遮罩管路由时序，本页标题结束后才放行共享段落，避免两套入场同时争用文字。
const covered = computed(() => routeCurtainBlocked.value || !!jumpTarget.value || overlayActive.value || isTransitioning.value)
const ready = computed(() => introDone.value && !covered.value)
provide(referenceIntroductionGate, ready)
useFitText(heading, { min: 42, max: 240 })
markSubpageVisit(page.value.id)

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
let context: gsap.Context | undefined
let intro: gsap.core.Timeline | undefined
let reveal: gsap.core.Tween | undefined
let started = false
let disposed = false
let cancelRefresh: (() => void) | undefined
const playhead = ref(0)
const playing = ref(false)
const visibleWord = computed(() => props.kind === 'edit' ? Math.min(2, Math.floor(playhead.value / 100 * 3)) : selected.value)
let frame = 0
let previousTime = 0

function selectTheme(index: number): void {
  selected.value = index
  pausePlayback()
  playhead.value = 0
}
/** roving tabindex：左右键循环选项，Home / End 到首尾，选中后同步焦点与面板。 */
function onTabKeydown(event: KeyboardEvent, index: number): void {
  let target: number
  if (event.key === 'ArrowRight') target = (index + 1) % page.value.themes.length
  else if (event.key === 'ArrowLeft') target = (index + page.value.themes.length - 1) % page.value.themes.length
  else if (event.key === 'Home') target = 0
  else if (event.key === 'End') target = page.value.themes.length - 1
  else return
  event.preventDefault()
  selectTheme(target)
  root.value?.querySelector<HTMLButtonElement>(`#${props.kind}-tab-${page.value.themes[target]!.key}`)?.focus()
}
/** 使用 RAF 时间差推进 0–100 进度，120ms 对应 1%，因此整段为 12 秒。 */
function tick(time: number): void {
  if (!playing.value) return
  if (previousTime) playhead.value = Math.min(100, playhead.value + (time - previousTime) / 120)
  previousTime = time
  if (playhead.value >= 100) { pausePlayback(); return }
  frame = requestAnimationFrame(tick)
}
function pausePlayback(): void {
  playing.value = false
  cancelAnimationFrame(frame)
  frame = 0
  previousTime = 0
}
function togglePlayback(): void {
  if (playing.value) { pausePlayback(); return }
  if (playhead.value >= 100) playhead.value = 0
  playing.value = true
  frame = requestAnimationFrame(tick)
}
function seek(event: Event): void {
  pausePlayback()
  playhead.value = Number((event.target as HTMLInputElement).value)
}
function onVisibilityChange(): void { if (document.hidden) pausePlayback() }
/** 正文仅揭示一次；刷新请求交给全站队列，避免多个组件同时强制布局。 */
function revealStudy(): void {
  if (disposed || !root.value || motionQuery.matches || reveal) return
  context?.add(() => {
    reveal = gsap.fromTo(root.value!.querySelector('.foundation__study'), { opacity: 0, y: 54 }, {
      opacity: 1, y: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: root.value!.querySelector('.foundation__study'), start: 'top 85%', once: true },
    })
  })
  cancelRefresh?.()
  cancelRefresh = requestMotionLayoutRefresh()
}
function playIntro(): void {
  if (started || disposed || !root.value) return
  started = true
  if (motionQuery.matches) { introDone.value = true; return }
  context?.add(() => {
    intro = gsap.timeline({ onComplete: () => { introDone.value = true; revealStudy() } })
      .fromTo(heading.value, { opacity: 0, yPercent: 30 }, { opacity: 1, yPercent: 0, duration: .8, ease: 'power3.out' }, 0)
  })
}
function onMotionChange(): void {
  if (!motionQuery.matches) return
  pausePlayback()
  intro?.kill()
  introDone.value = true
  reveal?.scrollTrigger?.kill()
  reveal?.kill()
  if (root.value) gsap.set([heading.value, root.value.querySelector('.foundation__study')], { clearProps: 'transform,opacity' })
}
watch(covered, value => { if (!value) playIntro() })
onMounted(async () => {
  context = gsap.context(() => {}, root.value!)
  await nextTick()
  if (disposed) return
  if (!covered.value) playIntro()
  motionQuery.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onBeforeUnmount(() => {
  // 同时取消计时、刷新与 GSAP context；异步 nextTick 通过 disposed 拒绝晚到的初始化。
  disposed = true
  cancelRefresh?.()
  pausePlayback()
  context?.revert()
  motionQuery.removeEventListener('change', onMotionChange)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
/* 页面根节点覆盖共享纸色变量，使通用组件继承当前主题而不污染其他路由。 */
.foundation { --ab-bg:#f6f1e7; --ab-ink:#2b241c; --ab-soft:#6a5c4c; --ab-line:#d9d2c5; min-height:100vh; min-height:100svh; background:var(--ab-bg); color:var(--ab-ink); overflow-x:clip; }
.foundation--news { --ab-bg:#f7f7f5; --ab-ink:#252525; --ab-soft:#626262; --ab-line:#d7d7d3; }
.foundation__container { width:100%; max-width:1400px; margin-inline:auto; padding-inline:clamp(20px,4.4vw,64px); }
.foundation__hero { padding-top:clamp(96px,13vh,160px); padding-bottom:clamp(80px,12vh,150px); }
.foundation__chapter { display:flex; flex-wrap:wrap; gap:14px; font-size:11px; line-height:1.4; }
.foundation__chapter [lang=en] { opacity:.6; }
.foundation__heading { margin-top:clamp(22px,4vh,44px); font-size:clamp(42px,18vw,240px); line-height:.85; letter-spacing:-.055em; font-weight:400; }
.foundation__introduction { margin-top:clamp(72px,14vh,160px); }
.foundation__study { padding-bottom:clamp(100px,15vh,190px); }
.foundation__study-top { display:flex; justify-content:space-between; align-items:end; gap:30px; margin-bottom:36px; font-size:13px; line-height:1.4; }
.foundation__study-top p,.foundation__study-top>span { display:flex; flex-direction:column; gap:6px; }
.foundation__study-top p [lang=en],.foundation__study-top small { font-size:11px; color:var(--ab-soft); }
.foundation__tabs { display:flex; border-top:1px solid var(--ab-line); }
.foundation__tabs button { display:flex; align-items:baseline; gap:12px; flex:1; min-height:70px; padding:16px 0; border:0; background:transparent; color:var(--ab-ink); font:inherit; font-size:20px; text-align:left; cursor:pointer; opacity:.45; transition:opacity .3s; }
.foundation__tabs button[aria-selected=true],.foundation__tabs button:hover { opacity:1; }
.foundation__tabs button [lang=en] { font-size:12px; }
.foundation__panel { background:#161616; color:#f7f7f5; }
.foundation__screen { position:relative; display:flex; align-items:center; min-height:560px; padding:clamp(28px,6vw,84px); overflow:clip; }
.foundation__screen-copy { width:100%; }
.foundation__screen-note { display:flex; align-items:baseline; gap:14px; font-size:15px; }
.foundation__screen-note [lang=en] { font-size:12px; opacity:.6; }
.foundation__screen-word { margin:24px 0 28px; font-size:clamp(52px,8.4vw,126px); font-weight:400; letter-spacing:-.065em; line-height:1; overflow-wrap:anywhere; }
.foundation__screen-subtitle { font-size:clamp(15px,1.7vw,24px); line-height:1.4; }
.foundation__screen-subtitle [lang=en] { display:block; margin-top:9px; font-size:clamp(12px,1.2vw,17px); opacity:.6; }
.foundation__screen-register { position:absolute; right:clamp(28px,6vw,84px); bottom:28px; font-size:10px; opacity:.35; }
.foundation__timeline { padding:0 clamp(24px,4vw,56px) 28px; }
.foundation__tracks { position:relative; padding-top:18px; border-top:1px solid #666; overflow:clip; }
.foundation__picture-track { display:flex; gap:5px; height:48px; }
.foundation__picture-track>span,.foundation__sound-track>span { width:55px; flex:none; font-size:9px; line-height:12px; color:#999; }
.foundation__picture-track i { background:#d6d0c4; flex:1; }
.foundation__picture-track i:nth-of-type(2) { flex:2.2; background:#968b7a; }
.foundation__picture-track i:nth-of-type(3) { flex:.7; background:#eee9df; }
.foundation__picture-track i:nth-of-type(4) { flex:1.5; background:#6e726a; }
.foundation__sound-track { display:flex; align-items:center; gap:3px; height:46px; margin-top:8px; }
.foundation__sound-track i { height:var(--level); flex:1; background:#747b70; }
.foundation__playhead { position:absolute; width:1px; top:12px; bottom:0; left:calc(60px + (100% - 60px) * var(--playhead)); background:#fff; }
.foundation__transport { display:flex; align-items:center; gap:22px; margin-top:26px; }
.foundation__transport button { display:flex; align-items:center; gap:9px; border:0; color:inherit; background:none; font:inherit; font-size:12px; min-height:40px; cursor:pointer; }
.foundation__transport button>span:first-child { font-size:24px; width:22px; }
.foundation__transport button [lang=en] { opacity:.55; font-size:10px; }
.foundation__transport input { flex:1; min-width:20px; accent-color:#e6e1d7; }
.foundation__transport output { min-width:54px; text-align:right; font-size:11px; }
.foundation__study-caption { display:flex; justify-content:space-between; gap:20px; margin-top:18px; font-size:11px; color:var(--ab-soft); }
.foundation--news .foundation__screen { min-height:650px; }
.foundation--news .foundation__screen-word { margin-block:42px; font-size:clamp(30px,var(--word-size),156px); overflow-wrap:normal; }
.foundation__frame { position:absolute; inset:28px; pointer-events:none; }
.foundation__frame i { position:absolute; width:32px; height:32px; border-color:#6d6d6d; border-style:solid; }
.foundation__frame i:nth-child(1) { left:0; top:0; border-width:1px 0 0 1px; }
.foundation__frame i:nth-child(2) { right:0; top:0; border-width:1px 1px 0 0; }
.foundation__frame i:nth-child(3) { left:0; bottom:0; border-width:0 0 1px 1px; }
.foundation__frame i:nth-child(4) { right:0; bottom:0; border-width:0 1px 1px 0; }
.foundation__news-links { display:flex; justify-content:space-between; gap:20px; margin-inline:clamp(28px,6vw,84px); padding:22px 0; border-top:1px solid #515151; font-size:12px; }
.foundation__note { display:grid; grid-template-columns:1fr 2fr; gap:clamp(24px,5vw,72px); padding:clamp(40px,7vh,84px) 0; border-top:1px solid var(--ab-line); }
.foundation__note h2 { display:flex; flex-direction:column; gap:12px; font-size:clamp(30px,3.5vw,48px); line-height:1.15; letter-spacing:-.04em; font-weight:400; }
.foundation__note h2 [lang=en] { font-size:16px; letter-spacing:0; color:var(--ab-soft); }
.foundation__note-copy>p { max-width:760px; font-size:clamp(23px,2.5vw,36px); line-height:1.3; letter-spacing:-.025em; }
.foundation__note-copy>p[lang=en] { margin-top:14px; color:var(--ab-soft); font-size:clamp(18px,1.8vw,26px); }
.foundation__detail { margin-top:36px; max-width:640px; font-size:14px; line-height:1.9; }
.foundation__detail [lang=en] { margin-top:16px; font-size:13px; line-height:1.65; color:var(--ab-soft); }
.foundation__closing { padding-top:clamp(80px,14vh,170px); padding-bottom:32px; }
.foundation-type-enter-active,.foundation-type-leave-active { transition:opacity .35s,transform .6s cubic-bezier(.215,.61,.355,1); }
.foundation-type-enter-from { opacity:0; transform:translateY(32px); }
.foundation-type-leave-to { opacity:0; transform:translateY(-20px); }
.foundation button:focus-visible,.foundation input:focus-visible { outline:2px solid currentColor; outline-offset:5px; }
.foundation__panel:focus-visible { outline:2px solid var(--ab-ink); outline-offset:6px; }
@media(max-width:700px) {
  .foundation__hero { padding-top:110px; }
  .foundation__study-top { display:block; }
  .foundation__study-top>span { margin-top:24px; }
  .foundation__tabs button { flex-direction:column; gap:4px; min-height:76px; font-size:18px; }
  .foundation__tabs button [lang=en] { font-size:10px; }
  .foundation__screen,.foundation--news .foundation__screen { min-height:430px; padding:38px 24px 64px; }
  .foundation__screen-word { font-size:clamp(43px,11.3vw,78px); }
  .foundation__screen-register { left:24px; right:auto; bottom:20px; }
  .foundation__frame { inset:14px; }
  .foundation__frame i { width:20px; height:20px; }
  .foundation__transport { gap:12px; }
  .foundation__transport button [lang=en] { display:none; }
  .foundation__note { grid-template-columns:1fr; gap:30px; }
  .foundation__note h2 { flex-direction:row; align-items:baseline; gap:16px; }
  .foundation__detail { margin-top:24px; }
  .foundation__news-links { margin-inline:24px; gap:10px; font-size:10px; }
}
@media(prefers-reduced-motion:reduce) {
  .foundation-type-enter-active,.foundation-type-leave-active,.foundation__tabs button { transition:none; }
  .foundation-type-enter-from,.foundation-type-leave-to { transform:none; }
}
</style>
