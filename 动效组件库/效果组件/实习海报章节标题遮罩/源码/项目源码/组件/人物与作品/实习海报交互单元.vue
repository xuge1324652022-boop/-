<template>
  <div ref="root" class="imt" :class="[`imt--${theme.kind}`, { 'is-running': running, 'is-settled': settled }]"
    :data-cursor="running ? (lang === 'zh' ? '探索' : 'Explore') : undefined" data-cursor-action="preview"
    :style="{ '--tile-bg': theme.background, '--tile-accent': theme.accent, '--choice': choice }"
    @pointermove="move" @pointerleave="leave" @animationend="completeDrawing">
    <span class="imt__tag">TYPE / IN MOTION</span>
    <div class="imt__drawing" aria-hidden="true">
      <svg viewBox="0 0 400 500" fill="none">
        <path v-if="theme.kind === 'guidance'" class="imt__route" d="M-30 400H105V312H188V230H260V138H425" />
        <template v-else-if="theme.kind === 'laser'">
          <path class="imt__route" d="M34 356L327 83L300 429L34 356Z" />
          <path class="imt__grid" d="M0 166H400M0 332H400M133 0V500M266 0V500" />
        </template>
        <template v-else>
          <path class="imt__route" d="M75 155H325V215H75V275H325V335H75V395H325" />
          <rect class="imt__grid" x="44" y="121" width="312" height="304" rx="25" />
        </template>
      </svg>
      <span class="imt__orb" />
      <i class="imt__block imt__block--one" /><i class="imt__block imt__block--two" />
    </div>
    <div class="imt__type">
      <span class="imt__model">{{ theme.model }}</span>
      <Transition name="imt-word" mode="out-in">
        <strong :key="choice">{{ theme.words[choice]!.en }}</strong>
      </Transition>
      <span class="imt__word-zh">{{ theme.words[choice]!.zh }}</span>
    </div>
    <div class="imt__controls" :aria-label="lang === 'zh' ? '切换动效主题' : 'Choose a motion theme'">
      <button v-for="(word, i) in theme.words" :key="word.en" type="button" :aria-pressed="choice === i"
        :data-cursor="lang === 'zh' ? '切换' : 'Explore'" data-cursor-action="explore"
        @click="choice = i">{{ pick(word, lang) }}</button>
    </div>
    <span class="imt__note"><span class="imt__pointer-hint">{{ lang === 'zh' ? '移动鼠标 · 点击切换' : 'Move your pointer · Choose a word' }}</span><span class="imt__touch-hint">{{ lang === 'zh' ? '点击词语，切换画面' : 'Tap a word to change the scene' }}</span> ↗</span>
  </div>
</template>

<script setup lang="ts">
/**
 * 每个产品章节的小型交互演示。entered 记住首次实际入场，visible 控制离屏暂停；
 * running 还受页面遮罩、标签页可见性和减少动态偏好共同约束，避免后台继续循环。
 * 描线由真实可见面积触发，不依赖尚在排版的上方长滚动章节的坐标；指针只写局部 CSS 变量。
 */
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { pick, type Lang } from '../../数据/人物资料'
import { type InternshipMotionTheme } from '../../数据/实习海报动效数据'
import { referenceIntroductionGate } from '../引导文字状态'

