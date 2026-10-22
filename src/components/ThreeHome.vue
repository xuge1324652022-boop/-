<template>
  <!-- 整个体验的根：data-phase 供 CSS 按相位改样式，data-selected 标记当前选中的卡 -->
  <section ref="rootRef" class="three-home" :data-phase="phase" :data-selected="activeIndex">
    <!-- 「相机」层：名字是历史遗留，这里其实没有任何 perspective，
         它只是最外层的视差容器 -->
    <div class="gallery-camera">
      <!-- 视差第 1 层：整个舞台，位移最小（±5 / ±4） -->
      <div ref="stageRef" class="gallery-stage">
        <!-- 视差第 2 层：轨道，独占 rotateX，位移 ±10 / ±7 -->
        <div ref="orbitRef" class="gallery-orbit">
          <!-- 六张卡：v-for 渲染，每层的 ref 由 setXxxRef 系列按 index 收集 -->
          <div
            v-for="(chapter, index) in chapters"
            :key="chapter.key"
            :ref="(el) => setPositionRef(el, index)"
            class="card-position"
            :data-card="index"
          >
            <!-- 视差第 3 层：零尺寸漂移容器（±20 / ±14）。
                 套在这里而不是改 .card-position，是为了不碰 galleryMotion 拥有的节点 -->
            <div :ref="(el) => setDriftRef(el, index)" class="card-drift">
              <!-- 卡片平面：可点击、可键盘聚焦（role=button + tabindex）。
                   ⚠️ 它的 transform / clip-path 由 galleryMotion 独占，别在这里写 -->
              <div
                :ref="(el) => setPlaneRef(el, index)"
                class="card-plane"
                role="button"
                tabindex="0"
                :data-cursor="phase === 'gallery' ? 'Explore' : undefined"
                data-cursor-zh="探索"
                data-cursor-en="Explore"
                :aria-label="`选择第 ${chapter.number} 张卡片：${chapter.subtitle}`"
                @click.stop="onCardClick(index)"
                @keydown.enter.prevent.stop="onCardClick(index)"
                @keydown.space.prevent.stop="onCardClick(index)"
              >
                <!-- 卡片内容：每张卡自己的构图，动画只在这个子树内部跑 -->
                <CardVisual
                  :ref="(el) => setVisualRef(el, index)"
                  :index="index"
                  :kind="chapter.key"
                  :active="index === activeIndex || phase === 'gallery'"
                />
                <!-- 描边：邻近度越高越亮，且亮度会乘 reach 随 focus 淡出 -->
                <div :ref="(el) => setOutlineRef(el, index)" class="card-outline" />
                <!-- 前置标签：编号 + 章节名，聚焦时向右滑出 -->
                <div :ref="(el) => setLabelRef(el, index)" class="card-label">
                  <span>{{ chapter.number }}</span>
                  <span>{{ chapter.title }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 中央标题：走焦点轨淡出 —— 不能按 phase 硬写 opacity:0（会闪断） -->
    <div ref="titleRef" class="center-title">
      <h1>SELECTED WORKS</h1>
      <p>VIDEO · COLOR · DESIGN · PHOTO</p>
    </div>

    <!-- 索引按钮（右上）：只在画廊相与详情相显示 -->
    <button
      ref="indexTriggerRef"
      v-show="showIndex"
      type="button"
      class="index-button"
      :aria-expanded="indexPanelOpen"
      aria-controls="chapter-index"
      aria-label="打开章节索引"
      @click="toggleIndex"
    >
      索引
    </button>

    <!-- 右下切换控件：上一张 / 计数 / 下一张 -->
    <div v-show="phase !== 'intro'" class="deck-controls">
      <button type="button" class="deck-control" aria-label="上一张作品" @click="switchCard(-1)">
        ←
      </button>
      <span class="deck-counter">{{ chapters[activeIndex].number }} / 06</span>
      <button type="button" class="deck-control" aria-label="下一张作品" @click="switchCard(1)">
        →
      </button>
    </div>

    <!-- 章节索引面板。Teleport 到 <body>，好让它的 z-index 能压过角落的控件 ——
         那些控件位于 .three-home 的层叠上下文内部（isolation: isolate），
         留在原地的话永远盖不住它们。 -->
    <Teleport to="body">
      <Transition
        :css="false"
        @before-enter="prepareIndexPanel"
        @enter="enterIndexPanel"
        @leave="leaveIndexPanel"
        @after-leave="finishIndexClose"
      >
        <div
          v-if="indexPanelOpen"
          ref="indexPanelRef"
          id="chapter-index"
          class="index-panel"
          role="dialog"
          aria-modal="true"
          aria-label="章节索引"
          @click.self="indexPanelOpen = false"
          @keydown="onIndexKeydown"
        >
          <!-- 索引列表：六行，当前项高亮并额外显示编号 -->
          <ul class="index-list">
            <li
              v-for="(chapter, i) in chapters"
              :key="i"
              :class="{ active: i === activeIndex }"
              role="button"
              tabindex="0"
              :aria-current="i === activeIndex ? 'page' : undefined"
              :aria-label="`跳转到第 ${chapter.number} 张卡片：${chapter.subtitle}`"
              @click="jumpFromIndex(i)"
              @keydown.enter.prevent="jumpFromIndex(i)"
              @keydown.space.prevent="jumpFromIndex(i)"
            >
              <span class="index-row">
                <span v-if="i === activeIndex" class="index-number">{{ chapter.number }}</span>
                <span class="index-subtitle">{{ chapter.subtitle }}</span>
                <!-- 英文名保留在 DOM 里（视觉上隐藏），这样浏览器的
                 右键翻译功能仍有文本可用。 -->
                <span class="index-title">{{ chapter.title }}</span>
              </span>
            </li>
          </ul>
          <button
            class="index-close"
            type="button"
            aria-label="关闭索引"
            @click="indexPanelOpen = false"
          >
            关闭
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- 自定义光标已统一迁到 App.vue 的 <CustomCursor />（全站共用，状态走 useCursor.ts） -->
  </section>
</template>

<script setup lang="ts">
/**
 * 首页六卡画廊的交互宿主：状态机负责阶段，galleryMotion 负责几何，CardVisual 负责卡内动效。
 * 此处统一协调拖拽、滚轮、键盘、索引与后退恢复；只写各自持有的变换层，避免相互覆盖。
 * 指针视差按需唤醒 ticker，尺寸变化去重；卸载统一撤销监听、计时器、观察器与动画。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import gsap from 'gsap'
import {
  CARD_COUNT,
  INTRO_DURATION,
  clamp,
  entranceEase,
  layoutGallery,
  normalizeIndex,
  projectCardCorners,
  FOCUS_DURATION,
  type GalleryState,
} from '../utils/galleryMotion'
import { createChapterTransition } from '../experience/transitions'
import { createGalleryRenderer } from '../experience/galleryRenderer'
import { galleryLeavePosition, lastFocusedCard, startJump } from '../composables/useTransition'
import { cursorLockState } from '../composables/useCursor'
import { routeCurtainActive } from '../composables/usePageCurtain'
import { useHomeIntroduction } from '../composables/useHomeIntroduction'
import { CHAPTERS } from '../data/chapters'
import CardVisual from './CardVisual.vue'

type Phase = 'intro' | 'gallery' | 'focusing' | 'detail' | 'returning'

/**
 * 从卡片子页「后退」回来时，要重新展开铺满全屏的那张卡（下标 0..5）。
 * null 表示走正常开场（黄幕撕裂 + 六卡绽开）。
 *
 * 由 GalleryView 传入：它认得「这次进 `/` 是浏览器后退还是普通导航」。
 */
const props = withDefaults(
  defineProps<{
    restoreIndex?: number | null
    preloaderDone?: boolean
    autoEnterAbout?: boolean
  }>(),
  {
    restoreIndex: null,
    preloaderDone: false,
    autoEnterAbout: false,
  },
)

// 章节列表直接取自 data/chapters.ts（编号 / 标题 / 副标题的唯一来源）。
// 这里只是起个短别名，本地不再另建数组 —— 否则两处顺序一旦不同步，
// 索引面板点第 3 项就会切到第 4 张卡。
const chapters = CHAPTERS
const aboutIndex = chapters.findIndex((chapter) => chapter.key === 'about')

// 四个关键 DOM 引用：根容器 / 舞台 / 轨道 / 中央标题
const rootRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const orbitRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const positions: HTMLElement[] = []
const drifts: HTMLElement[] = []
const planes: HTMLElement[] = []
const outlines: HTMLElement[] = []
const labels: HTMLElement[] = []

type ElementRef = Element | ComponentPublicInstance | null

interface CardVisualHandle {
  play(): void
  pause(): void
  /** Rebuild after a resize; safe to call on a host measured inside display:none. */
  remount(): void
  /** Replay the one-shot establish pass (the card's own entrance on focus). */
  restart(): void
}

const visuals: (CardVisualHandle | null)[] = []

/** 把模板 ref 回调拿到的元素按下标存进数组 */
function assignRef(target: HTMLElement[], el: ElementRef, index: number) {
  if (el instanceof HTMLElement) target[index] = el
}

/** 收集卡片视觉节点（CardVisual 的根） */
const setVisualRef = (el: ElementRef, index: number) => {
  visuals[index] = el ? (el as unknown as CardVisualHandle) : null
}
// 下面几个都是模板里的 ref 回调：分别收集卡片的位置 / 漂移 / 平面 / 描边 / 前置标签节点。
// 注意：`.card-position` 与 `.card-plane` 的 transform 由 galleryMotion 独占，
// 这里只拿引用，绝不在这里写它们的样式。
const setPositionRef = (el: ElementRef, index: number) => assignRef(positions, el, index)
const setDriftRef = (el: ElementRef, index: number) => assignRef(drifts, el, index)
const setPlaneRef = (el: ElementRef, index: number) => assignRef(planes, el, index)
const setOutlineRef = (el: ElementRef, index: number) => assignRef(outlines, el, index)
const setLabelRef = (el: ElementRef, index: number) => assignRef(labels, el, index)

/** 视口变化后重建所有卡片视觉（转发给 CardVisual.remount） */
function remountVisuals(): void {
  for (const visual of visuals) visual?.remount()
}

// —— 响应式状态 ——
// phase: 渲染用相位；activeIndex: 当前选中的卡；hoverIndex: 悬停的卡；dragging: 是否正在拖拽
const phase = ref<Phase>('intro')
const activeIndex = ref(0)
const hoverIndex = ref(-1)
const dragging = ref(false)

const state: GalleryState = { entrance: 0, orbit: -75, focus: 0, selected: 0 }
let viewport = { width: 1, height: 1 }
let introTimeline: gsap.core.Timeline | null = null
let orbitTween: gsap.core.Tween | null = null
let resizeObserver: ResizeObserver | null = null
let reducedMotion = false
let destroyed = false
let wheelAt = 0
let wheelLast = 0
let wheelAmount = 0
// Keep the resting destination separate from the eased position. Repeated
// navigation must add a chapter to the destination, never to an in-flight frame.
let orbitTarget = state.orbit
let dragTarget: number | null = null
let clickReleaseTimer: ReturnType<typeof setTimeout> | null = null

let pointerStart: { id: number; x: number; orbit: number } | null = null
let suppressClick = false
let dragSamples: { x: number; t: number }[] = []
let dragStartStep = 0
let dragStartIndex = 0
/** Target queued by switchCard() while a chapter was still on screen. */
let pendingFocus: number | null = null

const DRAG_SENSITIVITY = 0.12
const DRAG_CHAPTER_VIEWPORT = 0.45
const DRAG_CHAPTER_PX_MAX = 520
const INERTIA_MS = 240
const MAX_FLICK_STEPS = 2
const VELOCITY_WINDOW_MS = 70
let dragSensitivity = DRAG_SENSITIVITY

/** 按视口宽度重算拖拽灵敏度：窄屏更难拖，避免手指一划就转过头 */
function updateDragSensitivity(): void {
  const span = Math.min(viewport.width * DRAG_CHAPTER_VIEWPORT, DRAG_CHAPTER_PX_MAX)
  dragSensitivity = clamp(60 / Math.max(120, span), DRAG_SENSITIVITY, 0.5)
}

// 视差漂移的当前值与「已渲染值」—— 后者用于判断是否需要真的写 DOM
const drift = { x: 0, y: 0 }
const driftRendered = { x: 0, y: 0 }
const driftTarget = { x: 0, y: 0 }
// Reference CursorLabel follows the pointer with frame-independent lambda 26;
// its InteractiveGallery uses lambda 12 while pressed. Reuse our existing ticker.
const POINTER_LAMBDA = 26
const DRAG_LAMBDA = 12

const PROXIMITY_FALLOFF = 300
const PROXIMITY_TAU = 0.16
// prox / proxTarget: 每张卡到环最前方的邻近度（0..1）及其目标值
// pointerAt: 指针位置与是否在窗口内
const prox = new Array<number>(CARD_COUNT).fill(0)
const proxTarget = new Array<number>(CARD_COUNT).fill(0)
const pointerAt = { x: 0, y: 0, inside: false }

/** 测量每张卡到「环最前方」的邻近度，写入 proxTarget */
function measureProximity(): void {
  if (!pointerAt.inside || reducedMotion || phase.value !== 'gallery') {
    for (let i = 0; i < CARD_COUNT; i++) proxTarget[i] = 0
    hoverIndex.value = -1
    return
  }

  const layout = layoutGallery(viewport.width, viewport.height, state)
  let best = -1
  let bestValue = 0.06

  for (let i = 0; i < CARD_COUNT; i++) {
    if (layout.poses[i].opacity <= 0.004) {
      proxTarget[i] = 0
      continue
    }
    const corners = projectCardCorners(layout, i)
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const corner of corners) {
      if (corner.x < minX) minX = corner.x
      if (corner.x > maxX) maxX = corner.x
      if (corner.y < minY) minY = corner.y
      if (corner.y > maxY) maxY = corner.y
    }
    const gapX = Math.max(minX - pointerAt.x, 0, pointerAt.x - maxX)
    const gapY = Math.max(minY - pointerAt.y, 0, pointerAt.y - maxY)
    const value = 1 - clamp(Math.hypot(gapX, gapY) / PROXIMITY_FALLOFF)
    proxTarget[i] = value
    if (value > bestValue) {
      bestValue = value
      best = i
    }
  }

  hoverIndex.value = best
}

