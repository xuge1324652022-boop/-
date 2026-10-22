<template>
  <div ref="rootRef" class="cview">
    <!--
      首屏：黑底「指针轨迹」素材场。
      居中的巨型「调色 / COLOR GRADING」是唯一的参照框；清单里的成片潜伏在它周围与四角，
      **静止时完全不可见**。指针 = 搅动水面：波心带惯性追指针，环形波肩随波心
      铺开，落入波峰的素材次第涌出，掠过后依次回落隐去。

      它是文档流里的第一个 section；底边进度条先消费滚轮 / 触摸位移，
      推满后一次放行。键盘、锚点与滚动条保留浏览器原生行为。

      `data-reveal` 让它走页面那套**遮罩揭示**做入场：加载幕一撤、观察器建
      起来，标题两行就从各自的行高下方升上来（复用页面级的那套类名，
      不在这里另写一份 —— 同一套手势不能有两把尺子）。
      ⚠️ 首屏的揭示行数**就是 2**（cn + en）—— 短句与交互提示都是静止元素，
         不再包一层 `.cview__mask`（多一行会改掉首屏的入场节奏，
         verify-color-page.cjs 的 `lineTy.length === 2` 也钉着这个数）。
    -->
    <section
      ref="introRef"
      class="cv-intro"
      data-reveal
      :data-cursor="!routeCurtainActive && !covered ? 'Explore' : undefined"
      data-cursor-zh="预览"
      data-cursor-en="Explore"
      data-cursor-action="preview"
    >
      <ColorWave :clips="PREVIEWS" :active="!routeCurtainActive && !covered">
        <span class="cview__mask cv-intro__cn">
          <span class="cview__line" :style="lineStyle(0)">调色</span>
        </span>
        <span class="cview__mask cv-intro__en">
          <span class="cview__line" :style="lineStyle(1)">COLOR GRADING</span>
        </span>
      </ColorWave>

      <!--
        左下角两行小字，构成一组层级：上面是「手记」的口吻（一句主张），
        下面是操作提示（怎么做）。字号 / 字距 / 亮度三档拉开 —— 12px .2em
        rgba(.72) → 11px .24em rgba(.5)，读者一眼知道哪句是话、哪句是操作。
      -->
      <p class="cv-intro__tagline">在光与影之间，确定情绪</p>
      <p class="cv-intro__hint">
        <span class="cv-intro__hint-text cv-intro__hint-text--fine">移动指针，预览影像</span>
        <span class="cv-intro__hint-text cv-intro__hint-text--coarse">滑动，探索影像</span>
      </p>

      <!--
        贴底边框的进度条：成片的主色按清单数量横排成一条轨道，白色亮条从左往右
        推进，端点那道短竖线跟着走。
        ⚠️ 它同时是**闸门**：白条没推到最右端之前页面原地不动，推满才放行。
      -->
      <div
        class="cview__progress"
        :style="{ '--p': progressShown.toFixed(4), '--clip-count': CLIP_COUNT }"
        role="progressbar"
        :aria-valuenow="Math.round(progressShown * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="离开首屏的进度"
      >
        <span class="cview__progress-face" :style="{ backgroundImage: trackFace }" />
        <span class="cview__progress-arc" />
        <span class="cview__progress-head" />
      </div>
      <p class="cview__progress-label">
        {{ String(progressIndex).padStart(2, '0') }} / {{ CLIP_COUNT }}
      </p>
    </section>

    <!--
      开篇：巨型标题继续用原有两行遮罩，双语介绍交给共享的真实行遮罩。
      ⚠️ 这里**不再重复首屏的「COLOR / 调色」**：首屏已经把章名说完了，
         再说一遍就是同一句话看到两次（用户 2026-10-09 点名）。所以这一屏
         改成两行主张 —— 「让画面拥有 / 自己的情绪。」，副行接明暗、冷暖
         与镜头一致性。
      导语不再走 `data-reveal`，否则外层观察器和共享组件会同时驱动入场。
    -->
    <section id="intro" class="cview__hero">
      <h1 class="cview__hero-title" data-reveal>
        <span class="cview__mask"
          ><span class="cview__line" :style="lineStyle(0)">让画面拥有</span></span
        >
        <span class="cview__mask"
          ><span class="cview__line" :style="lineStyle(1)">自己的情绪</span></span
        >
      </h1>
      <ReferenceIntroduction
        class="cview__hero-sub"
        :text="COLOR_INTRO"
        :label="INTRO_LABEL"
        :active="!covered && !overlayActive && !isTransitioning"
      />
    </section>

    <!-- 清单中的全部成片：视频随滚动淡入 + 播放，滚出视口暂停并归零 -->
    <section
      v-for="(clip, i) in CLIPS"
      :id="`clip-${clip.n}`"
      :key="clip.n"
      class="cview__block"
      :class="`cview__block--${i % 2 === 0 ? 'left' : 'right'}`"
      data-reveal
    >
      <figure class="cview__media">
        <video
          class="cview__video"
          :data-clip="clip.n"
          :data-src="clip.src"
          :data-poster="`/color-previews/clip-${clip.n}.jpg`"
          muted
          loop
          playsinline
          webkit-playsinline
          preload="none"
          :aria-label="`调色成片 ${clip.n}`"
        />
        <button
          v-if="blockedVideos.has(clip.n)"
          type="button"
          class="cview__play"
          :aria-label="`播放调色成片 ${clip.n}`"
          @click="retryVideo($event)"
        >
          <span aria-hidden="true">▷</span> 播放影像
        </button>
        <figcaption class="cview__index">{{ String(clip.n).padStart(2, '0') }}</figcaption>
      </figure>

      <div class="cview__caption">
        <span class="cview__mask"
          ><span class="cview__line" :style="lineStyle(0)">{{ clip.title }}</span></span
        >
        <span class="cview__mask"
          ><span class="cview__line" :style="lineStyle(1)">{{ clip.en }}</span></span
        >
        <span class="cview__mask"
          ><span class="cview__line" :style="lineStyle(2)">{{ clip.note }}</span></span
        >
      </div>
    </section>

    <!--
      收尾：三条创作理念（原「参数表」已撤，见 data/colorPage.ts 的 NOTES 注释）。
      结构与前一版一致：两行标题 + 逐条错峰揭示，`--i` 就是第几条。

      `id="params"` 保留为原有锚点，截图脚本仍按 `#params` 定位。
    -->
    <section id="params" class="cview__outro" data-reveal>
      <h2 class="cview__outro-title">
        <span class="cview__mask"><span class="cview__line" :style="lineStyle(0)">理念</span></span>
        <span class="cview__mask"
          ><span class="cview__line" :style="lineStyle(1)">METHOD</span></span
        >
      </h2>
      <dl class="cview__notes">
        <div v-for="(row, i) in NOTES" :key="row.k" class="cview__note">
          <dt class="cview__note-term">
            <span class="cview__mask"
              ><span class="cview__line" :style="lineStyle(i)">{{ row.k }}</span></span
            >
          </dt>
          <dd class="cview__note-body">
            <span class="cview__mask"
              ><span class="cview__line" :style="lineStyle(i)" lang="zh">{{ row.v }}</span></span
            >
            <span class="cview__mask cview__note-translation"
              ><span class="cview__line" :style="lineStyle(i)" lang="en">{{ row.en }}</span></span
            >
          </dd>
        </div>
      </dl>
    </section>
    <WorkContinuation next="photo" />
  </div>
