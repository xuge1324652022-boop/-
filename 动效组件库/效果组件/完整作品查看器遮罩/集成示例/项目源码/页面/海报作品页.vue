<template>
  <div ref="rootRef" class="pp">
    <!-- ==================== 开场 ==================== -->
    <section class="pp__hero">
      <p class="pp__kick">
        <span class="pp__no">05</span>
        <span class="pp__slash" aria-hidden="true">/</span>
        <span class="pp__label">{{ pick(HERO.kicker, lang) }}</span>
      </p>
      <h1 ref="titleRef" class="pp__big">{{ HERO.big }}</h1>
      <!-- 首屏在揭幕后按中英段落各自入场；不能套用后续章节的“到中线即收尾”，否则宽屏会直接跳完。 -->
      <ReferenceIntroduction class="pp__statement" :text="POSTER_INTRO" :label="INTRO_LABEL" :active="introGone && !covered" :finish-at="false" reveal-by="paragraph" />
    </section>

    <InternshipPosterStack :items="internshipFeatured" :lang="lang" @open="onOpenInternship" />
    <InternshipPosterGallery :groups="internshipGroups" :lang="lang" @open="onOpenInternship" />
    <section class="pp__military-heading" aria-labelledby="military-title">
      <span>02 / PERSONAL STUDIES</span>
      <h2 id="military-title">{{ lang === 'zh' ? '军事海报，个人练习' : 'Military posters. Personal studies' }}</h2>
      <ReferenceIntroduction :text="MILITARY_INTRO" :label="MILITARY_LABEL" variant="section" />
    </section>
    <PosterPalette :items="posterSeries" :lang="lang" @open="onOpenSeries" />
    <PosterColourChapters :items="posterSeries" :lang="lang" @open="onOpenSeries" />
    <div class="pp__body">
      <!-- ==================== 03 编辑设计 ==================== -->
      <AboutSection
        index="03"
        motion="slide"
        :label="SECTIONS.pair.label"
        :title="pick(SECTIONS.pair.title, lang)"
        :lead="SECTIONS.pair.lead"
      >
        <!-- morph 在桌面把原片与排版叠进同一取景框，用滚动横向擦出封面；手机按流阅读。 -->
        <EditorialPair :items="editorialPair" :lang="lang" morph @open="onOpenSingle" />
      </AboutSection>

      <!--
        ⚠️ 2026-10-13 删除了原「05 / INDEX 个人作品目录」一屏（十项列表）。
           连带清掉的东西，别再从别处找回来：
             · 模板：`.pp__index` / `.pp__idx*` 整块；
             · 脚本：`onOpenIndex()`、只为它存在的 `t`（上一张/下一张/查看 文案）；
             · 数据：`posterPage.ts` 的 `posterIndex`、`indexKind()`、`SECTIONS.index`；
             · 样式：本文件 `.pp__index` … `.pp__idxarrow` 与 640px 断点里的两条。
           查看器本身仍在：调色板 / 色彩章节 / 叠层 / 编辑设计四处照旧能打开，
           只是不再有「一次打开全部十件」的入口。
      -->
    </div>

    <!-- ==================== 结尾 ==================== -->
    <WorkContinuation next="photo" />

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
/**
 * /poster 组织实习产品版面、军事个人练习与编辑设计，三类作品保持各自来源。
 * 本页负责标题与看图集合；叠层、空间切换和章节动画由对应子组件持有。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'

import gsap from 'gsap'
import WorkContinuation from '../组件/作品续读导航.vue'
import ReferenceIntroduction from '../组件/引导文字揭示.vue'
import { referenceIntroductionGate, referenceIntroductionPace } from '../组件/引导文字状态'
import AboutSection from '../组件/人物与作品/作品章节容器.vue'
import PosterPalette from '../组件/人物与作品/海报色带.vue'
import PosterColourChapters from '../组件/人物与作品/海报色彩章节.vue'
import InternshipPosterStack from '../组件/人物与作品/实习海报叠层.vue'
import InternshipPosterGallery from '../组件/人物与作品/实习海报画廊.vue'
import EditorialPair from '../组件/人物与作品/摄影编辑对照.vue'
import VisualViewer from '../组件/人物与作品/完整作品查看器.vue'
import { pick, WORKS } from '../数据/人物资料'
import { subpageLanguage as lang } from '../组合函数/子页语言状态'
import {

  HERO,
  SECTIONS,
  editorialPair,
  posterSeries,
} from '../数据/海报页资料'
import { assertCollectionCoverage, type VisualAsset } from '../数据/视觉作品资料'
import { internshipFeatured, internshipGroups, POSTER_INTRO } from '../数据/实习海报资料'
import { setupAboutReveal, type AboutRevealHandle } from '../组合函数/数据标记揭示控制'
import { useVisualViewer } from '../组合函数/作品查看器控制'
import { useFitText } from '../组合函数/标题字号拟合'
import {
  POSTER_PAGE_ID,
  isTransitioning,
  jumpTarget,
  markSubpageVisit,
  overlayActive,
} from '../组合函数/应用转场状态'
import { routeCurtainBlocked } from '../组合函数/页面幕布控制'

markSubpageVisit(POSTER_PAGE_ID)

if (import.meta.env.DEV) {
  assertCollectionCoverage(WORKS.map((w) => w.id))
}

const INTRO_LABEL = { zh: '视觉表达', en: 'Visual communication' }
const MILITARY_LABEL = { zh: '个人练习', en: 'Personal studies' }
const MILITARY_INTRO = { zh: '以车辆为主体，探索字体、色彩与系列构图', en: 'Studies in type, colour and composition, built around military vehicles' }

/* ---------------- 全局揭幕后的标题入场 ---------------- */

