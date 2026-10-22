<template>
  <!--
    内容层。它位于 .card-plane 内部，但 galleryMotion.ts 从不碰它 ——
    下面每一个 tween 都只作用于本子树内的节点，
    因此卡片在 3D 空间中的摆放位置始终保持不变。
  -->
  <div ref="hostRef" class="card-visual" :class="`card-visual--${kind}`" aria-hidden="true">
    <!-- 01 / ABOUT —— 「关于我」是一个三层空间，不是自我介绍版面：
         · 巨型 ABOUT 排版（远，尺度最大、位移最小）
         · DEMO 几何图形（中景，圆 / 对角线 / 竖干互相切割，带三条扫描线）
         · 文字信息（近，尺度最小、位移最大）
         三层的静止样子在 aboutExperience.css，指针视差在
         aboutExperienceAnimation.ts，结构在 components/about/。
         这里只保留 .cv.cv-about 外壳 —— 它是卡片内容层的挂载点。 -->
    <div v-if="kind === 'about'" class="cv cv-about">
      <AboutExperience />
    </div>

    <!-- 02 / EDIT — Time / Sequence / Cut.
         NOT a NLE screenshot: the timeline is abstracted down to a hairline,
         three clip blocks and a playhead, and the giant EDIT is a spatial
         object the pointer pushes around. Three depth layers, no rotation,
         no scale, and deliberately no auto-scanning playhead. -->
    <EditCardVisual v-else-if="kind === 'edit'" />

    <!-- 03 / COLOR — Tone / Color / Grade.
         Not a DaVinci screenshot and not a rainbow: the card stays almost
         black-and-white, with colour appearing only as film-grade tone
         (cool shadow, neutral midtone, warm highlight). Five depth layers,
         translation only, driven purely by the pointer. -->
    <ColorCardVisual v-else-if="kind === 'color'" />

    <!-- 04 / NEWS — Information / Broadcast / Headline.
         Editorial broadcast, not a TV template and not cyberpunk: no glitch,
         no RGB split, no scanlines. Layers sit 3-8 px out of register with
         each other so the information reads as being re-stacked. Only the
         pointer moves them; the LIVE dot breathes and the ticker crawls. -->
    <NewsCardVisual v-else-if="kind === 'news'" />

    <!-- 05 / POSTER — Composition / Layout / Graphic Design.
         A design board, not a thumbnail: one printed sheet offset to the right
         and cropped by the card edge, giant POSTER running underneath it and
         cropped by the left, and InDesign-style guides crossing both. No
         rotation, no scale, no glow — the composition is the whole effect. -->
    <PosterCardVisual v-else-if="kind === 'poster'" />

    <!-- 06 / PHOTO — Frame / Light / Moment.
         The quietest card of the six: one photograph floating off-centre in a
         black room, a hairline mount 8px outside it, and captions. No grid, no
         panels, no readouts — the picture is the subject and everything else is
         there only to say where and when. -->
    <PhotoCardVisual v-else-if="kind === 'photo'" />
  </div>
</template>

<script setup lang="ts">
/**
 * 卡内视觉外壳：模板提供各章节构图，注册表按章节下标创建独立动画实例。
 * 父级控制 play/pause/restart，active 单独控制指针响应；不接管卡片平面的空间摆放。
 * 重建或卸载前必须 destroy 旧实例，释放它登记的 quickTo、监听和观察器。
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import AboutExperience from './人物与作品/人物经历.vue'
import EditCardVisual from './卡面/剪辑卡面.vue'
import ColorCardVisual from './卡面/调色卡面.vue'
import NewsCardVisual from './卡面/新闻卡面.vue'
import PosterCardVisual from './卡面/海报卡面.vue'
import PhotoCardVisual from './卡面/摄影卡面.vue'
import { createCardAnimation } from '../卡片动画/卡片动画注册表'
import type { CardAnimation, CardMedia } from '../卡片动画/卡片动画注册表'

const props = defineProps<{ index: number; kind: string; active?: boolean }>()

const hostRef = ref<HTMLElement | null>(null)
let anim: CardAnimation | null = null
let playing = true
// 有些循环会测量自己的宿主，所以尺寸真的变了就必须重建 ——
// 但不能每个 resize 事件都重建，那会把时间线反复打散。
let lastSizeKey = ''

/** 当前宿主的尺寸指纹，用于判断「是否真的变了」 */
function sizeKey(): string {
  const el = hostRef.value
  return el ? `${el.clientWidth}x${el.clientHeight}` : ''
}