/** 把 prox 朝 proxTarget 阻尼收敛；返回 true 表示还在动 */
function settleProximity(dt: number): boolean {
  const k = 1 - Math.exp(-dt / PROXIMITY_TAU)
  let changed = false
  for (let i = 0; i < CARD_COUNT; i++) {
    const gap = proxTarget[i] - prox[i]
    if (Math.abs(gap) < 0.0008) {
      if (prox[i] !== proxTarget[i]) {
        prox[i] = proxTarget[i]
        changed = true
      }
      continue
    }
    prox[i] += gap * k
    changed = true
  }
  return changed
}

let lastTickAt = 0
let parallaxAttached = false

/** 唤醒视差 ticker —— 有变化时调用，平时休眠以省电 */
function wakeParallax(): void {
  if (parallaxAttached || destroyed) return
  parallaxAttached = true
  lastTickAt = 0
  gsap.ticker.add(parallaxTick)
}

/** 强制重新测量一次邻近度，并唤醒视差 */
function refreshProximity(): void {
  measureProximity()
  wakeParallax()
}

/** 视差每帧：把四层漂移与邻近度阻尼到目标值，只在真的变化时才写 DOM */
function parallaxTick() {
  const now = performance.now()
  const dt = lastTickAt ? Math.min(0.05, (now - lastTickAt) / 1000) : 0.016
  lastTickAt = now

  const follow = 1 - Math.exp(-POINTER_LAMBDA * dt)
  for (const axis of ['x', 'y'] as const) {
    const gap = driftTarget[axis] - drift[axis]
    drift[axis] = Math.abs(gap) < 0.0005 ? driftTarget[axis] : drift[axis] + gap * follow
  }
  let orbitChanged = false
  if (dragTarget !== null && phase.value === 'gallery') {
    const gap = dragTarget - state.orbit
    if (Math.abs(gap) > 0.005) {
      state.orbit = reducedMotion
        ? dragTarget
        : state.orbit + gap * (1 - Math.exp(-DRAG_LAMBDA * dt))
      const steps = Math.round(state.orbit / 60 - dragStartStep)
      state.selected = normalizeIndex(dragStartIndex - steps)
      activeIndex.value = state.selected
      orbitChanged = true
    }
  }
  if (orbitChanged) measureProximity()
  const proxChanged = settleProximity(dt)
  const driftChanged =
    Math.abs(drift.x - driftRendered.x) >= 0.0005 || Math.abs(drift.y - driftRendered.y) >= 0.0005
  if (driftChanged) {
    driftRendered.x = drift.x
    driftRendered.y = drift.y
  }

  if (proxChanged || driftChanged || orbitChanged) render()
  if (!proxChanged && !driftChanged && !orbitChanged) {
    gsap.ticker.remove(parallaxTick)
    parallaxAttached = false
  }
}

