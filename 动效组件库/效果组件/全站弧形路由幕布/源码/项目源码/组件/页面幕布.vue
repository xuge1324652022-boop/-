<template>
  <div ref="root" class="page-curtain" :class="{ 'is-active': active }" :aria-hidden="!active" role="status" aria-live="polite" aria-atomic="true">
    <div ref="screen" class="page-curtain__screen">
      <div ref="topCap" class="page-curtain__cap page-curtain__cap--top" aria-hidden="true"><div class="page-curtain__ellipse"></div></div>
      <div class="page-curtain__word-position">
        <div ref="words" class="page-curtain__words">
          <h2 class="page-curtain__chapter" lang="zh"><span class="page-curtain__dot" aria-hidden="true"></span><span>{{ title.zh }}</span></h2>
          <p lang="en">{{ title.en }}</p>
        </div>
      </div>
      <div ref="bottomCap" class="page-curtain__cap page-curtain__cap--bottom" aria-hidden="true"><div class="page-curtain__ellipse"></div></div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 全站弧形幕布的视觉层。App.vue 负责路由、输入锁与等待时间，本组件只提供
 * cover/reveal/reset 三个可等待动作；cover 在完全遮挡时完成，不等待文字播完。
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'
import { guardOverlayTouchScroll } from '../工具/覆盖层触摸保护'

const props = defineProps<{ active: boolean; title: { zh: string; en: string } }>()

const root = ref<HTMLElement | null>(null)
const screen = ref<HTMLElement | null>(null)
const words = ref<HTMLElement | null>(null)
const topCap = ref<HTMLElement | null>(null)
const bottomCap = ref<HTMLElement | null>(null)
let context: gsap.Context | undefined
let coverTimeline: gsap.core.Timeline | undefined
let revealTimeline: gsap.core.Timeline | undefined
let wordEntrance: Animation | undefined
let releaseTouchGuard: (() => void) | undefined
// 采样原有 GSAP power4 曲线交给原生动画：Vue 准备新页面占用主线程时，
// transform/opacity 入场仍可由浏览器合成线程推进，保留原来的时长与手感。
const wordEase = gsap.parseEase('power4.out')
const wordFrames: Keyframe[] = Array.from({ length: 101 }, (_, i) => {
  const progress = wordEase(i / 100)
  return { offset: i / 100, opacity: progress, transform: `translate3d(0,${-50 * progress}px,0)` }
})
let motionQuery: MediaQueryList | undefined
let phase: 'idle' | 'covering' | 'covered' | 'revealing' = 'idle'
// 每次中断递增；旧 nextTick/Promise 继续执行时不得写入新一轮幕布。
let generation = 0
let dead = false
const pending = new Set<() => void>()

function withContext(work: () => void): void {
  if (!root.value || dead) return
  context ??= gsap.context(() => {}, root.value)
  context.add(work)
}

function settlePending(): void {
  for (const finish of [...pending]) finish()
}

/** 停在当前可见状态，允许被中断的覆盖直接衔接揭幕，并结算所有旧等待者。 */
function stopCurrent(preserveWords = true): void {
  generation++
  if (wordEntrance) {
    if (preserveWords) {
      // 把原生动画当前帧交回内联样式，后续 GSAP 退场不会突然跳回起点。
      try { wordEntrance.commitStyles() } catch { /* already cancelled or detached */ }
    }
    wordEntrance.cancel()
    wordEntrance = undefined
  }
  coverTimeline?.kill()
  revealTimeline?.kill()
  coverTimeline = undefined
  revealTimeline = undefined
  settlePending()
}

function reset(): void {
  stopCurrent(false)
  context?.revert()
  context = undefined
  phase = 'idle'
}

function whenReady(version: number, work: () => Promise<void>): Promise<void> {
  if (dead || version !== generation) return Promise.resolve()
  if (root.value && screen.value && words.value && topCap.value && bottomCap.value) return work()
  return nextTick().then(() => {
    if (dead || version !== generation || !root.value || !screen.value || !words.value || !topCap.value || !bottomCap.value) return
    return work()
  })
}

function completion(start: (finish: () => void) => void): Promise<void> {
  return new Promise(resolve => {
    const finish = () => { if (pending.delete(finish)) resolve() }
    pending.add(finish)
    start(finish)
  })
}

const reduced = () => motionQuery?.matches ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 完全遮挡后兑现 Promise；章节文字可以在等待目标页面期间继续入场。 */
function cover(entry = false): Promise<void> {
  reset()
  const version = generation
  return whenReady(version, () => {
    phase = entry ? 'covered' : 'covering'
    if (entry) {
      withContext(() => {
        gsap.set(screen.value!, { y: 0, yPercent: 0, opacity: 1 })
        gsap.set(words.value!, { opacity: 1, y: reduced() ? 0 : -50 })
        gsap.set(topCap.value!, { scaleY: 0, yPercent: 0 })
        gsap.set(bottomCap.value!, { scaleY: reduced() ? 0 : 1, yPercent: reduced() ? 0 : -1 })
      })
      return Promise.resolve()
    }
    return completion(finish => withContext(() => {
      if (reduced()) {
        gsap.set(screen.value!, { y: 0, yPercent: 0, opacity: 0 })
        gsap.set(words.value!, { opacity: 1, y: 0 })
        gsap.set([topCap.value!, bottomCap.value!], { scaleY: 0, yPercent: 0 })
        coverTimeline = gsap.timeline({ onComplete: () => { phase = 'covered'; finish() } })
          .to(screen.value!, { opacity: 1, duration: .12, ease: 'none' })
        return
      }
      gsap.set(screen.value!, { y: 0, yPercent: 100, opacity: 1 })
      gsap.set(words.value!, { opacity: 0, y: 0 })
      gsap.set(topCap.value!, { scaleY: 0, yPercent: 0 })
      gsap.set(bottomCap.value!, { scaleY: 1, yPercent: -1 })
      coverTimeline = gsap.timeline()
        .to(screen.value!, { yPercent: 0, duration: .5, ease: 'power4.in' }, 0)
        .to(topCap.value!, { scaleY: -1, yPercent: 1, duration: .4, ease: 'power4.in' }, 0)
        .call(() => { phase = 'covered'; finish() }, [], .5)
      if (typeof words.value!.animate === 'function') {
        wordEntrance = words.value!.animate(wordFrames, { duration: 800, delay: 550, easing: 'linear', fill: 'forwards' })
      } else {
        // 旧 WebView 缺少原生动画时仍正常换页，保留相同位置、曲线与时长。
        coverTimeline.to(words.value!, { opacity: 1, y: -50, duration: .8, ease: 'power4.out' }, .55)
      }
    }))
  })
}

