<template>
  <figure ref="root" class="imc" :class="{ 'is-enhanced': enhanced }">
    <!-- 只拆出标题和图形；入场完成后切回完整底图，避免裁片边界出现拼接缝。 -->
    <svg class="imc__mask" aria-hidden="true">
      <defs><mask :id="maskId" x="0" y="0" width="1" height="1" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" style="mask-type:luminance">
        <rect x="0" y="0" width="1" height="1" fill="white" />
        <rect v-for="(part, i) in parts" :key="i" :x="part.rect[0]" :y="part.rect[1]" :width="part.rect[2]" :height="part.rect[3]" fill="black" />
      </mask></defs>
    </svg>
    <button class="imc__art" type="button" :style="{ aspectRatio: `${item.width} / ${item.height}` }"
      :data-cursor="lang === 'zh' ? '查看' : 'Explore'" data-cursor-action="view"
      :aria-label="`${lang === 'zh' ? '查看完整实习作品' : 'View full internship work'}: ${pick(item.title, lang)}`"
      @click="emit('open', item, $event.currentTarget as HTMLElement)">
      <img class="imc__base" :src="item.src" :srcset="visualImageSources(item)" sizes="(max-width: 760px) calc(100vw - 32px), 46vw" :width="item.width" :height="item.height" :alt="pick(item.alt, lang)"
        :style="enhanced ? { maskImage: `url(#${maskId})` } : undefined" loading="lazy" decoding="async" draggable="false" />
      <span v-for="(part, i) in parts" :key="i" class="imc__slot" :style="fragmentStyle(part.rect)" aria-hidden="true">
        <span class="imc__fragment" :data-kind="part.kind">
          <img :src="item.src" :srcset="visualImageSources(item)" sizes="(max-width: 760px) calc(100vw - 32px), 46vw" :style="cropStyle(part.rect)" alt="" loading="lazy" decoding="async" draggable="false" />
        </span>
      </span>
      <span class="imc__zoom" aria-hidden="true">↗</span>
    </button>
    <figcaption class="imc__caption">
      <div><span class="imc__meta">{{ String(page).padStart(2, '0') }} / {{ String(total).padStart(2, '0') }}</span>
        <h4>{{ pick(item.title, 'zh') }}</h4><p lang="en">{{ pick(item.title, 'en') }}</p>
      </div>
      <button type="button" class="imc__replay" :disabled="!canReplay"
        :aria-label="`${lang === 'zh' ? '重播海报动画' : 'Replay poster animation'}: ${pick(item.title, lang)}`" @click="replay">↻</button>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../工具/响应式图片'
/**
 * 单张实习海报：外部页面门闩打开后，在进入视口时自动揭示一次，也支持显式重播。
 * 图像先 decode，再用碎片层接替底图；playbackVersion 作异步所有权标记，
 * 旧 decode/nextTick 回调不能在新一轮重播、减少动态或组件卸载后继续改画面。
 * open 只上报作品与触发元素，弹层和焦点还原由页面管理。
 */
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { pick, type Lang } from '../../数据/人物资料'
import type { VisualAsset } from '../../数据/视觉作品资料'
import { cropStyle, fragmentStyle, internshipFragments } from '../../数据/实习海报动效数据'
import { referenceIntroductionGate } from '../引导文字状态'
import { createInternshipArtworkMotion } from './实习海报碎片控制'
import { createViewportEntrance } from '../../工具/视口入场控制'

const props = defineProps<{ item: VisualAsset; lang: Lang; page: number; total: number }>()
const emit = defineEmits<{ open: [item: VisualAsset, trigger: HTMLElement] }>()
const root = ref<HTMLElement | null>(null)
const enhanced = ref(false)
const canReplay = ref(false)
const parts = computed(() => internshipFragments(props.item).filter(part => part.kind === 'headline' || part.kind === 'block'))
const maskId = `internship-mask-${useId()}`
const pageGate = inject(referenceIntroductionGate, ref(true))
let media: gsap.MatchMedia | undefined
let sequence: gsap.core.Timeline | undefined
let entryTrigger: ScrollTrigger | undefined
let arm = () => {}
let played = false
let dead = false
let playbackVersion = 0
let warmObserver: IntersectionObserver | undefined
let imageReady: Promise<void> | undefined

function warmArtwork(): Promise<void> {
  if (!imageReady) {
    // 提前准备真实图与裁片，避免进入阅读区后才触发懒加载/解码。
    root.value?.querySelectorAll<HTMLImageElement>('img').forEach(image => { image.loading = 'eager' })
    imageReady = root.value?.querySelector<HTMLImageElement>('.imc__base')?.decode().catch(() => {}) ?? Promise.resolve()
  }
  return imageReady
}

function completeArtwork(): void {
  playbackVersion++
  played = true
  sequence?.progress(1).pause()
  enhanced.value = false
}

