<template>
  <header id="about-intro" ref="root" class="about-hero" :class="{ 'is-awake': awake && active }" aria-labelledby="about-title">
    <div class="about-hero__inner">
      <div ref="headline" class="about-hero__headline">
        <h1 id="about-title" class="about-hero__title" :class="{ 'about-hero__title--en': lang === 'en' }" :lang="lang">
          <span v-for="line in primary" :key="line">{{ line }}</span>
        </h1>
        <p class="about-hero__translation" :lang="lang === 'zh' ? 'en' : 'zh'"><span v-for="line in secondary" :key="line">{{ line }}</span></p>
      </div>
      <div ref="rail" class="about-hero__rail">
        <div class="about-hero__ball" aria-hidden="true">
          <div class="about-hero__ball-colour"></div>
          <div class="about-hero__globe"><div class="about-hero__globe-tilt">
            <span class="about-hero__meridian"></span><span class="about-hero__meridian"></span><span class="about-hero__meridian"></span>
            <span class="about-hero__latitude"></span><span class="about-hero__equator"></span>
          </div></div>
        </div>
      </div>
      <a class="about-hero__cue" href="#profile"><span>向下，认识我的工作<span lang="en">Scroll to explore my practice</span></span><span aria-hidden="true">↓</span></a>
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * 关于页首屏：同时呈现两种语言，active 由页面转场门闩提供。
 * 入场只播放一次；awake 仅控制装饰地球的 CSS 循环，滚出视口或被遮罩覆盖时暂停。
 * 此处不接管整页滚动，测量任务和 matchMedia 动画都归本实例创建、撤销。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import type { Lang } from '../../数据/人物资料'
import { prepareMotionLayout } from '../../工具/动效布局调度'
const props = defineProps<{ active: boolean; lang: Lang }>()
const root = ref<HTMLElement | null>(null), headline = ref<HTMLElement | null>(null), rail = ref<HTMLElement | null>(null)
const copy = { zh: ['把想法做成影像', '让内容被看见'], en: ['From ideas to images', 'Making content seen'] }
const primary = computed(() => copy[props.lang])
const secondary = computed(() => copy[props.lang === 'zh' ? 'en' : 'zh'])
const awake = ref(false)
let media: gsap.MatchMedia | undefined, entrance: gsap.core.Tween | undefined, observer: IntersectionObserver | undefined
let cancelPreparation: (() => void) | undefined
let dead = false
let played = false
function play() { if (props.active && entrance && !played) { played = true; entrance.play() } }
onMounted(() => {
  if (!root.value) return
  observer = new IntersectionObserver(([entry]) => { awake.value = !!entry?.isIntersecting }, { threshold: 0 })
  observer.observe(root.value)
  // GSAP's first transform read should follow the page's natural first layout,
  // rather than forcing the whole bilingual page to lay out in Vue's mount task.
  cancelPreparation = prepareMotionLayout(root.value, () => {
    cancelPreparation = undefined
    if (dead || !root.value || !headline.value || !rail.value) return
    media = gsap.matchMedia()
    media.add({ motion: '(prefers-reduced-motion: no-preference)', small: '(max-width: 540px)' }, context => {
      if (!context.conditions!.motion || played) return
      // The original moves its headline and globe rail together with a small stagger.
      // Keep our transition gate so the entrance does not finish behind the existing loading curtain.
      entrance = gsap.fromTo([headline.value!, rail.value!], { y: () => innerHeight * (context.conditions!.small ? .1 : .5) },
        { y: 0, duration: 1.5, stagger: .07, ease: 'expo.out', paused: true, clearProps: 'transform' })
      play()
      return () => { entrance = undefined }
    }, root.value)
  })
})
watch(() => props.active, play)
onBeforeUnmount(() => { dead = true; cancelPreparation?.(); observer?.disconnect(); media?.revert() })
</script>