function reveal(): Promise<void> {
  stopCurrent()
  const version = generation
  return whenReady(version, () => {
    phase = 'revealing'
    return completion(finish => withContext(() => {
      gsap.set(topCap.value!, { scaleY: 0, yPercent: 0 })
      if (reduced()) {
        gsap.set(screen.value!, { y: 0, yPercent: 0 })
        gsap.set([topCap.value!, bottomCap.value!], { scaleY: 0, yPercent: 0 })
        revealTimeline = gsap.timeline({ onComplete: () => { phase = 'idle'; finish() } })
          .to(screen.value!, { opacity: 0, duration: .12, ease: 'none' })
        return
      }
      revealTimeline = gsap.timeline({ onComplete: () => { phase = 'idle'; finish() } })
        .to(screen.value!, { yPercent: -100, duration: .8, ease: 'power3.inOut' }, 0)
        .to(words.value!, { opacity: 0, duration: .6, ease: 'none' }, 0)
        .to(bottomCap.value!, { scaleY: 0, yPercent: 0, duration: .85, ease: 'power3.inOut' }, .2)
    }))
  })
}

function onMotionChange(): void {
  if (!motionQuery?.matches || phase === 'idle') return
  const revealing = phase === 'revealing'
  stopCurrent()
  withContext(() => {
    gsap.set(screen.value!, { y: 0, yPercent: 0, opacity: revealing ? 0 : 1 })
    gsap.set(words.value!, { y: 0, opacity: revealing ? 0 : 1 })
    gsap.set([topCap.value!, bottomCap.value!], { scaleY: 0, yPercent: 0 })
  })
  phase = revealing ? 'idle' : 'covered'
}

onMounted(() => {
  releaseTouchGuard = guardOverlayTouchScroll(() => root.value, () => props.active)
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change', onMotionChange)
})
onBeforeUnmount(() => {
  dead = true
  releaseTouchGuard?.()
  motionQuery?.removeEventListener('change', onMotionChange)
  reset()
})
defineExpose({ cover, reveal, reset })
</script>

<style scoped>
.page-curtain { position:fixed; inset:0; z-index:10005; width:100%; height:100%; overflow:hidden; visibility:hidden; pointer-events:none; color:#fff; }
.page-curtain.is-active { visibility:visible; pointer-events:auto; }
.page-curtain__screen { position:relative; width:100%; height:100%; background:#141517; transform:translateY(100%); will-change:transform; }
/* 固定 10svh 容器改用缩放，保留原高度动画的形状；1% 位移保留 99% 边缘重叠。
   每帧只改 transform，椭圆与裁切容器无需随高度重新布局。 */
.page-curtain__cap { position:absolute; left:0; width:100%; height:calc(var(--stable-viewport-height) * .1); overflow:hidden; pointer-events:none; transform-origin:50% 0; will-change:transform; }
.page-curtain__cap--top { top:0; transform:scaleY(0); }
.page-curtain__cap--bottom { top:100%; transform:translateY(-1%); }
.page-curtain__ellipse { position:absolute; display:block; left:50%; width:150%; height:745%; border-radius:50%; background:#141517; transform:translate(-50%,-86.666%); }
.page-curtain__word-position { position:absolute; top:50%; left:50%; width:calc(100% - 48px); max-width:900px; transform:translate(-50%,-50%); pointer-events:none; }
.page-curtain__words { opacity:0; text-align:center; will-change:transform,opacity; }
.page-curtain__chapter { display:flex; align-items:center; justify-content:center; gap:.55em; margin:0; font-size:clamp(32px,5vw,68px); font-weight:400; letter-spacing:-.035em; line-height:1.25; }
.page-curtain__chapter > span:last-child { min-width:0; overflow-wrap:anywhere; }
.page-curtain__dot { flex:0 0 auto; width:clamp(7px,.7vw,11px); height:clamp(7px,.7vw,11px); border-radius:50%; background:currentColor; }
.page-curtain__words > p { margin:12px 0 0; font-size:clamp(14px,1.6vw,21px); line-height:1.4; font-weight:400; letter-spacing:-.01em; overflow-wrap:anywhere; }
@media(max-width:540px) { .page-curtain__cap--bottom { height:calc(var(--stable-viewport-height) * .05); } .page-curtain__chapter { font-size:clamp(30px,8.5vw,44px); } .page-curtain__words > p { font-size:14px; margin-top:10px; } }
@media(prefers-reduced-motion:reduce) { .page-curtain__screen,.page-curtain__words,.page-curtain__cap { will-change:auto; } }
</style>