async function playArtwork(): Promise<void> {
  const pending = sequence
  if (dead || !pending || !canReplay.value) return
  const version = ++playbackVersion
  played = true
  // 原图尚在解码时保留完整页面，不先抽走标题而留下空洞。
  await warmArtwork()
  if (dead || version !== playbackVersion || sequence !== pending) return
  // 先复位隐藏的裁片，再启用遮罩；Vue挂上裁片后的下一拍才开演。
  pending.pause(0)
  enhanced.value = true
  await nextTick()
  if (dead || version !== playbackVersion || sequence !== pending || !enhanced.value) return
  pending.restart()
}

watch(pageGate, active => {
  if (active) arm()
  else if (!played) {
    entryTrigger?.kill()
    entryTrigger = undefined
  }
})

gsap.registerPlugin(ScrollTrigger)
onMounted(async () => {
  await nextTick()
  if (dead || !root.value) return
  warmObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    warmObserver?.disconnect()
    void warmArtwork()
  }, { rootMargin: '500px 0px' })
  warmObserver.observe(root.value)
  media = gsap.matchMedia()
  media.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, context => {
    if (context.conditions!.reduce) {
      // 静态完整图也视为已展示；恢复动态偏好时只允许主动重播，不再自动抽走文字。
      played = true
      enhanced.value = false
      canReplay.value = false
      return
    }
    const nodes = [...root.value!.querySelectorAll<HTMLElement>('.imc__fragment')]
    if (!nodes.length) return
    sequence = createInternshipArtworkMotion(nodes, () => { enhanced.value = false })
    canReplay.value = true
    // 海报上缘进入屏幕就开演；回滚、语言与偏好切换保留已经看过的完整图。
    enhanced.value = false
    arm = () => {
      if (dead || played || !pageGate.value || entryTrigger) return
      context.add(() => {
        entryTrigger = createViewportEntrance({ trigger: root.value!.querySelector('.imc__art')!,
          play: () => { void playArtwork() }, complete: completeArtwork })
      })
    }
    arm()
    return () => {
      playbackVersion++
      entryTrigger?.kill()
      entryTrigger = undefined
      arm = () => {}
      enhanced.value = false
      canReplay.value = false
      sequence = undefined
    }
  }, root.value)
})
function replay() {
  // 显式重播属于用户操作，中线守卫不应把它立刻截断。
  entryTrigger?.kill()
  entryTrigger = undefined
  void playArtwork()
}
onBeforeUnmount(() => { dead = true; playbackVersion++; warmObserver?.disconnect(); media?.revert(); sequence = undefined })
</script>

<style scoped>
.imc { min-width:0; margin:0; }
.imc__mask { position:absolute; width:0; height:0; pointer-events:none; }
.imc__art { position:relative; display:block; width:100%; padding:0; border:0; background:transparent; color:inherit; cursor:zoom-in; isolation:isolate; }
.imc__base { display:block; width:100%; height:100%; object-fit:contain; }
.imc__slot { position:absolute; overflow:clip; display:none; pointer-events:none; }
.is-enhanced .imc__slot { display:block; }
.imc__fragment { position:absolute; inset:0; transform-origin:center; }
.is-enhanced .imc__fragment { will-change:transform,opacity; }
.imc__fragment img { position:absolute; max-width:none; pointer-events:none; }
.imc__zoom { position:absolute; right:14px; bottom:14px; display:grid; place-items:center; width:28px; height:28px; color:#fff; mix-blend-mode:difference; opacity:0; transform:translateY(6px); transition:opacity .25s,transform .25s; }
.imc__art:hover .imc__zoom,.imc__art:focus-visible .imc__zoom { opacity:1; transform:none; }
/* 触屏没有悬停阶段，完整作品的查看入口需始终可见。 */
@media(hover:none) { .imc__zoom { opacity:1; transform:none; } }
.imc__caption { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; margin-top:20px; }
.imc__meta { color:var(--ab-soft); font-size:10px; letter-spacing:.12em; }
.imc__caption h4 { margin:12px 0 6px; font-size:clamp(19px,2vw,30px); font-weight:400; letter-spacing:-.025em; line-height:1.12; }
.imc__caption p { margin:0; font-size:12px; line-height:1.5; color:var(--ab-soft); }
.imc__replay { flex-shrink:0; width:44px; height:44px; padding:0; border:0; background:transparent; color:inherit; font-size:21px; cursor:pointer; transition:transform .3s; }
.imc__replay:hover { transform:rotate(-35deg); }
.imc__replay:disabled { display:none; }
.imc button:focus-visible { outline:2px solid var(--ab-ink); outline-offset:5px; }
@media(prefers-reduced-motion:reduce) {
 .imc__base { mask:none !important; }
 .imc__slot,.imc__replay { display:none !important; }
 .imc__zoom { transition:none; }
 .imc__fragment { will-change:auto; }
}
</style>
