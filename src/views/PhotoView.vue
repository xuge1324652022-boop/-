<template>
  <div ref="rootRef" class="pv">
    <!-- ==================== 开场 ==================== -->
    <section class="pv__hero">
      <p class="pv__kick">
        <span class="pv__no">06</span>
        <span class="pv__slash" aria-hidden="true">/</span>
        <span class="pv__label">{{ pick(HERO.kicker, lang) }}</span>
      </p>
      <h1 ref="titleRef" class="pv__big">{{ HERO.big }}</h1>
      <ReferenceIntroduction class="pv__lead" :text="HERO.lead" :label="HERO.kicker" :active="introGone && !covered" />
    </section>

    <!-- 全屏章节必须在限宽正文之外，sticky 舞台才能覆盖整个视口。 -->
    <PhotoSets :sets="PHOTO_SETS" :lang="lang" @open="onOpenSet" />
    <div class="pv__body">
      <!-- ==================== 02 摄影手记 ==================== -->
      <AboutSection
        index="02"
        motion="wipe"
        :label="SECTIONS.notes.label"
        :title="pick(SECTIONS.notes.title, lang)"
        :lead="SECTIONS.notes.lead"
      >
        <div class="pv__notes" data-reveal-stagger>
          <p v-for="(n, i) in NOTES" :key="i" class="pv__note" data-reveal>{{ pick(n, lang) }}</p>
        </div>
      </AboutSection>

      <!-- ==================== 03 完整画廊 ==================== -->
      <AboutSection
        index="03"
        motion="scale"
        :label="SECTIONS.gallery.label"
        :title="pick(SECTIONS.gallery.title, lang)"
        :lead="SECTIONS.gallery.lead(photoGallery.length)"
      >
        <!--
          「恢复排布」只在**拖动过之后**出现（方案要求）。没拖过就不该有这个按钮 ——
          一个永远可点但什么也不做的按钮比没有按钮更糟。
        -->
        <div class="pv__galbar">
          <p class="pv__galhint">{{ t.dragHint }}</p>
          <button
            v-if="dragDirty"
            ref="resetBtnRef"
            type="button"
            class="pv__reset"
            @click="resetDrag"
          >
            {{ t.reset }}
          </button>
        </div>

        <!--
          ⚠️ 揭示动画与拖动**必须写在不同节点上**：
            `<li data-reveal>`  → `useAboutReveal` 写 opacity / y
            `<figure class="pg__item">` → `usePhotoDrag` 写 transform
            同写一个 `transform` 就会互相覆盖（拖到一半被揭示动画拽回原位）。
            「一个属性只有一个写入者」。
        -->
        <ul ref="galleryRef" class="pg" :class="{ 'is-draggable': dragEnabled }">
          <li
            v-for="(slot, i) in photoGallery"
            :key="slot.item.id"
            class="pg__slot"
            :class="`pg__slot--${slot.span}`"
            data-reveal
          >
            <figure class="pg__item">
              <button
                type="button"
                class="pg__btn"
                :aria-label="t.open(pick(slot.item.title, lang))"
                @click="onOpenGallery(i, $event)"
              >
                <img
                  class="pg__img"
                  :src="slot.item.src" :srcset="visualImageSources(slot.item)" sizes="(max-width: 760px) calc(100vw - 32px), 45vw"
                  :width="slot.item.width"
                  :height="slot.item.height"
                  :alt="pick(slot.item.alt, lang)"
                  :loading="i < 2 ? 'eager' : 'lazy'"
                  decoding="async"
                  draggable="false"
                />
              </button>
              <figcaption class="pg__cap">{{ pick(slot.item.title, lang) }}</figcaption>
            </figure>
          </li>
        </ul>
      </AboutSection>
    </div>

    <!-- ==================== 结尾 ==================== -->
    <WorkContinuation next="poster" />

    <!-- 完整看图层：`viewerList` 决定这一组有几张（色彩章节 7/6/4/7/2 / 完整画廊 26），
         计数、缩略图、滚轮与方向键都按它算 -->
    <VisualViewer
      v-if="viewerItem"
      :item="viewerItem"
      :lang="lang"
      :items="viewerList"
      :index="viewerIndex"
      @step="stepViewer"
      @go-to="goToViewer"
      @close="closeViewer"
    />
  </div>