</template>

<script setup lang="ts">
/**
 * /color 的三条独立控制线：文字只揭示一次、媒体随可见性暂停恢复、首屏进度闸门一次放行。
 * 预览场使用 640px 轻视频；正文才按需装载 /color/ 的 1080p 成片，避免入场时集中解码。
 * 媒体资源与所有监听在 onBeforeUnmount 统一释放，不能等模板 ref 已清空后再找 video。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import WorkContinuation from '../components/WorkContinuation.vue'
import ReferenceIntroduction from '../components/ReferenceIntroduction.vue'
import { referenceIntroductionGate } from '../components/ReferenceIntroduction'
import ColorWave from '../components/color/ColorWave.vue'
import {
  CLIPS,
  CLIP_COUNT,
  PREVIEWS,
  COLOR_INTRO,
  INTRO_LABEL,
  NOTES,
  COLOR_TRACK_FACE as trackFace,
} from '../data/colorPage'
import { attachLoopFade } from '../composables/useLoopFade'
import { useSmoothScroll } from '../composables/useSmoothScroll'
import {
  COLOR_PAGE_ID,
  isTransitioning,
  jumpTarget,
  markSubpageVisit,
  overlayActive,
} from '../composables/useTransition'
import { routeCurtainActive, routeCurtainBlocked } from '../composables/usePageCurtain'

/** 错峰延迟：同组第 n 行晚 n × stagger 出现 */
function lineStyle(i: number): Record<string, string> {
  return { '--i': String(i) }
}

/** 减少动态效果：正文文字直接揭示、首屏不拦滚动、视频保留静帧而不自动播放。 */
const mediaMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
let reduceMotion = mediaMotionQuery.matches

const rootRef = ref<HTMLElement | null>(null)
let textObserver: IntersectionObserver | null = null
let videoObserver: IntersectionObserver | null = null
let videoWarmObserver: IntersectionObserver | null = null
let mediaOverlayObserver: MutationObserver | null = null
let bodyVideos: HTMLVideoElement[] = []
const nearbyVideos = new Set<HTMLVideoElement>()
const visibleVideos = new Set<HTMLVideoElement>()
// 内置浏览器可拒绝静音自动播放；保留海报，并给同一播放器真实的点击播放入口。
const blockedVideos = ref(new Set<number>())
const pendingPlays = new Map<HTMLVideoElement, symbol>()
let observersStarted = false
let disposed = false
/** 全部成片的循环接缝清理函数，卸载时统一执行 */
const loopFadeOffs = new Map<HTMLVideoElement, () => void>()
/** 持续同步遮罩门禁；返回页面或取消转场时仍可恢复可见成片 */
let stopCoverWatch: (() => void) | null = null

/*
 * 留下面包屑。画廊靠它把「刷新 /」和「从子页后退回来」分开 ——
 * 写规范卡号 '03'，让画廊与路径集中表分工；以后改专属页 URL 无需改恢复算法。
 */
markSubpageVisit(COLOR_PAGE_ID)

/*
 * 全局弧形遮罩开始揭幕时才建立观察器，避免首屏在覆盖阶段提前播完。
 * 否则首屏元素在幕布背后就已经「进视口」，
 * 整段遮罩揭示（首屏那两行巨型标题也在内）在幕布底下演完，
 * 用户只看到一个到位的静态标题。
 */
const covered = computed(
  () =>
    routeCurtainBlocked.value || !!jumpTarget.value || overlayActive.value || isTransitioning.value,
)
provide(
  referenceIntroductionGate,
  computed(() => !covered.value && !overlayActive.value && !isTransitioning.value),
)

const introRef = ref<HTMLElement | null>(null)