// 自定义光标已统一迁到 App.vue 的 <CustomCursor />（全站共用）。
// 画廊不再自己实现光标，只通过 composables/useCursor 的 cursorLockState 把
// 「拖拽 / 锁定」状态透传给全局光标（见下方 watch）。
//
// 拖拽中 → 'drag'（原生抓取手形）；detail / focusing / returning 阶段 → 'locked'；
// 其余 → null，由全局光标按自身逻辑在 idle / hover 之间切换（拖动 / 锁定优先）。
watch([dragging, phase], () => {
  cursorLockState.value = dragging.value
    ? 'drag'
    : phase.value === 'detail' || phase.value === 'focusing' || phase.value === 'returning'
      ? 'locked'
      : null
})

/** 指针移动：更新位置、唤醒视差、采样颜色 */
function onPointerHover(event: PointerEvent) {
  if (reducedMotion || event.pointerType !== 'mouse') return
  pointerAt.x = event.clientX
  pointerAt.y = event.clientY
  pointerAt.inside = true
  driftTarget.x = clamp((event.clientX / Math.max(1, viewport.width)) * 2 - 1, -1, 1)
  driftTarget.y = clamp((event.clientY / Math.max(1, viewport.height)) * 2 - 1, -1, 1)
  refreshProximity()
}

/** 指针离开窗口：视差回中、光标隐藏 */
function onPointerLeave() {
  driftTarget.x = 0
  driftTarget.y = 0
  pointerAt.inside = false
  hoverIndex.value = -1

  for (let i = 0; i < CARD_COUNT; i++) proxTarget[i] = 0
  wakeParallax()
}

const render = createGalleryRenderer({
  state,
  getViewport: () => viewport,
  isDisposed: () => destroyed,
  drift,
  proximity: prox,
  visuals,
  stageRef,
  orbitRef,
  titleRef,
  positions,
  drifts,
  planes,
  outlines,
  labels,
})

/**
 * 停掉所有运动：转场时间线、视差 ticker。
 *
 * ⚠️ 这里**不能**用 `getChapter().kill()` —— 那是惰性工厂，在从未转场过的
 *    组件上调用会先构造一个转场实例再立刻杀掉。卸载路径上每销毁一次就白
 *    造一个，而且把「有没有转场过」这件事弄混了。没建过就是没得停。
 */
function stopMotion() {
  dragTarget = null
  pointerStart = null
  dragging.value = false
  introTimeline?.kill()
  introTimeline = null
  orbitTween?.kill()
  orbitTween = null
  chapterInstance?.kill()
}

/** 把画廊落到静止态（entrance=1、focus=0） */
function settleGallery() {
  stopMotion()
  state.entrance = 1
  state.orbit = 0
  orbitTarget = 0
  state.focus = 0
  phase.value = 'gallery'
  // settle() 必须跑在 render() 之前 —— 否则章节状态机还停在 'chapter'，
  // 下一次绘制读到的宿主状态就是过期的。
  getChapter().settle()
  render()
  consumePendingFocus()
}

/** 预加载信号失灵（被摘除 / 脚本早退）时的兜底等待时长 */
const PRELOADER_FALLBACK_MS = 12000
let booted = false
let bootTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 预加载结束后接管：启动画廊。整个体验只在这里真正开始动一次。
 *
 * 组件本身是挂在预加载幕**底下**挂载的，构建开销因此落在黄幕后面；
 * `boot()` 是启动可见运动的唯一信号。另有 PRELOADER_FALLBACK_MS 兜底 ——
 * 万一预加载永远不喊（被摘除、脚本报错），画廊也不会永远停在 entrance = 0。
 */
function boot() {
  if (booted) return
  booted = true
  if (bootTimer !== null) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  window.removeEventListener('preloader-complete', boot)
  runIntro()
}