</template>

<script setup lang="ts">
import { visualImageSources } from '../utils/responsiveImage'
/**
 * /photo 编排五个色彩章节、摄影手记与完整画廊；素材登记与编排分别在 data 层。
 * 页面只协调首屏门禁、拖动和看图集合，章节内部的滚动推进由 PhotoSets 管理。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'

import gsap from 'gsap'
import WorkContinuation from '../components/WorkContinuation.vue'
import ReferenceIntroduction from '../components/ReferenceIntroduction.vue'
import { referenceIntroductionGate } from '../components/ReferenceIntroduction'
import AboutSection from '../components/about/AboutSection.vue'
import PhotoSets from '../components/about/PhotoSets.vue'
import VisualViewer from '../components/about/VisualViewer.vue'
import { pick, WORKS } from '../data/aboutProfile'
import { subpageLanguage as lang } from '../composables/useSubpageLanguage'
import {

  HERO,
  NOTES,
  PHOTO_SETS,
  SECTIONS,
  assertPhotoSets,
  photoGallery,
} from '../data/photoPage'
import { assertCollectionCoverage, type VisualAsset } from '../data/visualPortfolio'
import { setupAboutReveal, type AboutRevealHandle } from '../composables/useAboutReveal'
import { useVisualViewer } from '../composables/useVisualViewer'
import { usePhotoDrag } from '../composables/usePhotoDrag'
import { useFitText } from '../composables/useFitText'
import {
  PHOTO_PAGE_ID,
  isTransitioning,
  jumpTarget,
  markSubpageVisit,
  overlayActive,
} from '../composables/useTransition'
import { routeCurtainBlocked } from '../composables/usePageCurtain'

/* 面包屑：本次会话刚显示过 /photo（规范卡号 '06'）—— 画廊据此把后退认成「回 06 卡」。 */
markSubpageVisit(PHOTO_PAGE_ID)

/* 开发期自检：完整集合的条数 / id 命名空间 / 双语内容。与 `/about` 那套各管一段，不合并。 */
if (import.meta.env.DEV) {
  assertCollectionCoverage(WORKS.map((w) => w.id))
  /*
   * ⚠️ 照片组必须**恰好铺满**完整集合：漏一张不会报错，只会在推进到那一章时
   *    那张照片永远不出现 —— 而「少一张」在截图里看不出来。这条断言就是它的机器判据。
   */
  assertPhotoSets()
}

const t = computed(() =>
  lang.value === 'zh'
    ? {
        reset: '恢复排布',
        dragHint: '桌面可用鼠标拖动单张照片；点一下看完整照片',
        open: (title: string) => `查看完整照片：${title}`,
      }
    : {
        reset: 'Restore layout',
        dragHint: 'Drag a single frame with the mouse on desktop; click to see it whole',
        open: (title: string) => `View full photograph: ${title}`,
      },
)

/* ---------------- 全局揭幕后的标题入场 ---------------- */

const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
let reduceMotion = motionMedia.matches

const rootRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const galleryRef = ref<HTMLElement | null>(null)
const resetBtnRef = ref<HTMLButtonElement | null>(null)

/** 标题已经完成入场 */
const introGone = ref(false)
let introPlayed = false
let introTimeline: gsap.core.Timeline | undefined
let disposed = false
let reveal: AboutRevealHandle | null = null

/*
 * ---------------- 首屏大标题：按内容容器宽度拟合字号 ----------------
 *
 * 验收记录 P2-1：`font-size: clamp(40px, 12.4vw, 176px)` 跟的是**整个视口**的宽度，
 * 而标题实际能用的宽度是「`.pv__hero` 的 max-width 1400 − 左右 padding」。
 * 1280 视口实测可用 1157、而 `PHOTOGRAPHY` 要 1331 ⇒ 末尾的 `Y` 被根元素的
 * `overflow-x: clip` 吃掉（证据 `accept-photo-title-clipped.png`）。
 *
 * 这里交给 `useFitText` 实测文字宽度再反算字号（在 `onMounted` 里同步算一次，
 * 赶在第一帧之前，而且此时开场遮罩还盖着，不会有任何可见跳动）。
 * CSS 保留响应式字号作为无脚本的基线，最终字号由内容宽度决定。
 */