const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
let reduceMotion = motionMedia.matches
const rootRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)

/*
 * 首屏大标题：按内容容器宽度拟合字号（与 `/photo` 同一处理）。
 * `/poster` 的标题比 `PHOTOGRAPHY` 短，实测在 1024–1440 都没有溢出，
 * 但它是同一类隐患（字号按视口宽算、可用宽度由 `.pp__hero` 的 max-width 与
 * 内边距决定）。既然组件已经在了，就用同一把尺子量 —— 将来换标题不会再翻车。
 */
useFitText(titleRef, { min: 30, max: 240 })

const introGone = ref(false)
let introPlayed = false
let introTimeline: gsap.core.Timeline | undefined
let disposed = false
let reveal: AboutRevealHandle | null = null

const covered = computed(
  () => routeCurtainBlocked.value || !!jumpTarget.value || overlayActive.value || isTransitioning.value,
)
provide(referenceIntroductionGate, computed(() => introGone.value && !covered.value))
// 介绍按自身时长自然展开，不在中线跳到终态；其它子页仍保持默认文字节奏。
provide(referenceIntroductionPace, 1.3)

/**
 * 全局弧形遮罩开始揭幕时，标题同步入场。
 * ⚠️ `introPlayed` 保证只演一次：`covered` 可能反复翻转（开查看器、切语言），
 *    每次都重播会让页面看起来像在闪。
 * 标题结束后放行共享介绍自己的真实行遮罩，避免两条补间写同一段文字。
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
    // 标题完成后再建滚动揭示
    onComplete: () => {
      introGone.value = true
      void buildReveal()
    },
  })
  if (titleRef.value) {
    tl.fromTo(
      titleRef.value,
      { yPercent: 40, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 1.2, ease: 'power2.out' },
      0,
    )
  }
}

/** 建滚动揭示与编排。**整页只建这一次**（本页没有随语言重建的段落）。 */
async function buildReveal(): Promise<void> {
  if (reduceMotion || !rootRef.value || reveal) return
  await nextTick()
  if (disposed || !rootRef.value || reveal) return
  reveal = setupAboutReveal(rootRef.value, { reduceMotion })
}

watch(covered, (isCovered) => {
  if (!isCovered) playIntro()
})