<style scoped>
.about-hero { position:relative; display:flex; align-items:center; min-height:100vh; min-height:100svh; overflow:clip; background:var(--ab-bg); color:var(--ab-ink); padding:clamp(170px,25vh,300px) 0 clamp(100px,12vh,150px); padding:clamp(170px,25svh,300px) 0 clamp(100px,12svh,150px); }
.about-hero__inner { width:64%; max-width:1120px; margin:auto; }
.about-hero__title { margin:0; font-size:clamp(48px,6.5vw,104px); line-height:1.18; font-weight:400; letter-spacing:-.055em; }
.about-hero__title > span { display:block; }
.about-hero__title--en { font-size:clamp(44px,5.8vw,92px); line-height:1.13; }
.about-hero__translation { display:flex; flex-wrap:wrap; gap:4px 24px; margin:30px 0 0; font-size:clamp(16px,1.6vw,23px); line-height:1.5; letter-spacing:-.02em; color:var(--ab-soft); }
.about-hero__rail { position:relative; height:1px; margin-top:clamp(110px,15vh,180px); margin-top:clamp(110px,15svh,180px); background:var(--ab-line); }
.about-hero__ball { position:absolute; z-index:1; top:0; right:0; width:clamp(144px,12vw,176px); aspect-ratio:1; transform:translate(-50%,-50%); overflow:hidden; border-radius:50%; background:#455ce9; }
.about-hero__ball-colour { position:absolute; inset:0; opacity:0; animation:hero-ball-colour 6s ease-in-out infinite; transition:opacity 1s ease-in-out; }
.about-hero__ball:hover .about-hero__ball-colour { opacity:1; }
.about-hero__globe { position:absolute; top:50%; left:50%; width:48px; height:48px; transform:translate(-50%,-50%); border-radius:50%; overflow:hidden; }
.about-hero__globe-tilt { position:absolute; inset:0; border-radius:50%; overflow:hidden; box-shadow:inset 0 0 0 2px white; animation:hero-globe-tilt 5.4s cubic-bezier(.35,0,.65,1) infinite; }
.about-hero__meridian { position:absolute; top:0; left:50%; width:100%; height:100%; border-radius:50%; transform:translateX(-50%); box-shadow:inset 1.2px 0 0 1px white; animation:hero-meridian 2.7s linear infinite; }
.about-hero__meridian:nth-child(1) { animation-delay:-1.8s; }.about-hero__meridian:nth-child(2) { animation-delay:-.9s; }
.about-hero__latitude { position:absolute; top:50%; left:50%; width:150%; height:55%; transform:translate(-50%,-50%); border-radius:50%; box-shadow:inset 0 0 0 1.6px white; }
.about-hero__equator { position:absolute; top:50%; left:0; width:100%; height:1.6px; transform:translateY(-50%); background:white; }
.about-hero__ball-colour,.about-hero__globe-tilt,.about-hero__meridian { animation-play-state:paused; }
.about-hero.is-awake .about-hero__ball-colour,.about-hero.is-awake .about-hero__globe-tilt,.about-hero.is-awake .about-hero__meridian { animation-play-state:running; }
.about-hero__cue { display:flex; justify-content:space-between; gap:25px; align-items:center; width:fit-content; min-width:200px; margin-top:40px; padding:8px 0; color:inherit; text-decoration:none; font-size:12px; }
.about-hero__cue [lang=en] { display:block; margin-top:3px; color:var(--ab-soft); font-size:10px; }.about-hero__cue > span:last-child { display:block; font-size:24px; transition:transform .35s ease; }.about-hero__cue:hover > span:last-child { transform:translateY(5px); }.about-hero__cue:focus-visible { outline:2px solid currentColor; outline-offset:5px; }
@keyframes hero-globe-tilt { 0%,100% { transform:rotate(15deg); } 50% { transform:rotate(-15deg); } }
@keyframes hero-meridian { 0%,100% { width:100%; border-radius:50%; background:transparent; } 0%,49% { box-shadow:inset 1.2px 0 0 1px white; } 49%,51% { border-radius:50%; background:transparent; } 50% { width:2px; border-radius:0; background:white; } 51%,100% { box-shadow:inset -1.2px 0 0 1px white; } }
@keyframes hero-ball-colour { 0%,100% { background:#455ce9; } 50% { background:#ff4444; } }
@media(max-width:1000px) { .about-hero__inner { width:80%; }.about-hero__ball { transform:translate(-20%,-50%); } }
@media(max-width:760px) { .about-hero { min-height:90vh; min-height:90svh; padding:150px 20px 110px; }.about-hero__inner { width:100%; }.about-hero__title { font-size:clamp(32px,9.8vw,62px); }.about-hero__title--en { font-size:clamp(28px,8.8vw,54px); }.about-hero__translation { margin-top:24px; font-size:15px; gap:3px 16px; }.about-hero__rail { margin-top:110px; }.about-hero__ball { width:128px; right:8px; }.about-hero__globe { width:42px; height:42px; }.about-hero__cue { min-width:145px; font-size:11px; }.about-hero__cue [lang=en] { font-size:9px; } }
@media(max-width:380px) { .about-hero { padding-top:130px; }.about-hero__ball { width:110px; right:-6px; }.about-hero__globe { width:36px; height:36px; }.about-hero__translation { font-size:14px; }.about-hero__cue { min-width:125px; font-size:10px; } }
@media(prefers-reduced-motion:reduce) { .about-hero .about-hero__ball-colour,.about-hero .about-hero__globe-tilt,.about-hero .about-hero__meridian { animation:none; }.about-hero__globe-tilt { transform:rotate(-12deg); }.about-hero__meridian { width:36%; }.about-hero__meridian:nth-child(2) { width:70%; }.about-hero__meridian:nth-child(3) { width:100%; }.about-hero__ball-colour,.about-hero__cue > span:last-child { transition:none; } }
</style>