// 320px手机正文只有280px；40px下限会阻止长单词继续拟合，末尾仍可能被裁掉。
useFitText(titleRef, { min: 28, max: 240 })

/** 全局遮罩开始揭幕时，放行页面自己的标题 */
const covered = computed(
  () => routeCurtainBlocked.value || !!jumpTarget.value || overlayActive.value || isTransitioning.value,
)
provide(referenceIntroductionGate, computed(() => introGone.value && !covered.value))

/**
 * 标题随全局弧形揭幕同步入场，不再叠加本地深色幕。
 */
function playIntro(): void {
  if (introPlayed || disposed) return
  introPlayed = true

  if (reduceMotion) {
    introGone.value = true
    void buildReveal()
    return
  }

  const tl = introTimeline = gsap.timeline({
    // 标题完成后再建正文揭示
    onComplete: () => {
      introGone.value = true
      void buildReveal()
    },
  })
  if (titleRef.value) {
    tl.fromTo(
      titleRef.value,
      { yPercent: 40, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out' },
      0,
    )
  }
}

/** 建滚动揭示。**整页只建这一次**（本页没有随语言重建的段落）。 */
async function buildReveal(): Promise<void> {
  if (reduceMotion || !rootRef.value || reveal) return
  await nextTick()
  if (disposed || reduceMotion || !introGone.value || covered.value || !rootRef.value || reveal) return
  reveal = setupAboutReveal(rootRef.value, { reduceMotion })
}

watch(covered, (isCovered) => {
  if (!isCovered) { playIntro(); if (introGone.value) void buildReveal() }
})

/** 偏好可在页面打开后改变；释放滚动揭示，并让正在入场的标题完整可读。 */
function onMotionChange(): void {
  reduceMotion = motionMedia.matches
  if (reduceMotion) {
    introTimeline?.kill()
    introTimeline = undefined
    introGone.value = true
    gsap.set(titleRef.value, { clearProps: 'transform,opacity' })
    reveal?.dispose()
    reveal = null
  } else if (introGone.value && !covered.value) {
    void buildReveal()
  }
}

/* ---------------- 拖动 ---------------- */

/*
 * ⚠️ 必须把 `dirty` / `reset` / `attach` 解构到顶层再交给模板：
 *    模板只对**顶层** ref 自动解包，`drag.dirty` 这种嵌套引用不会解包，
 *    `v-if` 会永远为假 —— 「恢复排布」按钮永远不出现。
 */
const { dirty: dragDirty, reset: resetDrag, attach: attachDrag } = usePhotoDrag(
  () => galleryRef.value,
  '.pg__item',
)
/** 只有「精确指针」才开拖动；触摸设备保持原生滚动与点击。 */
const dragEnabled = ref(window.matchMedia('(any-pointer: fine)').matches)

/*
 * 拖过之后「恢复排布」才出现 —— 出现时把焦点送上去，键盘用户才够得着。
 * 在 setup 同步建立 watcher，让 Vue 自动跟随组件生命周期回收；
 * nextTick 等 v-if 按钮真正插入后才设置焦点，不用额外滚动打断阅读。
 */
watch(dragDirty, (v) => {
  if (v) void nextTick(() => resetBtnRef.value?.focus({ preventScroll: true }))
})

/* ---------------- 查看器 ---------------- */

const {
  active: viewerItem,
  list: viewerList,
  index: viewerIndex,
  openAt: openViewerAt,
  step: stepViewer,
  goTo: goToViewer,
  close: closeViewer,
  reset: resetViewer,
} = useVisualViewer()

/**
 * 色彩章节里点开一张 → 查看器带的是**它所在的那一章**。
 *
 * ⚠️ 集合由「这张属于哪一章」反查，而不是父级记着「当前第几章」：
 *    五章是同时挂在 DOM 上的（`PhotoSets` 靠 `clip-path` 决定谁露出来），
 *    父级并没有一个「当前章」的状态 —— 而查看器的分母必须等于**用户看到的
 *    那一章**的张数（7 / 6 / 4 / 7 / 2 各不相同）。反查则永远与**被点的那张
 *    照片**一致，与滚动位置无关。
 */
function onOpenSet(item: VisualAsset, trigger: HTMLElement): void {
  const set = PHOTO_SETS.find((s) => s.items.some((v) => v.id === item.id))
  if (!set) return
  openViewerAt(set.items, set.items.findIndex((v) => v.id === item.id), trigger)
}

/**
 * 完整画廊的查看器集合：**一次性常量**。
 * ⚠️ 不要在每次点击里 `photoGallery.map(...)` 重建 —— 集合现在是 26 张，
 *    每次点开都新建一个 26 元素数组是白费；而且 `openViewerAt` 会 `slice()`，
 *    传进去的数组本身不该变。下标与 `photoGallery` 严格对齐（同一顺序）。
 */
const galleryViewerItems: readonly VisualAsset[] = photoGallery.map((slot) => slot.item)

/**
 * 点开「完整画廊」里的第 i 张。
 * 传的是**常量** `galleryViewerItems`（下标与 `photoGallery` 严格对齐），
 * 不要在点击里重建数组 —— 见上方块注释。
 */
function onOpenGallery(i: number, e: Event): void {
  openViewerAt(galleryViewerItems, i, e.currentTarget as HTMLElement)
}

/* ---------------- 生命周期 ---------------- */

onMounted(async () => {
  motionMedia.addEventListener('change', onMotionChange)
  await nextTick()

  if (disposed) return
  if (!covered.value) playIntro()
  if (dragEnabled.value) attachDrag()

})

onBeforeUnmount(() => {
  disposed = true
  motionMedia.removeEventListener('change', onMotionChange)
  introTimeline?.kill()
  reveal?.dispose()
  reveal = null
  gsap.killTweensOf(titleRef.value)
  /*
   * ⚠️ 路由离开必须用 `reset()`（同步清状态），不能用 `close()`：
   *    `close()` 会在下一帧把**新页面**滚到一个陈旧坐标上。
   */
  resetViewer()
})
</script>

<style scoped>
/* ==================== 页面骨架 ==================== */

.pv {
  position: relative;
  min-height: 100vh;
  background: var(--ab-bg);
  color: var(--ab-ink);
  /*
   * ⚠️ 与 `.about-page` 同一处理：横向用 `clip` 不用 `hidden`。
   *    `hidden` 会把本元素变成滚动容器，里面的 `position: sticky` 会改成相对它
   *    吸附（而它自己从不滚动）⇒ sticky 永不激活。
   */
  overflow-x: clip;
}

/* ==================== 开场 ==================== */

.pv__hero {
  max-width: 1400px;
  margin-inline: auto;
  padding: clamp(96px, 13vh, 160px) clamp(20px, 4.4vw, 64px) clamp(40px, 8vh, 96px);
}
.pv__kick {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.28em;
}
.pv__no {
  color: var(--ab-ink);
}
.pv__slash {
  color: var(--ab-dim);
}
.pv__label {
  color: var(--ab-soft);
}
.pv__big {
  margin: clamp(14px, 2.6vh, 30px) 0 0;
  /*
   * ⚠️ 这条 `clamp` 只是**脚本没跑时的设计意图**，不是最终值：
   *    `useFitText` 在 `onMounted` 里实测文字宽度，按 `.pv__hero` 的内容盒宽度
   *    反算字号并写成内联样式覆盖这里（验收记录 P2-1）。
   *    留着它是因为「没有 JS 时页面应该长成什么样」也要有个明确的说法，
   *    而不是一片没有字号的默认 h1。
   */
  font-size: clamp(28px, 13.89vw, 240px);
  font-weight: 400;
  line-height: 0.9;
  letter-spacing: -0.03em;
  color: var(--ab-ink);
}
.pv__lead {
  margin-top: clamp(54px, 10vh, 110px);
}

/* ==================== 正文 ==================== */

.pv__body {
  width: 100%;
  max-width: 1400px;
  margin-inline: auto;
  /* 全屏色彩舞台之后先留出呼吸，再进入摄影手记；不影响舞台内部的固定布局。 */
  padding-top: clamp(72px, 12vh, 150px);
  padding-inline: clamp(20px, 4.4vw, 64px);
}
.pv__body > * + * {
  margin-top: clamp(72px, 12vh, 150px);
}

/* ---- 摄影手记 ---- */

.pv__notes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: clamp(24px, 4vw, 56px);
}
.pv__note {
  margin: 0;
  padding-top: 20px;
  border-top: 1px solid var(--ab-line);
  font-size: clamp(14px, 1.5vw, 16px);
  line-height: 1.9;
  color: var(--ab-soft);
}