/** 用户运行中切换减少动态：立即显示文字终态，并释放已有动画。 */
function onMotionChange(): void {
  reduceMotion = motionMedia.matches
  if (reduceMotion) {
    introTimeline?.kill()
    introGone.value = true
    gsap.set(titleRef.value, { clearProps: 'transform,opacity' })
    reveal?.dispose()
    reveal = null
  } else if (introGone.value) {
    void buildReveal()
  }
}

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
 * 军事个人练习里点开 → 九张一组（全部车辆海报，可在查看器里左右切换）。
 * 调色板与色彩章节都发同一个 `open` 事件，传的是同一个 `posterSeries` 的下标，
 * 所以两处点开看到的集合完全一致。
 */
function onOpenSeries(index: number, trigger: HTMLElement): void {
  openViewerAt(posterSeries, index, trigger)
}

/** 查看器只打开该 PDF 的页面，不把产品版面与个人军事作品串到一起。 */
function onOpenInternship(item: VisualAsset, trigger: HTMLElement): void {
  const group = internshipGroups.find(group => group.items.some(page => page.id === item.id))
  if (group) openViewerAt(group.items, group.items.findIndex(page => page.id === item.id), trigger)
}

/** 编辑设计里点开 → 两张一组（原片 + 封面练习） */
function onOpenSingle(item: VisualAsset, trigger: HTMLElement): void {
  openViewerAt(editorialPair, editorialPair.indexOf(item), trigger)
}

/* ---------------- 生命周期 ---------------- */

onMounted(async () => {
  await nextTick()

  if (disposed) return
  if (!covered.value) playIntro()

  motionMedia.addEventListener('change', onMotionChange)
})

onBeforeUnmount(() => {
  // resetViewer 同步释放锁与焦点记录；这里不能用会恢复旧滚动位置的 close 动画。
  disposed = true
  introTimeline?.kill()
  reveal?.dispose()
  reveal = null
  gsap.killTweensOf(titleRef.value)
  motionMedia.removeEventListener('change', onMotionChange)
  resetViewer()
})
</script>

<style scoped>
/* ==================== 暖色纸色板 ====================
 * ⚠️ 覆盖 `--ab-*`（它们定义在 `src/style.css` 的 `:root`，是全局的）：
 *    复用的 `AboutSection` / `EditorialPair` 内部一律 `var(--ab-*)`，
 *    在这里覆盖一次，它们就自动变成暖色纸配色 —— 不用给它们加新 props。
 * ⚠️ 只在 `.pp` 上覆盖，不写回 `:root`：`/about` 的冷白纸不能被这一页改掉。
 */
.pp {
  --ab-bg: #f6f1e7;
  --ab-ink: #2b241c;
  --ab-soft: #6a5c4c;
  --ab-dim: #a2947f;
  --ab-line: #e2d8c6;
  --ab-accent: #b4472c;

  position: relative;
  min-height: 100vh;
  background: var(--ab-bg);
  color: var(--ab-ink);
  /* 与 /about、/photo 同一处理：`clip` 不建滚动容器，sticky 才能生效 */
  overflow-x: clip;
}

/* ==================== 开场 ==================== */

.pp__hero {
  max-width: 1400px;
  margin-inline: auto;
  padding: clamp(96px, 13vh, 160px) clamp(20px, 4.4vw, 64px) clamp(40px, 8vh, 96px);
}
.pp__kick {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.28em;
}
.pp__no {
  color: var(--ab-accent);
}
.pp__slash {
  color: var(--ab-dim);
}
.pp__label {
  color: var(--ab-soft);
}
.pp__big {
  margin: clamp(14px, 2.6vh, 30px) 0 0;
  font-size: clamp(30px, 13.89vw, 240px);
  font-weight: 400;
  line-height: 0.9;
  letter-spacing: -0.03em;
  color: var(--ab-ink);
}
.pp__statement { margin-top:clamp(54px,10vh,110px); }
.pp__military-heading > span { font-size:10px; letter-spacing:.16em; }
.pp__military-heading h2 { margin:22px 0 42px; font-size:clamp(30px,4vw,56px); font-weight:500; letter-spacing:-.035em; }
.pp__military-heading { padding:100px 4.4vw 60px; }
.pp__military-heading h2 { margin-bottom:24px; }

/* ==================== 正文 ==================== */

.pp__body {
  width: 100%;
  max-width: 1400px;
  margin-inline: auto;
  padding-inline: clamp(20px, 4.4vw, 64px);
}

</style>