/*
 * 底边进度条 = **闸门**（2026-09-27 起）。
 *
 * ⚠️ 它不再只是「滚到哪」的读数：白条没推到最右端之前，滚轮 / 触摸的位移
 *    会被闸门**整个吃下来喂给白条**，页面原地不动；推满（--p = 1）才放行
 *    往下滚。用户要的正是「只有当白条滑动到最右端时，页面才能继续向下滑动」。
 *
 * 两路来源取 max，各管一段，谁先到 1 谁说了算：
 *   - `gateFed` —— 闸门累计吃下的位移（滚轮 / 触摸）
 *   - `scrollP` —— 已经滚过的距离 ÷ 首屏高。程序化 scrollTo、锚点跳转、
 *     键盘、滚动条拖拽走的都是这条路：**闸门只吃滚轮和触摸，其余一律不拦**。
 * 取 max 而不是二选一，是因为两者会同时非零（放行之后页面才起步，此时
 * gateFed 已经满了），二选一必然有一边被抹掉。
 *
 * ⚠️ 放行是**一次性闩**（`gateOpen`）：推开就不再合上 —— 少了它，用户滚回
 *    顶部再往下会被重新锁住一次。但闩只管**放行**，不参与读数：白条显示多少
 *    仍然只看上面的 max() —— 所以喂满放行之后（gateFed 已经满）它停在满格，
 *    不会刚推满就归零。
 *
 * 用 offsetHeight 读取首屏的布局高度，避免把展示用 transform 的缩放混入闸门行程。
 */
/** 闸门累计吃下的位移（px） */
const gateFed = ref(0)
/** 放行闩 —— 见上 */
const gateOpen = ref(false)
/** 闸门之外的所有滚动方式换算出的进度（0..1） */
const scrollP = ref(0)
/** 喂满白条需要的累计位移 = 一趟首屏高：走完首屏才准离开首屏 */
const gateTravel = ref(1)

const progressP = computed(() =>
  Math.max(0, Math.min(1, Math.max(gateFed.value / gateTravel.value, scrollP.value))),
)

/*
 * 白条的**显示值**：阻尼追 `progressP`，不是直接抄它。
 *
 * 为什么必须多这一层：一次滚轮是 ~100px 的**离散**一格，走一趟首屏 800px
 * 的话一格就是条宽的 12% —— 白条会一格一格往前蹦，这正是用户说的
 * 「底边下滑不够丝滑」。加了这层之后，一次滚轮只是把目标推高一格，
 * 条自己滑过去；连续滚时它就是一条连续推进的亮条。
 *
 * 时间常数比页面阻尼（0.12）稍软一点：白条是「读数」，比页面滞后一拍更顺。
 * ⚠️ rAF 只在**没追上**的时候转：追平就停，指针 / 页面都静止时一个字节都不写
 *    （与首屏素材层同一条规矩 —— 静止不许有空转的动画）。
 * ⚠️ reduced-motion 不补间（与页面阻尼同一条规矩：用户说了别给我加动效）。
 */
const BAR_TAU = 0.16
/** 收敛阈值：差得比这更少就直接落到位，别让 rAF 空转。 */
const BAR_EPS = 0.0015
const progressShown = ref(0)
let barRaf = 0
let barLast = 0

/**
 * 底边白条的**阻尼追帧**：每帧把「显示进度」朝「真实进度」推进一步
 * （`1 − e^(−dt/τ)` 的指数收敛，与帧率无关）。
 * ⚠️ 收敛到 `BAR_EPS` 以内就直接吸附并**停掉 rAF** —— 静止零写入，
 *    不让一个 1px 的差值把循环永远转下去。
 */
function barFrame(now: number): void {
  barRaf = 0
  const dt = Math.min(Math.max((now - barLast) / 1000, 0), 0.1)
  barLast = now
  const to = progressP.value
  const next = progressShown.value + (to - progressShown.value) * (1 - Math.exp(-dt / BAR_TAU))
  if (Math.abs(to - next) < BAR_EPS) {
    progressShown.value = to
    return
  }
  progressShown.value = next
  barRaf = requestAnimationFrame(barFrame)
}

/** 把白条拉到当前进度：减少动态时瞬时对齐（不做阻尼），否则起一个追帧循环 */
function syncBar(): void {
  if (reduceMotion) {
    progressShown.value = progressP.value
    return
  }
  if (barRaf) return
  barLast = performance.now()
  barRaf = requestAnimationFrame(barFrame)
}

watch(progressP, syncBar, { immediate: true })

/** 当前离开到第几段。上限随清单变；跟显示值走，才和条画的一致。 */
const progressIndex = computed(() =>
  Math.max(1, Math.min(CLIP_COUNT, Math.floor(progressShown.value * CLIP_COUNT) + 1)),
)

/**
 * 闸门：**消费型**。给它一段位移（px），返回 true = 这段被它吃了、页面不动。
 *
 * 只吃**还没推开**的那一段；推满这一下**也吃掉** —— 否则 `useSmoothScroll`
 * 会把整段位移一次加到目标上，页面从 0 直接跳到底，守了一路的「不动」在
 * 这一帧破功。代价是推满之后要多拨一下才起步，比突然弹出去好得多。
 */
function feedGate(px: number): boolean {
  if (gateOpen.value) return false
  const travel = gateTravel.value
  gateFed.value = Math.max(0, Math.min(travel, gateFed.value + px))
  if (gateFed.value >= travel - 0.5) gateOpen.value = true
  return true
}