/* ---- 精选画廊 ---- */

.pv__galbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  /* 预留44px可点击按钮及16px下边距，恢复按钮出现时不挤动画廊。 */
  min-height: 60px;
  padding-bottom: 16px;
}
.pv__galhint {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--ab-dim);
}
.pv__reset {
  appearance: none;
  min-height: 44px;
  padding: 9px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ab-ink);
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 5px;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.25s ease;
}
.pv__reset:hover {
  text-decoration-color: currentColor;
}
.pv__reset:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; }

/*
 * 12 列栅格：`lg` 占 7 列、`md` 占 5 列、`sm` 占 4 列 —— 「有大有小」。
 * ⚠️ 档位类打在 `<li>` 上（由 `photoGallery` 的 `span` 决定），**不要**用
 *    `.pg__slot:has(.pg__item--lg)` 这种反向选择：`:has` 让「谁决定宽度」
 *    和「谁被渲染」分散在两处，加一个档位要改两行。
 * ⚠️ `grid-auto-flow: dense` 让 sm 去补前面留下的空档，否则大档位后面会拖出
 *    一条长长的空带。
 */
.pg {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-flow: dense;
  gap: clamp(16px, 2.4vw, 40px);
  margin: 0;
  padding: 0;
  list-style: none;
}
.pg__slot {
  grid-column: span 4;
}
.pg__slot--lg {
  grid-column: span 7;
}
.pg__slot--md {
  grid-column: span 5;
}