defineProps<{ theme: InternshipMotionTheme; lang: Lang }>()
const root = ref<HTMLElement | null>(null)
const choice = ref(0)
const visible = ref(false)
const readyToDraw = ref(false)
const entered = ref(false)
const pageGate = inject(referenceIntroductionGate, ref(true))
const documentVisible = ref(!document.hidden)
const media = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = ref(media.matches)
const settled = ref(reduced.value)
const running = computed(() => pageGate.value && visible.value && entered.value && documentVisible.value && !reduced.value)
let observer: IntersectionObserver | undefined
let dead = false
let pointerFrame = 0
let pointer: { x: number; y: number } | undefined
// 露出约七分之一画面再绘制，避免仅在屏幕底部一闪就把整段线条提前播完。
watch([pageGate, readyToDraw, documentVisible, reduced], () => {
  if (!dead && pageGate.value && readyToDraw.value && documentVisible.value && !reduced.value) entered.value = true
})
function completeDrawing(event: AnimationEvent) {
  // 实际描线结束才保留终态；离屏或刷新布局不能把尚未看见的线条直接画完。
  if (event.target instanceof Element && event.target.classList.contains('imt__route')) settled.value = true
}
function move(event: PointerEvent) {
  if (!running.value || event.pointerType !== 'mouse' || !root.value) return
  pointer = { x: event.clientX, y: event.clientY }
  if (pointerFrame) return
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0
    const point = pointer
    if (dead || !running.value || !root.value || !point) return
    // 每帧最多读取一次实际位置，再批量写变量；滚动改变坐标时也不沿用过时矩形。
    const bounds = root.value.getBoundingClientRect()
    const normalized = (value: number) => Math.max(-.5, Math.min(.5, value - .5))
    root.value.style.setProperty('--mx', String(normalized((point.x - bounds.left) / Math.max(1, bounds.width))))
    root.value.style.setProperty('--my', String(normalized((point.y - bounds.top) / Math.max(1, bounds.height))))
  })
}
function leave() {
  if (pointerFrame) cancelAnimationFrame(pointerFrame)
  pointerFrame = 0
  pointer = undefined
  root.value?.style.setProperty('--mx', '0')
  root.value?.style.setProperty('--my', '0')
}
function preference() {
  reduced.value = media.matches
  if (reduced.value) { settled.value = true; leave() }
}
function visibility() { documentVisible.value = !document.hidden }
watch(running, active => { if (!active) leave() })
onMounted(() => {
  // 观察真实绘制区域；上方叠层的高度更新不会提前消费这次入场。
  observer = new IntersectionObserver(entries => {
    const entry = entries[0]
    visible.value = entry?.isIntersecting ?? false
    readyToDraw.value = !!entry?.isIntersecting && entry.intersectionRatio >= .14
  }, { threshold: [0, .14] })
  if (root.value) observer.observe(root.value)
  document.addEventListener('visibilitychange', visibility)
  media.addEventListener('change', preference)
})
onBeforeUnmount(() => {
  dead = true
  if (pointerFrame) cancelAnimationFrame(pointerFrame)
  observer?.disconnect()
  document.removeEventListener('visibilitychange', visibility)
  media.removeEventListener('change', preference)
})
</script>