/**
 * 推进闸门进度：`scrollP` = 首屏滚过的比例（0..1），`gateTravel` 给 `feedGate` 用。
 * 锚点、键盘或历史恢复只要已实际移动页面，就不再重新吞掉后续触摸。
 */
function updateProgress(): void {
  const intro = introRef.value
  if (!intro) return
  const h = intro.offsetHeight || 1
  gateTravel.value = h
  scrollP.value = Math.max(0, Math.min(1, window.scrollY / h))
  // 键盘、锚点、历史恢复可原生离开首屏；一旦页面已实际移动，就不能在半屏
  // 或正文上重新吞掉触摸。正常闸门阶段页面始终为 0，不受此判断影响。
  if (window.scrollY > 1) gateOpen.value = true
}

/*
 * 触摸那一半的闸门。
 *
 * 原生惯性比任何手写实现都好，所以 `useSmoothScroll` 在粗指针下**直接不装**；
 * 但闸门两头都得有，否则手机上页面照旧一路滑到底、白条永远推不满。
 *
 * ⚠️ 只在闸门真的吃下这段位移时才 preventDefault：推满之后立刻松手，惯性
 *    滚动原样交回浏览器，一点都不改手感。（所以监听必须是 passive:false）
 * ⚠️ reduced-motion 一律不装 —— 和阻尼同一条规矩：用户说了「别动我的滚动」。
 */
let touchX = 0
let touchY = 0
let touchId: number | null = null
/** 记下触摸起点；`onTouchMove` 靠相邻两帧的差算出手势位移 */
function onTouchStart(e: TouchEvent): void {
  touchId = null
  if (
    e.touches.length !== 1 ||
    !(e.target instanceof Element) ||
    !introRef.value?.contains(e.target)
  )
    return
  // 内部控件及双指缩放保留浏览器行为；全局监听不应接管页面上的任意手势。
  if (
    e.target.closest('a, button, input, textarea, select, [contenteditable], [data-native-scroll]')
  )
    return
  const touch = e.touches[0]!
  touchId = touch.identifier
  touchX = touch.clientX
  touchY = touch.clientY
}
/**
 * 触摸移动：把相邻两帧的 Y 差交给闸门。
 * 只有闸门**真的吃下**这段位移才 `preventDefault` —— 推满后立刻松手，
 * 惯性滚动原样交回浏览器（所以监听必须是 `passive: false`）。
 */
function onTouchMove(e: TouchEvent): void {
  if (reduceMotion || touchId === null) return
  if (e.touches.length !== 1) {
    touchId = null
    return
  }
  const touch = Array.from(e.touches).find((item) => item.identifier === touchId)
  if (!touch) return
  const y = touch.clientY
  const dx = touchX - touch.clientX
  const dy = touchY - y // 手指往上划 = 想往下看 = 正
  touchX = touch.clientX
  touchY = y
  const html = document.documentElement
  if (
    !e.cancelable ||
    e.defaultPrevented ||
    Math.abs(dx) > Math.abs(dy) ||
    routeCurtainActive.value ||
    covered.value ||
    overlayActive.value ||
    isTransitioning.value ||
    html.classList.contains('has-subpage-index') ||
    html.classList.contains('no-scroll')
  )
    return
  if (feedGate(dy)) e.preventDefault()
}

/*
 * 平滑滚动（滚轮阻尼）。
 *
 * 使用现有 useSmoothScroll 为滚轮提供阻尼，不额外引入第二套滚动控制器。
 * 它只接管滚轮 —— 触屏、键盘、锚点跳转、滚动条拖拽全部交还浏览器，
 * reduced-motion 下更是完全不装。详见 composables/useSmoothScroll.ts。
 *
 * ⚠️ 闸门作为 `gate` 传进去：滚轮**只有一个主人**，闸门想吃滚轮位移就必须
 *    从它这里过。自己再挂一个 wheel 监听的话，两个监听都会 preventDefault，
 *    而且执行的先后顺序不归我们管。
 */
useSmoothScroll(feedGate)

/** 进入预热区才绑定地址；减少动态时仅绑定静态 poster，不启动解码。 */
function warmVideo(video: HTMLVideoElement): void {
  if (!video.hasAttribute('poster') && video.dataset.poster) video.poster = video.dataset.poster
  if (reduceMotion || video.hasAttribute('src') || !video.dataset.src) return
  video.preload = 'metadata'
  video.src = video.dataset.src
  video.load()
}

/** 临时遮挡仅暂停；真正离开可见区再归零，使索引关闭后能续播当前镜头。 */
function pauseVideo(video: HTMLVideoElement, rewind = false): void {
  pendingPlays.delete(video)
  if (!video.paused) video.pause()
  if (rewind && video.readyState > 0 && video.currentTime !== 0) video.currentTime = 0
}

function mediaAvailable(): boolean {
  return (
    !disposed &&
    !covered.value &&
    !routeCurtainActive.value &&
    document.visibilityState === 'visible' &&
    !document.documentElement.classList.contains('has-subpage-index')
  )
}

/** play 必须在点击处理栈内调用；等待 canplay 再调用会丢失 iOS 用户手势。 */
function playVideo(video: HTMLVideoElement): void {
  if (!mediaAvailable() || reduceMotion || !visibleVideos.has(video) || pendingPlays.has(video))
    return
  const attempt = Symbol()
  const clip = Number(video.dataset.clip)
  pendingPlays.set(video, attempt)
  video.muted = true
  const failed = (error: unknown): void => {
    if (pendingPlays.get(video) !== attempt) return
    pendingPlays.delete(video)
    // 暂停/离屏产生的 AbortError 不代表播放权限被拒绝，不能误显示重试按钮。
    if (
      !mediaAvailable() ||
      !visibleVideos.has(video) ||
      (error as { name?: string })?.name === 'AbortError'
    )
      return
    blockedVideos.value.add(clip)
  }
  try {
    void Promise.resolve(video.play()).then(() => {
      if (pendingPlays.get(video) !== attempt) return
      pendingPlays.delete(video)
      if (!mediaAvailable() || !visibleVideos.has(video)) {
        video.pause()
        return
      }
      blockedVideos.value.delete(clip)
    }, failed)
  } catch (error) {
    failed(error)
  }
}