/**
 * 取消挂起的 boot —— 调试 API 接管 state 时**必须**调用。
 *
 * 调试 API（以及它触发的任何显式状态变更）在被调用的那一刻就接管了
 * `state`。少了这一步，几秒后预加载结束仍会触发 boot()，runIntro() 把
 * entrance / orbit / selected 一起重置 —— 调用方刚设好的状态被无声覆盖，
 * 六张卡的动画也被拨回各自的基线构图。
 */
function cancelBoot(): void {
  booted = true
  if (bootTimer !== null) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  window.removeEventListener('preloader-complete', boot)
}

/** 播放开场动画：六张卡从中心绽开 */
function runIntro() {
  cancelBoot()
  const chosen = aboutIndex
  activeIndex.value = chosen
  state.selected = chosen
  state.entrance = 0
  state.orbit = -75
  orbitTarget = -75
  state.focus = 0
  phase.value = 'intro'
  render()

  if (reducedMotion) {
    // 减少动态时直接落到关于我，仍按相同的就绪条件进入后续引导。
    for (const visual of visuals) visual?.pause()
    settleGallery()
    focusChapter(chosen)
    return
  }

  introTimeline = gsap.timeline({
    onUpdate: render,
    // 六张卡落定 → 切到 gallery 阶段并聚焦被选中的那张（见内注）
    onComplete: () => {
      orbitTarget = 0
      // 六张卡已在环上落定；把观看者引向单独一屏，
      // 好让开场有一个目的地，而不是在标题上原地打转。
      // focusChapter 的闸门是 phase === 'gallery'，所以要先让环落定。
      phase.value = 'gallery'
      focusChapter(chosen)
    },
  })
  introTimeline.to(state, {
    entrance: 1,
    orbit: 0,
    duration: INTRO_DURATION,
    ease: entranceEase,
  })
}

/** 环上两点之间的最短带符号距离（考虑首尾相接） */
function signedDelta(from: number, to: number): number {
  let delta = normalizeIndex(to - from)
  if (delta > CARD_COUNT / 2) delta -= CARD_COUNT
  return delta
}

/** 把指定卡片转到环的最前方 */
function rotateToFront(index: number, duration: number) {
  const chosen = normalizeIndex(index)
  const delta = signedDelta(activeIndex.value, chosen)
  activeIndex.value = chosen
  state.selected = chosen
  if (delta === 0) {
    render()
    refreshProximity()
    return
  }
  orbitTween?.kill()
  orbitTarget -= delta * 60
  orbitTween = gsap.to(state, {
    orbit: orbitTarget,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      render()
      refreshProximity()
    },
    onComplete: () => {
      render()
      refreshProximity()
    },
  })
  refreshProximity()
}

/** 在环上前后移动一张卡 */
function navigate(delta: number) {
  if (phase.value !== 'gallery') return
  cancelHomeIntroduction()
  const next = normalizeIndex(activeIndex.value + delta)
  rotateToFront(next, reducedMotion ? 0.12 : 0.9)
}

/**
 * 切换卡片 —— 与滚轮 / 方向键不同，它在章节内部也有效。
 *
 * 滚轮与方向键只转环；这个控件会先退出全屏卡，等画廊回来再落到目标那张。
 * `focusing` 相走 settleGallery() 硬停，`detail` 相跑反向时间线；
 * 两条路都终止在画廊态，排好的目标随后由 consumePendingFocus() 取走。
 */
function switchCard(delta: number) {
  // 开场期间环还在构建中；此时去步进它会与 intro 时间线争夺 state.orbit。
  if (phase.value === 'intro') return
  cancelHomeIntroduction()
  const next = normalizeIndex(activeIndex.value + delta)
  if (phase.value === 'gallery') {
    rotateToFront(next, reducedMotion ? 0.12 : 0.9)
    return
  }
  pendingFocus = next
  returnToGallery()
}

/** 消费排队的聚焦请求 —— 回到画廊静止后由 settleGallery 调用 */
function consumePendingFocus() {
  const next = pendingFocus
  pendingFocus = null
  if (next !== null) focusChapter(next)
}

/** 聚焦某一章：启动单轨转场，state.focus 0 → 1 */
function focusChapter(index: number) {
  if (phase.value !== 'gallery') return
  // 先停掉任何进行中的转环或开场动画；转场独占 state.focus。
  orbitTween?.kill()
  orbitTween = null
  introTimeline?.kill()
  introTimeline = null

  const chosen = normalizeIndex(index)
  activeIndex.value = chosen
  state.selected = chosen
  state.focus = 0
  phase.value = 'focusing'
  // `restart()` 会重放卡片一次性入场动画（NEWS 帧擦除 / POSTER 显影 /
  // ABOUT 淡入……）。`remount()` 只是重建时间线，且只留给 resize 场景 ——
  // 那种情况下宿主可能在 display:none 子树里被测量过。
  // 在这里调 remount() 会让整段入场动画被完全跳过。
  visuals[chosen]?.restart()
  render()
  refreshProximity()
  getChapter().transitionToChapter()
}

/** 点击卡片：画廊相则转到正面，否则聚焦 */
function onCardClick(index: number) {
  cancelHomeIntroduction()
  if (suppressClick) {
    suppressClick = false
    return
  }
  if (phase.value === 'detail') {
    // 已经处在全屏舞台上：这次点击改道成「跳转」——
    // 先播加载屏（0→100% + 装载），计数到 100% 再切到 /card/NN。
    // 用 state.selected 而不是 index：全屏时只有焦点卡可点，
    // 取 selected 能保证跳转目标与「当前铺满的那张」永远一致。
    // 记下这一张：浏览器后退回画廊时要把它重新展开、铺满全屏。
    lastFocusedCard.value = state.selected
    // 顺带记下「离开时 `/` 是第几条历史」—— 回去时靠 position 判断是不是后退。
    // 此刻还在 `/` 上，读到的就是画廊自己那条。
    galleryLeavePosition.value =
      (window.history.state as { position?: number } | null)?.position ?? null
    // 同步盖黑：装载幕是 v-if 异步挂载的，点击这一帧起先让伪元素黑层挡住
    // 全屏卡，堵掉「点击 → 黑幕上屏」之间可能露出的那 1 帧（首访掉帧时可见）。
    document.documentElement.classList.add('is-jumping')
    startJump(String(state.selected + 1).padStart(2, '0'))
    return
  }
  if (phase.value !== 'gallery') return
  focusChapter(index)
}

/** 返回画廊：转场 state.focus 1 → 0 */
function returnToGallery() {
  if (phase.value === 'gallery') return
  cancelHomeIntroduction()
  if (phase.value === 'focusing') {
    // The existing transition already accepts a partial focus. Retire it from
    // its current frame so Escape / next-card never snaps the room back to zero.
    phase.value = 'returning'
    getChapter().leaveChapter()
    return
  }
  if (phase.value === 'detail') {
    phase.value = 'returning'
    getChapter().leaveChapter()
    return
  }
}