/** 销毁旧动画并按 index 重建一个，随后记录新尺寸 */
function build(): void {
  if (!hostRef.value) return
  anim?.destroy()
  anim = createCardAnimation(props.index)
  if (!anim) return
  anim.mount(hostRef.value)
  anim.setActive(props.active !== false)
  lastSizeKey = sizeKey()
}

onMounted(() => {
  build()
  if (playing) anim?.play()
  else anim?.pause()
  // 只有当前在屏幕上的那张卡才应该监听指针
  anim?.setActive(props.active !== false)
  // active 变化时同步给动画：非焦点卡要停掉指针响应并漂回基线
  watch(
    () => props.active,
    (active) => anim?.setActive(active !== false),
  )
})

onUnmounted(() => {
  anim?.destroy()
  anim = null
})

/** 视口变化后重新测量尺寸并重建循环。 */
function remount(): void {
  const key = sizeKey()
  // 尺寸没变就没必要重建
  if (key === lastSizeKey) return
  // ⚠️ 位于 display:none 子树中的宿主量出来是 0x0。
  // resize() 会在调用本函数**之前**先跑 render()（它负责隐藏不在屏幕上的卡），
  // 所以没有这道防线的话，每次重建都会把 0 尺寸的几何写进循环里 ——
  // 而且永远纠正不回来，因为下一次 resize 量到的还是 0x0。
  // 因此这里选择保留上一次的好结果。
  if (key === '0x0') return
  build()
  if (playing) anim?.play()
  else anim?.pause()
}

/*
 * 播放控制：薄薄一层转发到 `anim`（章节动画实例）。
 * ⚠️ 每一处都要 `?.` —— `anim` 在挂载后的 build() 中才建立，
 *    父级在挂载前调用不该抛错。这几个函数经 `defineExpose` 暴露给 ThreeHome。
 */
/** 继续（或从头开始）播当前章节动画 */
function play(): void {
  playing = true
  anim?.play()
}
/** 暂停在当前帧（保留进度，与 `reset()` 不同） */
function pause(): void {
  playing = false
  anim?.pause()
}
/** 回到起点并停住 */
function reset(): void {
  anim?.reset()
}
/** 重放一次性入场动画（章节被打开时调用）。 */
function restart(): void {
  anim?.restart()
}
/** 换素材（卡片内容按数据重绑时调用），不重启动画时间线 */
function setMedia(media: CardMedia): void {
  anim?.setMedia(media)
}

// 暴露给父组件 ThreeHome 调用
defineExpose({ play, pause, reset, restart, setMedia, remount })
</script>

<style scoped>
.card-visual {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.cv {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---- 01 / ABOUT 关于我 ------------------------------------------- */
/* 内容已迁到 src/components/about/AboutExperience.vue：
     · 三层静态构图在 aboutExperience.css
     · 指针视差在 aboutExperienceAnimation.ts
     · DEMO 几何 + 三条扫描线在 TemplateMark.vue
   这里的 .cv.cv-about 仍是卡片内容层的挂载点，其它卡片对它的样式
   假设（如 .card-visual--about）不受影响。 */

/* 02 构图与章节样式由 cards/EditCardVisual.vue 持有。 */
.cv-edit {
  display: block;
}

/* 03 构图与章节样式由 cards/ColorCardVisual.vue 持有。 */
.cv-color {
  display: block;
}

/* 04 构图与章节样式由 cards/NewsCardVisual.vue 持有。 */
.cv-news {
  display: block;
}

/* 05 构图与章节样式由 cards/PosterCardVisual.vue 持有。 */
.cv-poster {
  display: block;
}

/* 06 构图与章节样式由 cards/PhotoCardVisual.vue 持有。 */
.cv-photo {
  display: block;
}
</style>