function retryVideo(event: MouseEvent): void {
  const button = event.currentTarget as HTMLButtonElement | null
  const video = button?.closest('.cview__media')?.querySelector<HTMLVideoElement>('video')
  if (video) playVideo(video)
}

/** 已离开预热范围的完整成片不保留播放器缓冲，避免长页面积累十五个解码器。 */
function releaseVideo(video: HTMLVideoElement): void {
  pauseVideo(video, true)
  loopFadeOffs.get(video)?.()
  loopFadeOffs.delete(video)
  if (video.hasAttribute('src')) {
    video.removeAttribute('src')
    video.load()
  }
}

/** 几何可见性、全局幕布、浏览器标签页与索引菜单共同决定播放权限。 */
function syncBodyMedia(): void {
  if (disposed) return
  const available = mediaAvailable()
  for (const video of bodyVideos) {
    const visible = visibleVideos.has(video)
    if (available && nearbyVideos.has(video)) warmVideo(video)
    if (available && visible) {
      warmVideo(video)
      video.closest('.cview__media')?.classList.add('is-playing')
      if (reduceMotion) pauseVideo(video)
      else {
        if (!loopFadeOffs.has(video)) loopFadeOffs.set(video, attachLoopFade(video))
        if (video.paused && !blockedVideos.value.has(Number(video.dataset.clip))) playVideo(video)
      }
    } else {
      pauseVideo(video, !visible)
      if (!visible) video.closest('.cview__media')?.classList.remove('is-playing')
      if (!visible && !nearbyVideos.has(video)) releaseVideo(video)
    }
  }
}

function syncTouchGate(): void {
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
  if (!reduceMotion) {
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
  }
}

function onMediaMotionChange(): void {
  reduceMotion = mediaMotionQuery.matches
  if (reduceMotion) {
    blockedVideos.value.clear()
    if (barRaf) cancelAnimationFrame(barRaf)
    barRaf = 0
    progressShown.value = progressP.value
    rootRef.value
      ?.querySelectorAll<HTMLElement>('[data-reveal]')
      .forEach((group) => group.classList.add('is-revealed'))
    textObserver?.disconnect()
    textObserver = null
    for (const video of bodyVideos) pauseVideo(video)
    for (const off of loopFadeOffs.values()) off()
    loopFadeOffs.clear()
    // pause 事件异步派发；立即复原透明度，避免把循环接缝的半透明帧留成静帧。
    for (const video of bodyVideos) video.style.opacity = '1'
  }
  syncTouchGate()
  syncBodyMedia()
}

/**
 * 建观察器。**在加载幕撤掉之后**才调用 —— 幕布挡着的时候首屏元素在它背后
 * 就已经"进视口"了，那时候建起来等于开场即揭示，用户什么都看不到。
 */
function startObservers(): void {
  const root = rootRef.value
  if (!root || observersStarted || disposed) return
  observersStarted = true

  // ---- 文字：遮罩裁剪揭示 ----
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
  if (reduceMotion) {
    // 减少动态效果：直接停在揭示后的位置，不做位移过渡
    for (const g of groups) g.classList.add('is-revealed')
  } else {
    textObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('is-revealed')
          // 一次性：揭示过就不再观察，避免来回滚动时反复触发
          textObserver?.unobserve(e.target)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -12% 0px' },
    )
    for (const g of groups) textObserver.observe(g)
  }

  // 距视口 300px 提前装载 metadata / poster；实际可见 25% 后才允许播放。
  videoWarmObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement
        if (entry.isIntersecting) nearbyVideos.add(video)
        else nearbyVideos.delete(video)
      }
      syncBodyMedia()
    },
    { rootMargin: '300px 0px', threshold: 0 },
  )
  videoObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) visibleVideos.add(video)
        else visibleVideos.delete(video)
      }
      syncBodyMedia()
    },
    { threshold: [0, 0.25] },
  )
  for (const video of bodyVideos) {
    videoWarmObserver.observe(video)
    videoObserver.observe(video)
  }
}

onMounted(async () => {
  await nextTick()
  if (disposed) return
  bodyVideos = Array.from(rootRef.value?.querySelectorAll<HTMLVideoElement>('.cview__video') ?? [])
  // 直达和应用内跳转统一等待全局揭幕，已经放行时立即建立。
  stopCoverWatch = watch(
    [covered, routeCurtainActive],
    () => {
      if (!covered.value) startObservers()
      syncBodyMedia()
    },
    { immediate: true },
  )
  document.addEventListener('visibilitychange', syncBodyMedia)
  mediaOverlayObserver = new MutationObserver(syncBodyMedia)
  mediaOverlayObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  mediaMotionQuery.addEventListener('change', onMediaMotionChange)

  /*
   * 首屏离开进度：滚动、resize、以及进页面时各算一次。
   *
   * 自己再挂一个 scroll 监听是安全的 —— `useSmoothScroll` 只 preventDefault
   * 滚轮，位移仍然是浏览器原生滚动产生的，scroll 事件照常派发。
   */
  window.addEventListener('scroll', updateProgress, { passive: true })
  window.addEventListener('resize', updateProgress, { passive: true })
  updateProgress()

  // 触摸那一半的闸门（reduced-motion 不装，见上面的注释）
  syncTouchGate()
})