/** 拖拽开始：记录起点与时间，准备采样速度 */
function onPointerDown(event: PointerEvent) {
  // 系统双指手势不能用第二根手指的坐标重建拖拽起点，否则圆环会突然跳位。
  if (event.pointerType === 'touch' && !event.isPrimary) {
    onPointerCancel()
    return
  }
  if (event.button !== 0 || phase.value !== 'gallery' || indexPanelOpen.value) return
  if (event.target instanceof Element && event.target.closest('button, a, input, textarea')) return
  cancelHomeIntroduction()
  orbitTween?.kill()
  orbitTween = null
  if (clickReleaseTimer !== null) {
    clearTimeout(clickReleaseTimer)
    clickReleaseTimer = null
  }
  suppressClick = false
  pointerStart = { id: event.pointerId, x: event.clientX, orbit: state.orbit }
  dragTarget = null
  dragStartStep = orbitTarget / 60
  dragStartIndex = state.selected
  dragSamples = [{ x: event.clientX, t: performance.now() }]
}

/** 拖拽中：采样最近几帧的速度，实时转动轨道 */
function onPointerMove(event: PointerEvent) {
  if (!pointerStart || event.pointerId !== pointerStart.id || phase.value !== 'gallery') return
  if (event.pointerType === 'mouse' && event.buttons === 0) {
    onPointerCancel()
    return
  }

  const dx = event.clientX - pointerStart.x
  if (Math.abs(dx) > 5) {
    suppressClick = true
    dragging.value = true
  }
  if (!suppressClick) return

  dragSamples.push({ x: event.clientX, t: performance.now() })
  if (dragSamples.length > 6) dragSamples.shift()

  dragTarget = pointerStart.orbit + dx * dragSensitivity
  if (reducedMotion) {
    state.orbit = dragTarget
    state.selected = normalizeIndex(dragStartIndex - Math.round(state.orbit / 60 - dragStartStep))
    activeIndex.value = state.selected
    render()
  } else wakeParallax()
}

/** 拖拽结束：按惯性外推，再吸到最近的整格（60° 的整数倍） */
function onPointerUp(event: PointerEvent) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return
  const samples = dragSamples
  const intendedOrbit = dragTarget ?? orbitTarget
  dragTarget = null
  pointerStart = null
  dragging.value = false
  dragSamples = []
  if (suppressClick) {
    clickReleaseTimer = setTimeout(() => {
      suppressClick = false
      clickReleaseTimer = null
    }, 100)
  }

  const releaseOrbit = state.orbit
  let projected = intendedOrbit
  const last = samples[samples.length - 1]
  if (last && !reducedMotion && samples.length > 1) {
    const now = performance.now()
    const reference = samples.find((sample) => now - sample.t <= VELOCITY_WINDOW_MS) ?? samples[0]
    const span = last.t - reference.t
    if (reference !== last && span > 4) {
      const velocity = (last.x - reference.x) / span
      const carry = clamp(
        velocity * INERTIA_MS * dragSensitivity,
        -MAX_FLICK_STEPS * 60,
        MAX_FLICK_STEPS * 60,
      )
      projected = intendedOrbit + carry
    }
  }

  const target = Math.round(projected / 60) * 60
  orbitTarget = target
  if (Math.abs(target - releaseOrbit) < 0.5) return
  const next = normalizeIndex(dragStartIndex - Math.round(target / 60 - dragStartStep))
  state.selected = next
  activeIndex.value = next
  orbitTween?.kill()
  const distance = Math.abs(target - releaseOrbit)
  orbitTween = gsap.to(state, {
    orbit: target,
    duration: reducedMotion ? 0.12 : clamp(0.5 + (distance / 60) * 0.34, 0.5, 1.3),
    ease: 'power2.out',
    onUpdate: () => {
      render()
      refreshProximity()
    },
    onComplete: () => {
      render()
      refreshProximity()
    },
  })
}

/** 拖拽取消（如被系统中断）：放弃这次拖拽 */
function onPointerCancel() {
  if (pointerStart) {
    dragTarget = null
    orbitTarget = Math.round(state.orbit / 60) * 60
    state.selected = normalizeIndex(dragStartIndex - Math.round(orbitTarget / 60 - dragStartStep))
    activeIndex.value = state.selected
    orbitTween = gsap.to(state, {
      orbit: orbitTarget,
      duration: reducedMotion ? 0 : 0.45,
      ease: 'power3.out',
      onUpdate: () => {
        render()
        refreshProximity()
      },
    })
  }
  pointerStart = null
  suppressClick = false
  dragging.value = false
  dragSamples = []
  onPointerLeave()
}

/** 滚轮转环 */
function onWheel(event: WheelEvent) {
  if (event.ctrlKey || phase.value !== 'gallery' || indexPanelOpen.value) return
  event.preventDefault()
  const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  const delta = raw * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height : 1)
  if (Math.abs(delta) < 0.5) return
  const now = performance.now()
  // Accumulate a precision trackpad's small deltas, while retaining the
  // six-card step model. Shorter rests stay responsive without queuing tweens.
  const newGesture = now - wheelLast > 600
  wheelLast = now
  if (now - wheelAt < 180) return
  if (newGesture) wheelAmount = 0
  wheelAmount += clamp(delta, -120, 120)
  if (Math.abs(wheelAmount) < 48) return
  wheelAt = now
  navigate(wheelAmount > 0 ? 1 : -1)
  wheelAmount = 0
}

/** 键盘操作：方向键切换卡片 / Escape 返回画廊 / 数字键直达某章 */
function onKeyDown(event: KeyboardEvent) {
  // The teleported menu owns keyboard input from its first visible frame.
  if (indexPanelOpen.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      indexPanelOpen.value = false
    }
    return
  }
  const target = event.target
  if (target instanceof Element && target.closest('button, input, textarea')) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (phase.value === 'detail') {
      // 章节导航已退役；在章节里按方向键什么都不做。
      event.preventDefault()
      return
    }
    if (phase.value !== 'gallery') return
    event.preventDefault()
    navigate(event.key === 'ArrowRight' ? 1 : -1)
  } else if (event.key === 'Enter' && phase.value === 'gallery') {
    focusChapter(activeIndex.value)
  } else if (event.key === 'Escape') {
    if (indexPanelOpen.value) {
      event.preventDefault()
      indexPanelOpen.value = false
    } else if (phase.value === 'detail' || phase.value === 'focusing') {
      event.preventDefault()
      returnToGallery()
    }
  }
}

/** 窗口尺寸变化：重算布局并重建卡片视觉 */
function resize() {
  const rect = rootRef.value?.getBoundingClientRect()
  if (!rect) return
  viewport = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }
  lastViewportWidth = viewport.width
  lastViewportHeight = viewport.height
  updateDragSensitivity()
  render()
  remountVisuals()
  refreshProximity()
}

let pendingResize: ReturnType<typeof setTimeout> | null = null
const HEIGHT_DEBOUNCE_MS = 160
const HEIGHT_BAR_THRESHOLD_PX = 80
let lastViewportWidth = 0
let lastViewportHeight = 0

