<template>
  <div ref="root" class="iaa" :class="{ 'is-enhanced': enhanced }"
    :style="{ aspectRatio: `${item.width} / ${item.height}` }">
    <svg class="iaa__mask" aria-hidden="true">
      <defs>
        <mask :id="maskId" x="0" y="0" width="1" height="1"
          maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" style="mask-type:luminance">
          <rect x="0" y="0" width="1" height="1" fill="white" />
          <rect v-for="(part, i) in parts" :key="i" :x="part.rect[0]" :y="part.rect[1]"
            :width="part.rect[2]" :height="part.rect[3]" fill="black" />
        </mask>
      </defs>
    </svg>

    <!-- 动画期间只挖出裁片对应区域；裁片仍复用整张原图，不拉伸文字或改变作品比例。 -->
    <img class="iaa__base" :src="item.src" :srcset="visualImageSources(item)" sizes="(max-width: 760px) calc(100vw - 32px), 46vw" :width="item.width" :height="item.height"
      :alt="pick(item.alt, lang)" :style="enhanced ? { maskImage: `url(#${maskId})` } : undefined"
      loading="lazy" decoding="async" draggable="false" />
    <span v-for="(part, i) in parts" :key="i" class="iaa__slot" :style="fragmentStyle(part.rect)" aria-hidden="true">
      <span class="iaa__fragment" :data-kind="part.kind">
        <img :src="item.src" :srcset="visualImageSources(item)" sizes="(max-width: 760px) calc(100vw - 32px), 46vw" :style="cropStyle(part.rect)" alt="" loading="lazy" decoding="async" draggable="false" />
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../utils/responsiveImage'
/**
 * 纸面内部的碎片揭示，不参与父级的空间定位。默认始终是一张完整原图；
 * 只有首次收到 revealed 且允许动态时，短暂切到带唯一 SVG mask 的碎片层。
 * 完成后归还原图显示，避免长期叠放裁切图产生细缝；matchMedia 负责撤销时间线。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import gsap from 'gsap'
import { pick, type Lang } from '../../data/aboutProfile'
import type { VisualAsset } from '../../data/visualPortfolio'
import { cropStyle, fragmentStyle, internshipFragments } from '../../data/internshipPosterMotion'
import { createInternshipArtworkMotion } from './internshipArtworkMotion'

const props = defineProps<{ item: VisualAsset; lang: Lang; revealed: boolean; completed?: boolean }>()
const root = ref<HTMLElement | null>(null)
const enhanced = ref(false)
const parts = computed(() => internshipFragments(props.item).filter(part => part.kind === 'headline' || part.kind === 'block'))
const maskId = `internship-art-${useId()}`
let played = props.revealed
let dead = false
let media: gsap.MatchMedia | undefined
let sequence: gsap.core.Timeline | undefined
let playbackVersion = 0

function completeArtwork(): void {
  playbackVersion++
  played = true
  sequence?.progress(1).pause()
  enhanced.value = false
}

// 父组件通知进入屏幕时开演；回滚、语言切换与减少动态偏好切换都不能再次挖孔或重播。
watch([() => props.revealed, () => props.completed], async ([revealed, completed]) => {
  // 父级纸面已落位时，内层不能继续追赶或等解码完成后重新挖走标题。
  if (completed) { completeArtwork(); return }
  if (!revealed || played || dead) return
  played = true
  const pending = sequence
  if (!pending) return
  const version = ++playbackVersion
  const image = root.value?.querySelector<HTMLImageElement>('.iaa__base')
  if (image) { image.loading = 'eager'; await image.decode().catch(() => {}) }
  if (dead || version !== playbackVersion || props.completed || sequence !== pending) return
  // 未触发前保留完整原图；父组件确认进入阅读区后才切到裁片，再启动入场。
  pending.pause(0)
  enhanced.value = true
  await nextTick()
  // 减少动态偏好或路由可能在DOM更新期间改变，不能重新播放已经回收的时间线。
  if (dead || version !== playbackVersion || props.completed || sequence !== pending || !enhanced.value) return
  pending.play(0)
}, { flush: 'post' })

onMounted(async () => {
  await nextTick()
  if (dead || !root.value) return
  // 刷新或跳转到已看见的区间时，首次挂载直接保留完整原图。
  if (props.revealed || props.completed) played = true
  media = gsap.matchMedia()
  media.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, context => {
    if (context.conditions!.reduce) {
      played = true
      enhanced.value = false
      return
    }
    if (played) return
    const fragments = [...root.value!.querySelectorAll<HTMLElement>('.iaa__fragment')]
    if (!fragments.length) return
    sequence = createInternshipArtworkMotion(fragments, () => {
      // 收尾换回未遮罩的整张原图，避免裁片边界的亚像素拼接缝。
      enhanced.value = false
    })
    return () => { playbackVersion++; enhanced.value = false; sequence = undefined }
  }, root.value)
})

onBeforeUnmount(() => {
  dead = true
  playbackVersion++
  media?.revert()
  sequence = undefined
})
</script>

<style scoped>
.iaa { position:relative; display:block; width:100%; pointer-events:none; }
.iaa__mask { position:absolute; width:0; height:0; pointer-events:none; }
.iaa__base { display:block; width:100%; height:auto; }
.iaa__slot { position:absolute; overflow:clip; display:none; }
.is-enhanced .iaa__slot { display:block; }
.iaa__fragment { position:absolute; inset:0; transform-origin:center; }
.is-enhanced .iaa__fragment { will-change:transform,opacity; }
.iaa__fragment img { position:absolute; max-width:none; pointer-events:none; }
@media(prefers-reduced-motion:reduce) {
  .iaa__base { mask:none !important; }
  .iaa__slot { display:none !important; }
  .iaa__fragment { will-change:auto; }
}
</style>