onBeforeUnmount(() => {
  disposed = true
  textObserver?.disconnect()
  videoObserver?.disconnect()
  videoWarmObserver?.disconnect()
  mediaOverlayObserver?.disconnect()
  mediaOverlayObserver = null
  textObserver = null
  videoObserver = null
  videoWarmObserver = null
  for (const video of bodyVideos) pauseVideo(video)
  for (const off of loopFadeOffs.values()) off()
  loopFadeOffs.clear()
  stopCoverWatch?.()
  stopCoverWatch = null
  window.removeEventListener('scroll', updateProgress)
  window.removeEventListener('resize', updateProgress)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('visibilitychange', syncBodyMedia)
  mediaMotionQuery.removeEventListener('change', onMediaMotionChange)
  if (barRaf) {
    cancelAnimationFrame(barRaf)
    barRaf = 0
  }
  // 在模板 ref 尚存在时移除地址并 load，停止未完成请求并释放解码器。
  for (const video of bodyVideos) {
    if (!video.hasAttribute('src')) continue
    video.removeAttribute('src')
    video.load()
  }
  bodyVideos = []
  nearbyVideos.clear()
  visibleVideos.clear()
  pendingPlays.clear()
  blockedVideos.value.clear()
})
</script>

<style scoped>
/*
  关键动画参数全部抽成变量，改手感只改这里。
  缓动沿用参考站实测的 cubic-bezier(0.215, 0.61, 0.355, 1)。
*/
.cview {
  --page-bg: #fff;
  --ink: #111;
  --ink-dim: rgba(17, 17, 17, 0.42);
  --hairline: rgba(17, 17, 17, 0.14);
  --reveal-duration: 0.9s;
  --reveal-ease: cubic-bezier(0.215, 0.61, 0.355, 1);
  --reveal-stagger: 90ms;
  --video-fade: 0.5s;

  position: relative;
  min-height: 100vh;
  background: var(--page-bg);
  color: var(--ink);
}

/* ---------- 首屏：黑底「邻近揭露」构图 ----------
   文档流正常排布；滚轮先经 useSmoothScroll 的 gate，进度推满后再滚向白底叙事。
   `overflow: hidden` 让被拨出来的素材滑到边缘时被裁掉，而不是撑出滚动条。 */
.cv-intro {
  position: relative;
  height: 100vh;
  height: 100dvh;
  /*
    ⚠️ 下限随视口让位：`min(520px, 100dvh)` 在常规竖屏/桌面仍保 520px，
    但在高度不足 520px 的视口（844×390 / 812×375 横屏手机）退回满屏高 ——
    否则底部进度闸门条、读数与两行提示会被推出视口之外，而闸门未推满前
    页面又滚不动，用户拖了半天看不到任何进度反馈。
  */
  min-height: min(520px, 100vh);
  min-height: min(520px, 100dvh);
  background: #0a0a0a;
  overflow: hidden;
}
/*
  居中的巨型标题 —— 整幅构图的**固定参照框**。
  只有两行（中文大字 + 拉丁小字），走的是页面那套遮罩揭示：
  `.cview__mask` / `.cview__line` 是 ColorView 自己的 scoped 样式，而插槽
  内容是在 ColorView 的作用域里编译的（带同一个 scopeId），所以这里不必
  再写一份揭示机制。居中由 ColorWave 的 `.cwave__type` 负责，这里只管字。
*/
.cv-intro__cn .cview__line {
  font-weight: 700;
  line-height: 0.92;
  letter-spacing: -0.03em;
  font-size: clamp(80px, 19vw, 300px);
  color: #fff;
}
.cv-intro__en .cview__line {
  /*
    这 10px 上边距是**有意的**：它让遮罩（`overflow: clip`，因此自己成 BFC，
    不会与子元素合并外边距）比行盒高 10px。静止偏移是 `translateY(100%)`
    ＝**行自身高度**，而行顶从遮罩顶算起还要加上这 10px —— 于是「行顶 =
    遮罩底」，整行刚好落在遮罩外。
    ⚠️ 所以 `maskH === lineH` 在本行**不成立**（40.7 vs 30.7），这不是 bug；
    验证脚本量的是「行顶 ≥ 遮罩底」，那个才是裁剪是否成立的判据。
  */
  margin-top: 10px;
  font-weight: 500;
  font-size: clamp(13px, 1.5vw, 20px);
  /* letterspacing 会在最后一个字后面也留一隙，把整行视觉上推左 —— 补回来 */
  letter-spacing: 0.52em;
  text-indent: 0.52em;
  color: rgba(255, 255, 255, 0.5);
}
/*
  左下角两行：主张 + 操作提示。

  首屏左下角是一组两行小字，靠字号 / 字距 / 亮度三档拉开层级：
    主张  12px · 0.2em  · rgba(255,255,255,.72)
    提示  11px · 0.24em · rgba(255,255,255,.50)
  z-index 2 与提示同级、且在 DOM 里更靠后 —— 两行都盖在标题之下（标题层
  是 z-index 30，见 ColorWave），与上一版提示的位置关系一致。
*/
.cv-intro__tagline {
  position: absolute;
  left: 32px;
  bottom: 52px;
  z-index: 2;
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.72);
  pointer-events: none;
}
.cv-intro__hint {
  position: absolute;
  left: 32px;
  bottom: 24px;
  z-index: 2;
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.24em;
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}
/*
  提示分**两版文案**：精细指针（桌面）说「移动指针」，粗指针（触屏）说
  「滑动」。默认只显示桌面那版 —— `(pointer: coarse)` 在桌面 Edge 上不成立，
  而窄屏不一定就是触屏（桌面把窗口拖窄也会命中 max-width），所以两个条件
  都要：`max-width: 900px` 管窄屏，`pointer: coarse` 管横屏手机 / 平板。
  ⚠️ 隐藏那一版用 `display: none` 而不是 `opacity: 0`：opacity 版仍占位，
    `.cv-intro__hint` 的矩形会按两行文本算，校验脚本量到的宽度就是假的。
*/
.cv-intro__hint-text--coarse {
  display: none;
}
@media (max-width: 900px), (pointer: coarse) {
  .cv-intro__hint-text--fine {
    display: none;
  }
  .cv-intro__hint-text--coarse {
    display: inline;
  }
}