/** 节流：把高频 resize 合并成一次，避免时间线被打散 */
function scheduleResize() {
  const rect = rootRef.value?.getBoundingClientRect()
  if (!rect) return
  const nextWidth = Math.max(1, rect.width)
  const nextHeight = Math.max(1, rect.height)
  const widthChanged = nextWidth !== lastViewportWidth
  const heightDelta = Math.abs(nextHeight - lastViewportHeight)
  if (!widthChanged && heightDelta === 0) return
  if (widthChanged || heightDelta >= HEIGHT_BAR_THRESHOLD_PX) {
    if (pendingResize) {
      clearTimeout(pendingResize)
      pendingResize = null
    }
    // 横竖屏切换不只改变外层卡片几何：卡内遮罩/轨道也需按新宿主尺寸重建，
    // 拖动灵敏度同步更新，避免手机转屏后仍使用竖屏的点击与拖动尺度。
    resize()
    return
  }
  if (pendingResize) return
  pendingResize = setTimeout(() => {
    pendingResize = null
    resize()
  }, HEIGHT_DEBOUNCE_MS)
}

/** 执行挂起的 resize */
function flushPendingResize() {
  if (!pendingResize) return
  clearTimeout(pendingResize)
  pendingResize = null
  resize()
}

/**
 * 章节转场实例的**惰性工厂**，不是「取当前章节信息」。
 *
 * 为什么必须惰性：转场系统需要一个已被填充的 render() 面（positions /
 * planes / camera 节点等），而这些只有在模板挂载之后才存在，脚本执行阶段
 * 构造不出来。代价是任何取值路径都会顺手把它造出来 —— 所以只想**停**它的
 * 地方（stopMotion）不能直接调本函数，要看 `chapterInstance`。
 */
function getChapter() {
  if (!chapterInstance) {
    chapterInstance = createChapterTransition({
      state,
      pointer: () => pointerAt,
      focusDuration: () => FOCUS_DURATION,
      reduced: () => reducedMotion,
      render: () => render(),
      onEnterChapter: () => {
        phase.value = 'detail'
        render()
      },
      onReturnToGallery: () => {
        phase.value = 'gallery'
        // 此刻卡片的全屏淡出已经与 state.focus 无关；
        // 刷新邻近度，好让恢复悬停时读到的是光标下方的那张卡。
        refreshProximity()
        render()
        consumePendingFocus()
      },
    })
  }
  return chapterInstance
}
let chapterInstance: ReturnType<typeof createChapterTransition> | null = null

/** 索引按钮是否显示 —— 只在画廊相与详情相出现 */
const showIndex = computed(() => phase.value === 'gallery' || phase.value === 'detail')
/** 全屏索引面板（右上角「索引」按钮打开）是否打开 */
const indexPanelOpen = ref(false)
const indexTriggerRef = ref<HTMLButtonElement | null>(null)
const indexPanelRef = ref<HTMLElement | null>(null)
let indexAnimation: gsap.core.Timeline | null = null

function prepareIndexPanel(element: Element) {
  indexAnimation?.kill()
  gsap.set(element, { opacity: reducedMotion ? 1 : 0, pointerEvents: 'auto' })
  gsap.set(element.querySelectorAll('.index-row'), { yPercent: reducedMotion ? 0 : 100 })
}
function enterIndexPanel(element: Element, done: () => void) {
  focusIndexPanel()
  if (reducedMotion) {
    done()
    return
  }
  indexAnimation = gsap
    .timeline({ onComplete: done })
    .to(element, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0)
    .to(
      element.querySelectorAll('.index-row'),
      { yPercent: 0, duration: 0.8, stagger: 0.04, ease: 'power3.out' },
      0.15,
    )
}
function leaveIndexPanel(element: Element, done: () => void) {
  indexAnimation?.kill()
  gsap.set(element, { pointerEvents: 'none' })
  if (reducedMotion) {
    done()
    return
  }
  indexAnimation = gsap
    .timeline({ onComplete: done })
    .to(element, { opacity: 0, duration: 0.4, ease: 'power2.in' })
}
function focusIndexPanel() {
  indexPanelRef.value
    ?.querySelector<HTMLElement>('.index-list li.active')
    ?.focus({ preventScroll: true })
}
function finishIndexClose() {
  if (destroyed) return
  if (phase.value === 'gallery') indexTriggerRef.value?.focus({ preventScroll: true })
  else planes[state.selected]?.focus({ preventScroll: true })
}
function onIndexKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    indexPanelOpen.value = false
    return
  }
  if (event.key !== 'Tab') return
  const controls = [
    ...(indexPanelRef.value?.querySelectorAll<HTMLElement>('.index-list li, .index-close') ?? []),
  ]
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

/**
 * 开关全屏索引面板。
 *
 * 在章节内部打开时会先 settleGallery() 把画廊冻住 —— 列表压在一个静止的
 * 背景上，关掉之后观看者已经回到画廊态。这个按钮因此同时兼作
 * 「返回画廊」用。
 */
function toggleIndex() {
  cancelHomeIntroduction()
  if (indexPanelOpen.value) {
    indexPanelOpen.value = false
    return
  }
  if (phase.value !== 'gallery') settleGallery()
  indexPanelOpen.value = true
}

/** 从索引面板跳转：先关面板，再聚焦对应章节 */
function jumpFromIndex(index: number) {
  indexPanelOpen.value = false
  if (phase.value !== 'gallery') return
  focusChapter(normalizeIndex(index))
}

// 把调试 API 挂到 window.__galleryDebug（需 ?galleryDebug=1）
const debugWindow = window as Window & { __galleryDebug?: object }
const galleryDebug = new URLSearchParams(location.search).has('galleryDebug')

const cancelHomeIntroduction = useHomeIntroduction({
  eligible: props.autoEnterAbout,
  disabled: galleryDebug,
  ready: () =>
    props.preloaderDone &&
    phase.value === 'detail' &&
    activeIndex.value === aboutIndex &&
    !routeCurtainActive.value &&
    !indexPanelOpen.value,
  // 复用卡片点击入口，历史定位与全局幕布都走既有流程。
  enter: () => onCardClick(aboutIndex),
})

watch(
  () => props.preloaderDone,
  (done) => {
    if (done && props.restoreIndex === null && !galleryDebug) boot()
  },
)