.pg__item {
  margin: 0;
  /* 拖动写 transform，这里给个过渡让「恢复排布」不是硬跳 */
  transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
.pg__item.is-dragging {
  /* 拖动中必须**关掉过渡**，否则「1:1 跟手」会被 0.42s 的缓动吃掉 */
  transition: none;
  position: relative;
  z-index: 5;
}
.pg.is-draggable .pg__item {
  cursor: grab;
  /* 拖动中不要选中文字 / 拖出图片幽灵 */
  user-select: none;
}
.pg.is-draggable .pg__item.is-dragging {
  cursor: grabbing;
}

.pg__btn {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.pg__btn:focus-visible {
  outline: 2px solid var(--ab-ink);
  outline-offset: 4px;
}
.pg__img {
  display: block;
  width: 100%;
  height: auto;
  /* 原始比例，不裁不拉伸 */
  background: rgba(37, 37, 37, 0.04);
}
.pg__cap {
  margin-top: 12px;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--ab-dim);
}

/* ==================== 手机 ==================== */

@media (max-width: 860px) {
  /*
   * 手机上「有大有小」会让画面小到看不清（方案要求手机用错落的两列或单列，
   * 不是缩小的桌面版）。这里统一成单列，靠**原始比例**本身造成错落。
   */
  .pg {
    grid-template-columns: minmax(0, 1fr);
  }
  .pg__slot,
  .pg__slot--lg,
  .pg__slot--md {
    grid-column: span 1;
  }
  .pv__galhint {
    font-size: 11px;
  }
}
</style>