/* ---------- 底边进度条（= 闸门） ----------
   成片的主色沿水平方向排成一条**贴着底边框的条**（⚠️ 不是色轮 ——
   2026-09-25 换成达芬奇色轮那一版被否掉了，退回这条；别再改回轮）。
   白色亮条从左往右推进，端点那道短竖线跟着走 —— **推满才放行**往下滚。

   ⚠️ 它是首屏唯一告诉用户「再往下就得先把它推满」的东西，所以 2026-09-27
      整体加重了一档（4px → 6px、亮条纯白带辉光、端点加粗挑出条外、读数提亮）
      —— 太细的话用户会以为页面卡住了，而不是以为自己在推一条进度。
   单写入者：JS 只写 `--p`，亮条宽度与端点位置全由 CSS 从它算出来。 */
.cview__progress {
  --p: 0;
  /* 条高：贴底边框的一条细线 —— 看得见、又不抢构图的上限就在 8px 上下 */
  --h: 6px;

  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  height: var(--h);
  /* 槽底：让「还没走到的那一段」也看得见，白条压上去才读得出进度 */
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

/* 轨道：成片主色横排（由 data/colorPage.ts 的 TRACK_COLORS 生成 linear-gradient），
   压暗当底 —— 亮条扫过去的地方才是「已读」 */
.cview__progress-face {
  position: absolute;
  inset: 0;
  opacity: 0.55;
}
/* 段间暗缝：每件成片一道，由清单数量决定间隔，末段让出 1px 给缝本身。
   z-index 1 —— 压在轨道之上、亮条之下，所以亮条是**连续的一条白**，
   缝只把底下的色段切开（写成默认层级会盖到亮条上，白条就成了一排格子）。 */
.cview__progress::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0 calc(100% / var(--clip-count) - 1px),
    rgba(10, 10, 10, 0.85) calc(100% / var(--clip-count) - 1px) calc(100% / var(--clip-count))
  );
}

/* 亮条：改 scaleX 而不是改 width —— 只动合成，不触发重排。
   ⚠️ `transform-origin` 必须钉在左端：默认 center 会让它从中间往两头长。
   辉光跟着 scaleX 一起缩，所以 p=0 时是「一条没有点亮的槽」，不是一块白斑。 */
.cview__progress-arc {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: #fff;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.45);
  transform: scaleX(var(--p));
  transform-origin: left center;
}

/* 端点：走在亮条的前沿，像播放头。挑出条外一截才像「头」而不是一段白 */
.cview__progress-head {
  position: absolute;
  top: 50%;
  left: calc(var(--p) * 100%);
  z-index: 3;
  width: 3px;
  height: calc(var(--h) + 10px);
  background: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.6);
  transform: translate(-50%, -50%);
}

/* 读数：压在条的上方，右端对齐 */
.cview__progress-label {
  position: absolute;
  right: 32px;
  /* 进度条的 --h 只在兄弟节点定义；不能继承其它组件的同名高度。 */
  bottom: 20px;
  z-index: 3;
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.82);
  pointer-events: none;
}

/* ---------- 遮罩揭示：静止态整行藏在遮罩下方 ---------- */
.cview__mask {
  display: block;
  /* clip 而不是 hidden：不会产生滚动条，也不需要额外的盒模型修正 */
  overflow: clip;
}
.cview__line {
  display: block;
  /* 位移的是**自身行高** —— 不是 opacity 淡入 + 上移的替代方案 */
  transform: translateY(100%);
  transition: transform var(--reveal-duration) var(--reveal-ease);
  transition-delay: calc(var(--i, 0) * var(--reveal-stagger));
}
.is-revealed .cview__line {
  transform: translateY(0);
}

/* ---------- 开篇 ---------- */
.cview__hero {
  display: flex;
  flex-direction: column;
  justify-content: center;
  /* 开篇按整屏构图，锚点跳转保留上方的呼吸间距。 */
  min-height: 100vh;
  padding: 0 32px 8vh;
  scroll-margin-top: 76px;
}
.cview__hero-title {
  margin: 0;
  font-weight: 400;
  line-height: 0.92;
  letter-spacing: -0.03em;
  /*
    ⚠️ 这一档是**按最长那行的字数**反推的，不是手感值。
    上一版标题是拉丁字母「COLOR」（5 字，约 0.66em/字 ⇒ 总宽 0.56W），
    17vw 放得下；换成汉字「自己的情绪。」（6 字，1em/字 ⇒ 总宽 ≈ 6F）之后，
    17vw 在**任何**视口都会超出正文宽度（需要 F ≤ (W−64)/6 ≈ 0.167W）——
    汉字会在 `.cview__mask` 里折成两行，两行标题就变成四行。
    14.5vw 是同时满足「1440 不折行」与「320 不折行」的那一档：
      320 → 46.4px（6 字 278px，正文宽 284px）
      1440 → 208.8px（6 字 1253px，正文宽 1376px）
      1920 起封顶 240px（6 字 1440px，正文宽 1856px）
    下界 36px 只为极窄屏兜底。改文案字数就要重算这一档。
  */
  font-size: clamp(36px, 14.5vw, 240px);
}
.cview__hero-sub {
  --reference-color: var(--ink);
  margin-top: clamp(54px, 10vh, 110px);
}