/** 挂载：注册各种监听、启动 ticker，并等待或接管预加载 */
onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resizeObserver = new ResizeObserver(scheduleResize)
  if (rootRef.value) resizeObserver.observe(rootRef.value)
  resize()

  const visualViewport = window.visualViewport
  if (visualViewport) visualViewport.addEventListener('resize', scheduleResize)
  window.addEventListener('orientationchange', flushPendingResize)

  if (props.restoreIndex !== null) {
    /*
     * 从卡片子页后退回来：不播开场。
     *
     * 开场（黄幕撕裂 + 六卡绽开）是整个站点的「第一阶段」，后退回主界面时
     * 再放一遍等于把人踢回起点。这里直接把画廊落定，然后把离开时铺满的
     * 那张卡重新展开 —— 也就是「回到主界面时，再把卡片展开、覆盖全屏展示一遍」。
     *
     * cancelBoot() 必须调：这一趟没有 Preloader，没人会抛 preloader-complete，
     * 不取消的话要等 12s 兜底才 boot，画廊会一直僵在 entrance = 0。
     */
    cancelBoot()
    settleGallery()
    focusChapter(normalizeIndex(props.restoreIndex))
  } else if (galleryDebug && reducedMotion) {
    for (const visual of visuals) visual?.pause()
    settleGallery()
  } else if (props.preloaderDone && !galleryDebug) {
    boot()
  } else {
    // 入场动画要等预加载交棒。挂载本身发生在黄幕仍覆盖视口的时候，
    // 因此那笔本来会在六张卡出现瞬间显现为卡顿的构建开销，
    // 被藏在了黄幕背后。
    window.addEventListener('preloader-complete', boot, { once: true })
    bootTimer = setTimeout(boot, PRELOADER_FALLBACK_MS)
  }

  wakeParallax()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointermove', onPointerHover, { passive: true })
  document.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('blur', onPointerCancel)
  rootRef.value?.addEventListener('pointerdown', onPointerDown)
  rootRef.value?.addEventListener('wheel', onWheel, { passive: false })

  if (['127.0.0.1', 'localhost'].includes(location.hostname) && galleryDebug) {
    const chapter = getChapter()
    debugWindow.__galleryDebug = {
      // 这里的每个入口都会先取消挂起的 boot：从这一刻起状态归调用者所有，
      // 而迟到的 `runIntro()` 会悄悄把它覆盖掉（见 `cancelBoot`）。
      gallery: () => {
        cancelBoot()
        settleGallery()
      },
      focus: (index: number) => {
        cancelBoot()
        focusChapter(index)
      },
      select: (index: number) => {
        cancelBoot()
        if (phase.value === 'gallery') rotateToFront(index, reducedMotion ? 0.12 : 0.45)
        else focusChapter(index)
      },
      back: () => {
        cancelBoot()
        returnToGallery()
      },
      returnToGallery: () => {
        cancelBoot()
        returnToGallery()
      },
      restart: runIntro,
      pause: () => {
        chapter.timeline?.pause()
        orbitTween?.pause()
      },
      resume: () => {
        chapter.timeline?.resume()
        orbitTween?.resume()
      },
      seek: (seconds: number) => {
        const tl = chapter.timeline
        if (tl) tl.seek(seconds, false).pause()
        render()
      },
      chapterPhase: () => chapter.machine.current,
      transition: () => ({ focus: state.focus }),
      snapshot: () => ({
        phase: phase.value,
        state: {
          entrance: state.entrance,
          orbit: state.orbit,
          focus: state.focus,
          selected: state.selected,
        },
        viewport: { ...viewport },
        corners: chapters.map((_, index) =>
          projectCardCorners(layoutGallery(viewport.width, viewport.height, state), index),
        ),
        nodeCount: rootRef.value?.querySelectorAll('.card-plane').length,
        selected: activeIndex.value,
      }),
    }
  }
})

/** 卸载：清理所有监听与时间线 */
onUnmounted(() => {
  destroyed = true
  // 离开画廊：把「拖拽 / 锁定」状态交还给全局光标，避免它卡在 drag/locked。
  cursorLockState.value = null
  if (bootTimer !== null) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  window.removeEventListener('preloader-complete', boot)
  stopMotion()
  indexAnimation?.kill()
  indexAnimation = null
  if (pendingResize) {
    clearTimeout(pendingResize)
    pendingResize = null
  }
  resizeObserver?.disconnect()
  const visualViewport = window.visualViewport
  if (visualViewport) visualViewport.removeEventListener('resize', scheduleResize)
  window.removeEventListener('orientationchange', flushPendingResize)
  gsap.ticker.remove(parallaxTick)
  parallaxAttached = false
  if (clickReleaseTimer !== null) clearTimeout(clickReleaseTimer)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointermove', onPointerHover)
  document.removeEventListener('pointerleave', onPointerLeave)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('blur', onPointerCancel)
  rootRef.value?.removeEventListener('pointerdown', onPointerDown)
  rootRef.value?.removeEventListener('wheel', onWheel)
  delete debugWindow.__galleryDebug
})
</script>

<style scoped>
.three-home {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #111;
  color: #f4f4f2;
  touch-action: none;
  isolation: isolate;
  contain: layout paint;
}

.gallery-camera {
  position: absolute;
  inset: 0;
  transform: scale(1);
  transform-style: preserve-3d;
  pointer-events: none;
}

.gallery-stage {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  pointer-events: none;
}
.gallery-orbit {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  pointer-events: none;
}
.card-position {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  pointer-events: none;
}
.card-drift {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  pointer-events: none;
}
.card-plane {
  position: absolute;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  left: -50vw;
  top: -50vh;
  top: -50dvh;
  background: #111;
  color: #efefec;
  cursor: pointer;
  outline: none;
  backface-visibility: hidden;
  pointer-events: auto;
}

.card-outline {
  position: absolute;
  border: solid rgba(241, 241, 236, 0.9);
  pointer-events: none;
  transition: border-color 0.2s;
}
.card-plane:hover .card-outline,
.card-plane:focus-visible .card-outline {
  border-color: #fff;
}

/* The reference answers hover through the artwork, not an extra UI frame.
   Keep placement/clip geometry unchanged; only the inner composition breathes. */
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .card-plane :deep(.card-visual) {
    transition: transform 0.6s cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  [data-phase='gallery'] .card-plane:hover :deep(.card-visual),
  [data-phase='gallery'] .card-plane:focus-visible :deep(.card-visual) {
    transform: scale(1.025);
  }
}

.card-label {
  position: absolute;
  padding: 22px 26px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: clamp(24px, 3vw, 44px);
  letter-spacing: 0.1em;
  pointer-events: none;
}

.card-label span:last-child {
  font-size: 0.6em;
}

.center-title {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 10;
  width: 90%;
  text-align: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
  /*
    ⚠️ 这里**没有** `transition: opacity`，也不能写 `opacity: 0`。
    render() 每帧把 opacity 写进内联样式（它是随 state.focus 走的轨道值），
    内联样式本来就赢过样式表 —— 于是任何 CSS 的 opacity 声明都是死规则；
    而 0.4s 的 transition 会给逐帧写入再叠一层阻尼，让标题的淡出比补间
    本身慢半拍。整个 opacity 只有一个写入者：render()。
  */
}

.center-title h1 {
  margin: 0;
  font-weight: 400;
  font-size: clamp(32px, 5.3vw, 82px);
  line-height: 1.1;
  letter-spacing: -0.045em;
}

.center-title p {
  margin: 18px 0 0;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: #aaa;
}

/*
  已删除：这里原本有三条 `[data-phase=...] .center-title { opacity: 0 }`。
  它们从来没生效过 —— render() 每帧写内联 opacity，内联样式赢过样式表。
  留着只会让人以为「标题的隐去归 CSS 管」，从而出现第二个写入者。
*/