<style scoped>
.imt { --mx:0; --my:0; position:relative; aspect-ratio:3/4; overflow:clip; background:var(--tile-bg); color:var(--tile-accent); }
.imt__tag { position:absolute; top:7%; right:7%; font-size:8px; writing-mode:vertical-rl; letter-spacing:.14em; color:#fff9; }
.imt__drawing { position:absolute; inset:0; transform:translate(calc(var(--mx)*20px),calc(var(--my)*20px)); transition:transform .25s ease-out; }
.imt__drawing svg { width:100%; height:100%; transform:rotate(calc(var(--choice)*7deg)) scale(calc(1 - var(--choice)*.04)); transition:transform .75s cubic-bezier(.4,0,.2,1); }
.imt__route { stroke:var(--tile-accent); stroke-width:3; stroke-dasharray:1400; stroke-dashoffset:1400; animation:imt-route .7s cubic-bezier(.2,.65,.2,1) both paused; }
.imt__grid { stroke:var(--tile-accent); stroke-width:1; opacity:.18; }
.imt__orb { position:absolute; left:60%; top:22%; width:22%; aspect-ratio:1; border:1px solid var(--tile-accent); border-radius:50%; animation:imt-orb 5s ease-in-out infinite alternate paused; }
.imt__orb::before,.imt__orb::after { content:''; position:absolute; background:var(--tile-accent); }
.imt__orb::before { width:140%; height:1px; top:50%; left:-20%; }
.imt__orb::after { width:1px; height:140%; top:-20%; left:50%; }
.imt__block { position:absolute; display:block; width:14%; aspect-ratio:1; background:var(--tile-accent); animation:imt-block 6s cubic-bezier(.45,0,.2,1) infinite alternate paused; }
.imt__block--one { top:37%; left:8%; }
.imt__block--two { top:61%; right:8%; width:9%; animation-delay:-3s; }
.imt__type { position:absolute; left:7%; right:7%; top:43%; display:flex; flex-direction:column; align-items:flex-start; transform:translate(calc(var(--mx)*-10px),calc(var(--my)*-10px)); transition:transform .25s ease-out; }
.imt__model { font-size:clamp(12px,1.5vw,22px); font-weight:500; color:#fff; margin-bottom:16px; }
.imt__type strong { font-size:clamp(30px,4.25vw,72px); letter-spacing:-.055em; line-height:1.05; font-weight:600; max-width:100%; }
.imt__word-zh { font-size:clamp(20px,2.4vw,38px); margin-top:12px; }
.imt__controls { position:absolute; left:7%; right:7%; bottom:14%; display:flex; flex-wrap:wrap; gap:8px; }
.imt__controls button { flex:1; border:1px solid currentColor; border-radius:0; padding:11px 9px; background:transparent; color:inherit; font-size:clamp(10px,1vw,14px); cursor:pointer; transition:background .3s,color .3s,transform .3s; }
.imt__controls button[aria-pressed=true] { background:var(--tile-accent); color:var(--tile-bg); }
.imt__controls button:hover { transform:translateY(-4px); }
.imt__controls button:focus-visible { outline:2px solid white; outline-offset:4px; }
.imt__note { position:absolute; left:7%; bottom:6%; color:#fffb; font-size:10px; }
.imt__touch-hint { display:none; }
@media(hover:none) { .imt__pointer-hint { display:none; } .imt__touch-hint { display:inline; } }
.imt--lawn .imt__orb { background:var(--tile-accent); border:0; width:15%; }
.imt--lawn .imt__orb::before,.imt--lawn .imt__orb::after { display:none; }
.imt--lawn .imt__block { border-radius:30%; }
.is-running .imt__route,.is-running .imt__orb,.is-running .imt__block { animation-play-state:running; }
.is-settled .imt__route { animation:none; stroke-dashoffset:0; }
.imt-word-enter-active,.imt-word-leave-active { transition:transform .32s cubic-bezier(.4,0,.2,1),opacity .32s; }
.imt-word-enter-from { transform:translateY(20px); opacity:0; }
.imt-word-leave-to { transform:translateY(-20px); opacity:0; }
/* 初次描线完成后保留图形；不再每七秒擦掉一次主体，悬停与按钮交互仍保留。 */
@keyframes imt-route { from { stroke-dashoffset:1400; } to { stroke-dashoffset:0; } }
@keyframes imt-orb { from { transform:translate(0,0) scale(.85); } to { transform:translate(-25px,25px) scale(1.08); } }
@keyframes imt-block { 0%,15% { transform:translate(0,0) rotate(0); } 65%,100% { transform:translate(15px,-25px) rotate(90deg); } }
@media(max-width:760px) {
 .imt__type strong { font-size:clamp(32px,9vw,56px); }
 .imt__word-zh { font-size:26px; }
 .imt__model { font-size:16px; }
 .imt__controls button { font-size:12px; }
}
@media(prefers-reduced-motion:reduce) {
 .imt__route,.imt__orb,.imt__block { animation:none; }
 .imt__route { stroke-dashoffset:0; }
 .imt-word-enter-active,.imt-word-leave-active,.imt__controls button,.imt__drawing,.imt__drawing svg,.imt__type { transition:none; }
}
</style>