/* ---------- 成片区块 ---------- */
.cview__block {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(24px, 5vw, 72px);
  padding: clamp(48px, 9vh, 120px) 32px;
  border-top: 1px solid var(--hairline);
  scroll-margin-top: 76px;
}
.cview__block--right {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
}
.cview__block--right .cview__media {
  order: 2;
}
.cview__media {
  position: relative;
  margin: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #f2f2f0;
  /*
    滚动淡入淡出归**外层容器**管：静止态透明，进视口才淡入（约 0.5s）。
    不能写在 .cview__video 上 —— 那里是循环接缝的淡出（useLoopFade），
    同一个 opacity 被两套补间共写，表现为「视频时隐时现」。
  */
  opacity: 0;
  transition: opacity var(--video-fade) ease;
}
.cview__media.is-playing {
  opacity: 1;
}
.cview__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* opacity 不在这里写：默认 1，只在循环回绕时由 GSAP 短暂拉低 */
}
.cview__play {
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  background: rgba(0, 0, 0, 0.68);
  color: #fff;
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.cview__play span {
  font-size: 22px;
}
.cview__play:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 4px;
}
.cview__index {
  position: absolute;
  left: 14px;
  bottom: 10px;
  font-size: 11px;
  letter-spacing: 0.24em;
  color: #fff;
  mix-blend-mode: difference;
}
.cview__caption {
  font-size: clamp(14px, 1.5vw, 20px);
  line-height: 1.55;
}
.cview__caption > .cview__mask:first-child .cview__line {
  font-size: clamp(24px, 3.4vw, 52px);
  font-weight: 400;
  letter-spacing: -0.01em;
}
.cview__caption .cview__mask:nth-child(2) .cview__line {
  font-size: 11px;
  letter-spacing: 0.24em;
  color: var(--ink-dim);
}
.cview__caption .cview__mask:nth-child(3) .cview__line {
  margin-top: 14px;
  color: var(--ink-dim);
}

/* ---------- 收尾 ---------- */
.cview__outro {
  padding: clamp(56px, 12vh, 160px) 32px 12vh;
  border-top: 1px solid var(--hairline);
  scroll-margin-top: 76px;
}
.cview__outro-title {
  margin: 0 0 40px;
  font-weight: 700;
  line-height: 0.95;
  font-size: clamp(40px, 8vw, 120px);
  letter-spacing: -0.02em;
}
/* 三条理念沿用左右两列；英文在中文下方自然换行，不固定行高截断双语内容。 */
.cview__notes {
  margin: 0;
  max-width: 720px;
}
.cview__note {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 24px;
  /* 术语 12px 与主张 14px 不同号：按基线对齐，左边那列才不会吊在半空 */
  align-items: baseline;
  padding: 17px 0;
  border-bottom: 1px solid var(--hairline);
}
.cview__note-term .cview__line {
  font-size: 12px;
  letter-spacing: 0.18em;
  color: var(--ink);
}
.cview__note-body {
  /* dl 的 dd 默认 margin-inline-start: 40px，不清掉整列会右移 */
  margin: 0;
}
.cview__note-body .cview__line {
  font-size: 14px;
  line-height: 1.7;
  color: var(--ink-dim);
}
.cview__note-translation {
  margin-top: 5px;
}
.cview__note-translation .cview__line {
  font-size: 12px;
  line-height: 1.6;
}

/* ---------- 900px 断点：单列 ---------- */
@media (max-width: 900px) {
  .cview__hero {
    /* 移动端用 dvh：地址栏收放不会让首屏跳一下 */
    min-height: 100vh;
    min-height: 100dvh;
    padding: 0 18px 6vh;
  }
  .cv-intro__hint {
    left: 18px;
    bottom: 22px;
  }
  .cv-intro__tagline {
    left: 18px;
    bottom: 46px;
  }
  /* 窄屏改为上下排列，双语文案按真实内容撑高，保留原有逐条入场钩子。 */
  .cview__note {
    grid-template-columns: minmax(0, 1fr);
    gap: 5px;
    padding: 6px 0;
  }
  .cview__note-body > .cview__mask:first-child .cview__line {
    font-size: 13px;
  }
  /* 窄屏上 19vw 只有 74px，参照框会小得不成比例 —— 单独放大一档 */
  .cv-intro__cn .cview__line {
    font-size: clamp(76px, 27vw, 190px);
  }
  .cv-intro__en .cview__line {
    letter-spacing: 0.4em;
    text-indent: 0.4em;
  }
  .cview__block,
  .cview__block--right {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding: 40px 18px;
  }
  .cview__block--right .cview__media {
    order: 0;
  }
  .cview__outro {
    padding: 48px 18px 10vh;
  }
}

/* ---------- 减少动态效果：不做位移、不自动播放 ---------- */
@media (prefers-reduced-motion: reduce) {
  .cview__line {
    transform: none;
    transition: none;
  }
}
</style>