/* 角落控件。纯白、无框：之前的胶囊描边是唯一暴露「这是界面控件」的东西，
   而它读起来像是浮在构图之上的一个盒子，而不是构图的一部分。
   改用在黑色房间上加一层柔和投影来保证可读性。 */
.index-button {
  position: fixed;
  top: 20px;
  right: 28px;
  z-index: 80;
  padding: 8px 10px;
  background: none;
  border: 0;
  border-radius: 0;
  color: #fff;
  font: inherit;
  font-size: 22px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.2em;
  cursor: pointer;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.7);
  transition: opacity 0.2s ease;
  /* 卡片落位之后，UI 才从下方 8px 浮上来。
     fill-mode 必须是 backwards 而不是 forwards/both：动画结束后要回到自然样式，
     否则 opacity 会被动画锁死在 1，下面的 :hover 过渡就永远失效了。 */
  animation: ui-rise 0.6s cubic-bezier(0.215, 0.61, 0.355, 1) 0.2s backwards;
}

.index-button:hover,
.index-button:focus-visible {
  opacity: 0.6;
  outline: none;
}

.deck-controls {
  position: fixed;
  z-index: 80;
  bottom: 26px;
  right: 30px;
  display: flex;
  align-items: center;
  gap: 16px;
  pointer-events: none;
  /* 与 .index-button 同一套「浮上来」节奏，见上方的 fill-mode 说明 */
  animation: ui-rise 0.6s cubic-bezier(0.215, 0.61, 0.355, 1) 0.2s backwards;
}

/* 角落 UI 的出现：只做「轻微上移 + 渐显」，不放大、不旋转、不弹跳 */
@keyframes ui-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.deck-control {
  pointer-events: auto;
  padding: 4px 8px;
  background: none;
  border: 0;
  color: #fff;
  font: inherit;
  font-size: 34px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.7);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.deck-control:hover,
.deck-control:focus-visible {
  opacity: 0.6;
  outline: none;
}

.deck-control:active {
  transform: scale(0.9);
}

.deck-counter {
  font-size: 16px;
  letter-spacing: 0.22em;
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.7);
}

/* --- 章节索引面板 -------------------------------------------------------
   铺满全屏的六张卡列表。非当前行用低透明度的纯白，
   这样当前项自然读作「选中」，而无需引入第二种色相。 */
.index-panel {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(0, 0, 0, 0.8);
  -webkit-backdrop-filter: blur(40px);
  backdrop-filter: blur(40px);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: clamp(72px, 12vh, 140px) clamp(28px, 8vw, 128px);
  overflow-y: auto;
  align-items: safe center;
  color: #fff;
}
.index-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 1.4vh, 18px);
}
.index-list li {
  overflow: hidden;
  padding-right: 48px;
  font-size: clamp(34px, 6vw, 82px);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.04em;
  opacity: 0.6;
  color: #fff;
  cursor: pointer;
  outline: none;
  transition: opacity 0.5s ease;
}
.index-row {
  display: flex;
  align-items: baseline;
  gap: clamp(12px, 1.6vw, 22px);
  translate: 0 0;
  transition: translate 0.5s cubic-bezier(0.215, 0.61, 0.355, 1);
}
.index-list li.active {
  opacity: 1;
}
@media (hover: hover) and (pointer: fine) {
  .index-list:has(:where(li:hover, li:focus-visible)) li {
    opacity: 0.3;
  }
  .index-list li:hover,
  .index-list li:focus-visible {
    opacity: 1;
  }
  .index-list li:hover .index-row,
  .index-list li:focus-visible .index-row {
    translate: 40px 0;
  }
  .index-list:has(li:hover) li:not(:hover) {
    opacity: 0.3;
  }
  .index-list:has(li:hover) li:not(:hover) .index-row {
    translate: 0 0;
  }
}
.index-number {
  font-size: 0.28em;
  font-weight: 400;
  letter-spacing: 0.12em;
  min-width: 2.4em;
}
/* 英文名保留在 DOM 里供浏览器翻译，但不绘制出来。
   用 sr-only 而不是 display:none，这样翻译引擎仍能索引到这段文本。 */
.index-title {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.index-close {
  position: absolute;
  top: clamp(20px, 3vh, 32px);
  right: clamp(20px, 4vw, 40px);
  background: transparent;
  border: 0;
  color: #fff;
  font: inherit;
  font-size: 16px;
  letter-spacing: normal;
  padding: 10px 14px;
  cursor: pointer;
  outline: none;
  transition: opacity 0.2s ease;
}
.index-close:hover,
.index-close:focus-visible {
  opacity: 0.6;
}

@media (max-width: 900px) {
  .center-title h1 {
    font-size: 8vw;
  }
  .center-title p {
    font-size: 11px;
    margin-top: 12px;
  }
  .index-button {
    top: 14px;
    right: 18px;
    font-size: 18px;
  }
  .deck-controls {
    right: 18px;
    bottom: 20px;
    gap: 12px;
  }
  .deck-control {
    font-size: 28px;
  }
  .deck-counter {
    font-size: 13px;
  }
}

/* 横屏手机：现在圆环已经变宽了（见 galleryMotion.ts 的 isShort），
   但标题依然会喧宾夺主，除非把它缩小并让它避开轨道。
   同时补上顶部安全区内边距，好让「索引」按钮避开状态栏。 */
@media (max-height: 520px) and (orientation: landscape) {
  .center-title {
    top: auto;
    bottom: clamp(64px, 18vh, 84px);
    transform: translate(-50%, 0);
  }
  .center-title h1 {
    font-size: clamp(22px, 5.2vw, 34px);
  }
  .center-title p {
    font-size: 10px;
    margin-top: 4px;
    letter-spacing: 0.06em;
  }
  .index-button {
    top: max(10px, env(safe-area-inset-top));
    font-size: 16px;
  }
  .deck-controls {
    bottom: max(14px, calc(10px + env(safe-area-inset-bottom)));
  }
}

@media (pointer: coarse) {
  .index-list li {
    min-height: 44px;
  }
}

/* 手机端控件需要真正的 44px 触控目标，以及安全区间距。 */
@media (pointer: coarse) {
  .index-button {
    min-width: 44px;
    min-height: 44px;
  }
  .deck-control {
    min-width: 44px;
    min-height: 44px;
  }
  .deck-controls {
    bottom: max(20px, calc(16px + env(safe-area-inset-bottom)));
  }
}

@media (max-width: 600px) {
  .center-title h1 {
    font-size: min(5.4vw, 9vh);
  }
  .center-title p {
    font-size: 10px;
    margin-top: 8px;
  }
}

/* reduced-motion：角落 UI 直接就位，不做上浮。
   ui-rise 用的是 backwards，取消动画后元素回落到自然样式（opacity 1），
   所以这里不需要再补 opacity/transform，只关掉动画即可。 */
@media (prefers-reduced-motion: reduce) {
  .index-button,
  .deck-controls {
    animation: none;
  }
  .index-list li,
  .index-row {
    transition: none;
  }
}
</style>
