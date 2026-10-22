<template>
  <!-- 素材层不截获命中；移动即预览的光标声明放在 ColorView 的真实 .cv-intro 舞台。 -->
  <div ref="rootEl" class="cwave">
    <!--
      标题层：构图归 CSS（父组件给的遮罩揭示 DOM），JS 只负责「整层轻微跟随
      指针」。用插槽而不是把标题写在这里 —— `.cview__mask` / `.cview__line`
      那套揭示样式是页面级的，复制一份到这里就成了两把尺子量同一个手势。
    -->
    <div ref="titleEl" class="cwave__type"><slot /></div>

    <!--
      全部成片常驻 DOM，媒体地址只在实际弹出时设置。静止时
      opacity 0、一个不播。它们**没有座位**：弹出位置 = 指针走过的地方，
      由 GSAP 写 transform；CSS 只管宽度、比例与「默认藏着」。
      弹出后**就地常驻**（参考站停留效果 —— 多张素材沿指针路径散落，
      形成「星座」般的视觉），直到指针离开视口 / 滚出首屏才整体收回。
    -->
    <!--
      两层是**刻意的**：外层只做定位（一次性、全程不动），揭示与缩放都在内层
       —— 参考站 brand.squarespace.com 06 Motion 章封面实测就是这个分工：
       `.homeCarouselMotionItem`（定位，transform 永远是一个纯平移矩阵）里
       套 `.frame__mask`（clip-path 揭示）→ `.frame__content`（scale）。
       合到一层做不到：clip-path 会跟着 transform 一起被缩放。
    -->
    <figure
      v-for="c in clips"
      :key="c.src"
      class="cwave__item"
    >
      <span class="cwave__mask">
        <span class="cwave__content">
          <video
            class="cwave__video"
            :data-src="c.previewSrc ?? c.src"
            :data-poster="c.poster"
            muted
            loop
            playsinline
            webkit-playsinline
            preload="none"
          />
        </span>
      </span>
    </figure>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'

/*
 * /color 首屏的「指针轨迹弹出」素材场。
 *
 * ── 这一版是什么 ──────────────────────────────────────────────────────────
 * 黑底 + 居中的巨型「调色 / COLOR」是一幅**静止的构图**，全量调色成片
 * 潜伏着，**静止时 opacity 0、完全看不见、一段都不播**。
 *
 * 指针 = 手指划过水面：每走过一小段路（SPAWN_DIST），就在**指针当时的位置**
 * 弹出下一段素材。划得快，素材就一路次第涌出；**弹出的片就地常驻**，多张
 * 素材沿指针走过的路径散落 —— 形成参考站那种「星座」般的停留效果（用户
 * 原话：「参考原站的停留效果」）。停下**不**自动平息，直到指针离开视口 /
 * 滚出首屏，onLeave / stopLive 才整体收回。全部素材按 `spawnSeq % els.length` 轮转
 * 使用（用完后从 `els[0]` 开始循环），保留后续确认的五片上限；第六片弹出时
 * 最旧一片走完整缩回动画，不按距离淘汰。
 *
 * ── 弹出动画 = 参考站实测值（2026-09-25 逐帧量，不要凭手感改）─────────────
 * 参考站 brand.squarespace.com 06 Motion 章封面，headless Edge 1440×810：
 *   · **落点 = 指针当时位置**（片心），零偏移、零延迟、无随机 —— 实测三片
 *     分别落在指针 (556,600) / (790,480) / (1024,360)，误差 0px。
 *   · **外层定位框全程不动**：transform 恒为 `matrix(1,0,0,1,x,y)`，
 *     没有位移补间、没有旋转、没有 opacity 动画（opacity 恒 1）。
 *   · **揭示 = clip-path 从中心一条短竖线展开**：起点是中心处高 2.61% 片高
 *     （上端 48.69% / 下端 51.31%）的**竖直**线段；四个角分别走向
 *     右上 / 右下 / 左下 / 左上 ⇒ 中间态是**斜向**矩形、边展开边转正。
 *     这就是「滑动」的观感来源，不是位移也不是淡入。
 *   · **内容 scale 0.7071 → 1**（1/√2），ease 拟合为 **power4.out**；
 *     时长从参考站实测的 1.0s 收到 **0.5s** —— 为跟手，详见 REVEAL_DUR 注释。
 *   · 节奏：匀速拖动下每 ~370~400ms 一片（≈ 每走 260~300px）。
 *   · 尺寸：全部片段**统一大尺寸**（`clamp(320px, 32vw, 520px)`）—— 已取消参考站
 *     「前 3 片 205px、其余 461px」的两档划分，统一成大尺寸读得清、铺得开。
 *
 * ⚠️ 上一版（已作废）做的是「从下方浮起 48px + back.out 回弹 + ±3~6° 倾斜
 *    回正 + opacity 0.16s 淡入」—— 与参考站**四项全不对**：参考站没有位移、
 *    没有回弹、没有旋转、没有淡入。改回那个方向前先看上面这组实测数字。
 *
 * ── 作废的方向（别再走回去）────────────────────────────────────────────────
 *   ① 椭圆轨道转盘；② 常驻桌面的视差漂移；③ 六片固定座位 + 波场揭露；
 *   ④ 按距离淘汰远处旧片（让光标附近只剩 1~2 张）—— ④ 与参考站背道而驰：
 *   参考站是多张素材**全部留下**形成星座，不是只留光标附近。把 ④ 当成
 *   「避免堆叠」会同时把参考站的停留效果砍掉。
 *
 * ── 四个必须守住的技术点 ───────────────────────────────────────────────────
 *   1. **事件驱动，没有 ticker**：弹出/退休都是 gsap 补间，静止时连一个
 *      setProperty 都不会发生（「静止零写入」靠没有循环来保证）。
 *   2. **单写入者（分层）**：每片拆三层，每层各一个写入者 ——
 *      外层 `.cwave__item` 的 opacity 只由 spawn.set 与 retire.to 写；
 *      中层 `.cwave__mask` 的 clip-path 只由 spawn 的 fromTo（开）与
 *      retire.to（合）写；内层 `.cwave__content` 的 scale 只由 spawn 的
 *      fromTo（涨）与 retire.to（缩）写。三层互不抢属性（揭示写开、退休写合）。
 *      标题层的跟随走 `gsap.quickTo`，写的是**另一个元素**（`.cwave__type`）。
 *   3. **确定性**：落点 = 指针当时位置（零偏移、零延迟、无随机），同一段
 *      素材的揭示轨迹恒定（clip-path 与 scale 都是 fromTo 定死的），所以
 *      同一条指针路径 ⇒ 同一组视觉结果，测试可复现；不要用 Math.random()。
 *   4. **两把尺子**：指针给的是**视口**坐标，写进 GSAP 的是 `.cwave`
 *      **局部**坐标，必须先减掉 rootEl 的 left / top（见 spawn()）。首屏
 *      一滚两者就差一个 scrollY，直接用 clientY 当局部 y 会让素材整体
 *      偏上；钳位同理要用首屏尺寸而不是 `window.inner*`。
 *
 * ── reduced-motion ───────────────────────────────────────────────────────
 * 整套机制**完全不注册**：不听指针、不建观察器。全部片段在 CSS 里就是
 * opacity 0，于是只剩那幅静态标题构图。
 */

interface WaveClip {
  src: string
  previewSrc?: string
  poster?: string
}

const props = withDefaults(defineProps<{ clips: readonly WaveClip[]; active?: boolean }>(), { active: true })

/*
 * 指针每累计走过这么远（px），弹出下一片。
 * ⚠️ 参考站的「停留效果」是把多张素材沿指针走过的路径散落、形成星座般的
 *    视觉 —— 弹出后**原地常驻**（不淡出、不被淘汰），直到指针离屏 / 滚出首屏。
 *    这就要求间距够密：80px（触屏 56，约 0.7×）让一次横扫能堆出多张素材。
 *    此前为追求「丝滑」收到 80、随后为了「消除重叠」改回 280 + region eviction，
 *    结果 reference 那种「多张分散」的效果被砍到只剩 1~2 张 —— 与参考站背道而驰。
 *    改这个值前先想清楚：它和 verify-color-page.cjs 的 SPAWN_DIST 是同一组数
 *    （故意抄两份互卡）。
 */
const SPAWN_DIST = 80
const SPAWN_DIST_TOUCH = 56
/**
 * 两次弹出之间的最小间隔（ms）。快速扫动时一个 pointermove 事件就能攒出
 * 几百 px —— 不限频的话一帧喷出六七片，FIFO 退休跟不上，「涟漪」变「泼水」。
 * 90ms 是快速扫动的硬上限（正常拖动由 SPAWN_DIST 间距主导，间隔很少触顶）。
 */
const MIN_SPAWN_INTERVAL = 90
/**
 * 在屏上限：**一次最多 5 片**（参考站 brand.squarespace.com 实测就是这个数，
 * 用户 2026-09-27 点名要回来）。第 6 片弹出时，**最旧的那片**让位。
 *
 * ⚠️ 让位 = 走**完整**的退休动画（`retire`，缩回去直到消失），不是直接抹掉
 *    —— 上限看起来应该是「旧的缩回去、新的涌出来」，而不是「旧的突然不见」。
 * ⚠️ 只淘汰**最旧**这一片（FIFO），**不按距离淘汰**：距离淘汰会把参考站的
 *    「停留效果」砍到只剩光标邻域 1~2 片（2026-09-25 试过，用户否掉了）。
 * ⚠️ 上限只管**在屏数量**，不管频率 —— 弹出间距 `SPAWN_DIST` / 限频
 *    `MIN_SPAWN_INTERVAL` 一个都不动（用户：刷新频率不变）。
 */
const MAX_ALIVE = 5
/** onLeave / stopLive 整体收回时，相邻两片错开的时间（s）。 */
const RETIRE_STAGGER = 0.07
/** 退休时长（s）：整体收回时统一退，也是 clip-path 收拢 + content 缩回的时长。 */
/** 退休时长：与揭示同长 —— 「反向」就该是同一段动画倒着放（原来 0.4s 偏短，
 *  加上 power4.in 的前段几乎不动，观感成了「等一下就没了」，不像有动画）。 */
const RETIRE_SLOW = 0.5
/**
 * 退休缓动：**power2.in**（加速收拢），不是 power4.in。
 *
 * ⚠️ 曾经严格镜像揭示的 power4.out 用 power4.in（t⁴）：t⁴ 的前 70% 几乎不动，
 *    「缩」全挤在最后 0.15s —— 配上同步淡出就成了「先淡掉、末尾才缩一下」，
 *    用户根本看不到「缩回去」这个过程（2026-09-27 反馈「反向缩进动画没有完成」）。
 *    t² 全程都在走，观感才真的是「一路缩没」。
 */
const RETIRE_EASE = 'power2.in'
/**
 * 淡出的**起点**（占退休时长的比例）：先缩、缩掉快一半了才开始淡。
 *
 * ⚠️ 淡出绝不能和缩回同时起步 —— 只要淡出比缩回快一点（旧版 power2.in 淡出
 *    vs power4.in 缩回），片会在缩到一半之前就透明，缩回的后半段等于演给
 *    空气看。把它推到尾段，观众才看得见整段「缩没」；淡出只是收尾，
 *    顺便保证退休结束时画面彻底干净、视频可以安全暂停。
 */
const RETIRE_FADE_AT = 0.55
/**
 * 退休终点的内容缩放 = **缩到 0**，素材一路缩没。
 *
 * ⚠️ 不是缩回揭示起点 `SCALE_FROM`(0.7071) 就停 —— 那样片还剩七成大小，
 *    剩下的「消失」全靠 opacity 淡出顶，观感是「收拢一下然后淡掉」，
 *    没有「缩回去直到消失」（用户 2026-09-27 原话）。缩到 0 之后，
 *    clip-path 收拢与 opacity 淡出只是陪衬，真正让人看见的是**缩**。
 */
const RETIRE_SCALE_TO = 0
/** 窄屏断点与标题幅度减半系数（与全站一致）。 */
const MOBILE_BP = 900
const MOBILE_AMP = 0.5

/** 标题层的跟随幅度（px，满偏转时）与时长。 */
const TITLE_AX = 110
const TITLE_AY = 70
const TITLE_DURATION = 0.8

/**
 * 弹出揭示时长（s）与缓动。
 * ⚠️ 参考站逐帧拟合是 power4.out / ≈ 1.0s，但那一版「慢揭」在本页显得脱节：
 * 指针已经划走、片还在慢慢张开，跟手感差。为跟手把时长收到 0.5s（缓动不变）。
 * 改这个值前先想清楚：它和 verify-color-page.cjs 的 REVEAL_DUR 是同一组数
 * （故意抄两份互卡）。
 */
const REVEAL_DUR = 0.5
const REVEAL_EASE = 'power4.out'
/** 揭示起手：中心一条高 2.61% 片心高的竖直线段（参考站实测）。 */
const CLIP_LINE = 'polygon(50% 48.69%, 50% 48.69%, 50% 51.31%, 50% 51.31%)'
/** 揭示收尾：全幅矩形。 */
const CLIP_FULL = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
/** 内容入场缩放起点（1/√2）—— 参考站实测 0.7071。 */
const SCALE_FROM = 0.7071

const rootEl = ref<HTMLElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)

let els: HTMLElement[] = []
let pointerActive = false
let inViewport = false
let mounted = false
/** 序号：弹出的总次数（决定下一片素材、偏移、倾斜、z 序）。 */
let spawnSeq = 0
/** 距离累加器：上次弹出后指针又走了多远。 */
let acc = 0
/** 上次弹出的时刻（ms，performance.now）—— 限频用。 */
let lastSpawnAt = 0
let lastX = 0
let lastY = 0
let hasLast = false
let touchPointerId: number | null = null
/** 当前在屏的片（按 spawnSeq 顺序）。sx/sy = 弹出时的视口坐标，onLeave / stopLive 靠它整体收回。 */
const alive: { el: HTMLElement; video: HTMLVideoElement | null; sx: number; sy: number }[] = []
let setters: { sx: gsap.QuickToFunc; sy: gsap.QuickToFunc } | null = null
let io: IntersectionObserver | null = null
let classObserver: MutationObserver | null = null
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

/** 是否按手机档处理（首屏弹出幅度、跟随系数都要按它缩放） */
function isMobile(): boolean {
  return window.innerWidth <= MOBILE_BP
}

/** 弹出一片：下一段素材在指针（加螺旋偏移）处涌出。 */
function spawn(x: number, y: number): void {
  if (!pointerActive || !els.length) return
  const i = spawnSeq++
  const el = els[i % els.length]
  const video = el.querySelector('video')
  const mask = el.querySelector<HTMLElement>('.cwave__mask')
  const content = el.querySelector<HTMLElement>('.cwave__content')

  /*
   * 在屏满了 → 最旧的那片让位（FIFO）。
   *
   * ⚠️ 必须在**本片的 killTweens / set 之前**：元素池由清单数量决定、按
   *    `spawnSeq % els.length` 轮转，池子转回来时「最旧的那片」有可能正好是本片 ——
   *    反过来做的话，退休补间会被本片随后的 `gsap.set(opacity: 1)` 顶掉，
   *    变成「原地重弹」而不是「旧的缩回去」。
   */
  /*
   * ⚠️ 坐标系换算（2026-09-25 修）：写进 GSAP 的 x / y 是 `.cwave` 的
   *    **局部**坐标，而指针给的 clientX / clientY 是**视口**坐标。首屏往上
   *    滚了 S 之后 `.cwave` 的原点就在视口的 -S 处，直接把 clientY 当局部
   *    y 用，素材会整体偏上 S 像素 —— 滚得越多偏得越多。必须先减掉
   *    rootEl 的 left / top，两把尺子才能对上。
   */
  const rect = rootEl.value?.getBoundingClientRect()
  const bw = rect?.width ?? window.innerWidth
  const bh = rect?.height ?? window.innerHeight
  const px = x - (rect?.left ?? 0)
  const py = y - (rect?.top ?? 0)

  /*
   * 落点钳进首屏：四边各留 20px 净距（「静止不许出血」推广到弹出态）。
   * ⚠️ 钳的是**首屏尺寸**而不是 `window.inner*` —— 裁剪由 `.cv-intro` 的
   *    `overflow: hidden` 完成，弹到首屏之外等于弹进一块看不见的区域，
   *    用户只看到「指针划过却没动静」。
   */
  const tw = el.offsetWidth
  const th = (tw * 9) / 16
  const mx = tw / 2 + 20
  const my = th / 2 + 20
  // 落点 = 指针当时位置（零偏移、零延迟、无随机 —— 参考站实测误差 0px）
  const cx = Math.min(Math.max(px, mx), bw - mx)
  const cy = Math.min(Math.max(py, my), bh - my)

  // Read geometry before retiring/promoting layers, avoiding a forced layout after writes.
  while (alive.length >= MAX_ALIVE) {
    const oldest = alive.shift()
    if (oldest && oldest.el !== el) retire(oldest)
  }

  // 同一段素材可能还在上一轮的退休补间里 —— 先杀掉，避免两个写入者打架
  gsap.killTweensOf(el)
  if (mask) gsap.killTweensOf(mask)
  if (content) gsap.killTweensOf(content)
  /*
   * 新片始终压在旧片上面，包括仍在缩回的退休层。不能按总次数取模：
   * 第 8 次回到 z=1 时，会被尚未退出的 z=4..7 盖住，看起来像漏了一次交互。
   * 每次弹出只对当前可见层重新编号；读取的是内联值，不测布局，且没有常驻循环。
   * 编号始终落在媒体池大小以内，标题仍在最上面，长时间交互也不会无限增大。
   */
  const visibleLayers = els
    .filter((layer) => layer !== el && layer.classList.contains('is-live'))
    .sort((a, b) => Number(a.style.zIndex) - Number(b.style.zIndex))
  visibleLayers.forEach((layer, index) => {
    const order = String(index + 1)
    if (layer.style.zIndex !== order) layer.style.zIndex = order
  })
  el.style.zIndex = String(visibleLayers.length + 1)
  el.classList.add('is-live')
  /*
   * 弹出 = 三件事，各自写**不同的元素**，互不抢 transform/opacity：
   *   ① 外层 `.cwave__item`：一次性定位（x/y + 居中），**全程不再补间**，
   *      没有位移补间、没有旋转、没有 opacity 缓动 —— 与参考站恒为纯平移矩阵一致。
   *   ② 中层 `.cwave__mask`：clip-path 从中心一条竖线展开到全幅，
   *      power4.out / 0.5s —— 「滑动」观感全在这里，不是位移也不是淡入。
   *   ③ 内层 `.cwave__content`：scale 0.7071 → 1（1/√2），同缓动同轨。
   * 之所以拆三层：clip-path 在 mask 上，scale 在 content 上 —— 合一层
   * 会让 clip 跟着 scale 一起被缩放（参考站实测同此分工）。
   */
  gsap.set(el, { x: cx, y: cy, xPercent: -50, yPercent: -50, opacity: 1 })
  if (mask) {
    gsap.fromTo(mask, { clipPath: CLIP_LINE }, { clipPath: CLIP_FULL, duration: REVEAL_DUR, ease: REVEAL_EASE })
  }
  if (content) {
    gsap.fromTo(content, { scale: SCALE_FROM }, { scale: 1, duration: REVEAL_DUR, ease: REVEAL_EASE })
  }

  if (video) {
    // Hidden videos have no src: no metadata burst or decoder work behind the curtain.
    if (!video.hasAttribute('src')) {
      if (video.dataset.poster) video.poster = video.dataset.poster
      if (video.dataset.src) video.src = video.dataset.src
    }
    if (video.currentTime > 0) video.currentTime = 0
    void video.play().catch(() => {})
  }

  /*
   * 在屏数受 `MAX_ALIVE` 管（满了就在函数头淘汰最旧的一片），但**不是**按
   * 距离淘汰 —— 参考站的「停留效果」要求素材就地常驻到被 newer 的挤走为止。
   * 全部素材用完后从 `els[0]` 开始轮转（spawnSeq % els.length），所以 alive 数组
   * 里的同一元素可能重复出现：先把旧的那条摘掉，再 push 新位置，
   * 否则 onLeave / stopLive 拿到过期引用。
   */
  const existingIdx = alive.findIndex((a) => a.el === el)
  if (existingIdx >= 0) alive.splice(existingIdx, 1)
  alive.push({ el, video, sx: x, sy: y })
}

/**
 * 退休一片 = 把弹出动画**原路反向拉回**，并且**一路缩到消失**：
 * 中层 clip-path 从全幅收拢回中心竖线、内层 content scale 从 1 一路缩到 0
 * （`RETIRE_SCALE_TO`，不是缩回揭示起点就停）、外层 opacity 同时淡到 0 ——
 * 像把刚弹出的片「拉」回去、缩没，而不是单纯淡出（那样只剩一抹均匀变暗，
 * 没有「收回」的观感）。三层各自仍只写一个元素，与揭示的写入者分工完全对称
 * （揭示写开、退休写合）。开始收拢就暂停并保留当前帧，完全隐藏后释放视频源。
 */
function retire(
  item: { el: HTMLElement; video: HTMLVideoElement | null },
  delay = 0,
  duration = RETIRE_SLOW,
): void {
  if (motionQuery.matches) { delay = 0; duration = 0 }
  const el = item.el
  const mask = el.querySelector<HTMLElement>('.cwave__mask')
  const content = el.querySelector<HTMLElement>('.cwave__content')
  // Keep the last decoded frame for the entire shrink animation. Retiring layers
  // must not keep decoding alongside the five live previews (previously up to 11).
  item.video?.pause()
  gsap.killTweensOf(el)
  if (mask) gsap.killTweensOf(mask)
  if (content) gsap.killTweensOf(content)
  // 中层：clip-path 收拢回中心竖线（揭示的反向）
  if (mask) {
    gsap.to(mask, { clipPath: CLIP_LINE, duration, delay, ease: RETIRE_EASE })
  }
  // 内层：content scale 一路缩到 0 —— 素材缩回去直到消失（不是缩回 0.7071 就停）
  if (content) {
    gsap.to(content, { scale: RETIRE_SCALE_TO, duration, delay, ease: RETIRE_EASE })
  }
  /*
   * 外层：opacity 淡到 0 —— 但**推到尾段**才起（RETIRE_FADE_AT），
   * 让前面的时间全留给「缩」，完全透明后再安全释放媒体资源。
   */
  gsap.to(el, {
    opacity: 0,
    duration: duration * (1 - RETIRE_FADE_AT),
    delay: delay + duration * RETIRE_FADE_AT,
    ease: 'power2.in',
    overwrite: true,
    // 下一次复用时从轻量视频首帧重新开始，不保留隐藏的解码器。
    onComplete: () => {
      el.classList.remove('is-live')
      // Once fully hidden, release decoder/buffer resources rather than retaining
      // all 15 players after one pointer sweep. The small preview stays in HTTP cache.
      if (item.video?.hasAttribute('src')) {
        item.video.removeAttribute('src')
        item.video.load()
      }
    },
  })
}

/** 水面平息：在屏的片从最旧开始依次退场。 */
function retireAll(): void {
  const items = alive.splice(0)
  items.forEach((item, k) => retire(item, k * RETIRE_STAGGER))
}

/** 一次触摸是一条独立轨迹；抬手、系统取消或双指缩放都断开它。 */
function resetTrail(): void {
  touchPointerId = null
  hasLast = false
  acc = 0
}

function onPointerDown(e: PointerEvent): void {
  if (e.pointerType !== 'touch') return
  // 第二根手指属于原生缩放手势，不能把两根手指的位置连成预览轨迹。
  resetTrail()
  if (!pointerActive || !e.isPrimary || !insideField(e.clientX, e.clientY)) return
  if (e.target instanceof Element && e.target.closest('a, button, input, textarea, select, [contenteditable]')) return
  touchPointerId = e.pointerId
  lastX = e.clientX
  lastY = e.clientY
  hasLast = true
}

function onPointerEnd(e: PointerEvent): void {
  if (e.pointerType === 'touch' && e.pointerId === touchPointerId) resetTrail()
}

function insideField(x: number, y: number): boolean {
  const rect = rootEl.value?.getBoundingClientRect()
  return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

/** 标题 quickTo 跟随与距离弹片只接收舞台内的主指轨迹。 */
function onMove(e: PointerEvent): void {
  if (!pointerActive) return
  if (e.pointerType === 'touch' && e.pointerId !== touchPointerId) return
  if (!insideField(e.clientX, e.clientY)) { onLeave(); return }
  const amp = isMobile() ? MOBILE_AMP : 1
  // 标题层跟随（整层，轻度）
  const nx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1))
  const ny = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1))
  setters?.sx(nx * TITLE_AX * amp)
  setters?.sy(ny * TITLE_AY * amp)

  // 轨迹累计：走了 SPAWN_DIST 就弹出下一片 —— 但要过限频闸门，
  // 一次事件最多弹一片。累加器最多存一格：快速扫动攒下的余量**不欠账**，
  // 否则指针停下后事件微动还会把存量慢慢吐完 —— 在原地弹成一摞。
  if (hasLast) {
    acc += Math.hypot(e.clientX - lastX, e.clientY - lastY)
    const dist = e.pointerType === 'touch' ? SPAWN_DIST_TOUCH : SPAWN_DIST
    const now = performance.now()
    if (acc >= dist && now - lastSpawnAt >= MIN_SPAWN_INTERVAL) {
      spawn(e.clientX, e.clientY)
      acc = 0
      lastSpawnAt = now
    } else if (acc > dist) {
      acc = dist
    }
  }
  lastX = e.clientX
  lastY = e.clientY
  hasLast = true
}

/** 指针离开视口：水面立即平息，标题回基线。 */
function onLeave(): void {
  if (!mounted) return
  resetTrail()
  retireAll()
  if (motionQuery.matches && titleEl.value) {
    setters?.sx.tween.pause()
    setters?.sy.tween.pause()
    gsap.set(titleEl.value, { x: 0, y: 0 })
  } else {
    setters?.sx(0)
    setters?.sy(0)
  }
}

/** 滚出首屏：平息 + 停用（弹出与跟随都停）。滚回时重置累加器，不会爆发。 */
function stopLive(): void {
  if (!pointerActive) return
  pointerActive = false
  onLeave()
}

/**
 * 开始采集（首屏进入视口时调用）。`acc = 0` / `hasLast = false` 是必须的重置：
 * 上一次滚出首屏时累加器停在半路，不清零的话滚回来会一次性弹出好几片。
 */
function startLive(): void {
  if (pointerActive) return
  pointerActive = true
  acc = 0
  hasLast = false
}

/** Geometry alone cannot see a route curtain, the index overlay or a hidden tab. */
function syncLive(): void {
  if (!mounted) return
  if (props.active && inViewport && !motionQuery.matches && !document.hidden &&
      !document.documentElement.classList.contains('has-subpage-index')) startLive()
  else stopLive()
}

watch(() => props.active, syncLive)

function setupField(): void {
  if (mounted) return
  mounted = true
  els = Array.from(rootEl.value?.querySelectorAll<HTMLElement>('.cwave__item') ?? [])
  if (!els.length) return

  if (titleEl.value) {
    // 当前标题层仍为 30；素材池将来扩容时也不会越过标题。
    titleEl.value.style.zIndex = String(Math.max(30, els.length + 1))
    setters = {
      sx: gsap.quickTo(titleEl.value, 'x', { duration: TITLE_DURATION, ease: 'power3.out' }),
      sy: gsap.quickTo(titleEl.value, 'y', { duration: TITLE_DURATION, ease: 'power3.out' }),
    }
  }

  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onPointerDown, { passive: true })
  window.addEventListener('pointerup', onPointerEnd, { passive: true })
  window.addEventListener('pointercancel', onPointerEnd, { passive: true })
  document.addEventListener('pointerleave', onLeave)
  document.addEventListener('visibilitychange', syncLive)
  classObserver = new MutationObserver(syncLive)
  classObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  // 滚出视口静默 / 滚回恢复。素材层只在首屏那一段活着。
  io = new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1]
      // 可见比例 < 40% ⇔ 滚出视口 ≥60%
      inViewport = e.intersectionRatio >= 0.4
      syncLive()
    },
    { threshold: [0, 0.4, 0.6, 1] },
  )
  if (rootEl.value) io.observe(rootEl.value)
}

function onMotionChange(): void {
  if (!motionQuery.matches) setupField()
  syncLive()
}

onMounted(() => {
  // Static by default for reduced motion; install pointer/geometry work only if
  // it is enabled, including when the OS preference changes without a reload.
  motionQuery.addEventListener('change', onMotionChange)
  if (!motionQuery.matches) setupField()
})

onBeforeUnmount(() => {
  mounted = false
  pointerActive = false
  io?.disconnect()
  io = null
  classObserver?.disconnect()
  classObserver = null
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerEnd)
  window.removeEventListener('pointercancel', onPointerEnd)
  document.removeEventListener('pointerleave', onLeave)
  document.removeEventListener('visibilitychange', syncLive)
  motionQuery.removeEventListener('change', onMotionChange)
  setters?.sx.tween.kill()
  setters?.sy.tween.kill()
  setters = null
  // 视频不在任何时间线里，光断开观察器不会停止解码 —— 必须显式 pause
  for (const el of els) {
    gsap.killTweensOf(el)
    const mask = el.querySelector('.cwave__mask')
    const content = el.querySelector('.cwave__content')
    if (mask) gsap.killTweensOf(mask)
    if (content) gsap.killTweensOf(content)
    const v = el.querySelector('video')
    if (v) {
      v.pause()
      if (v.hasAttribute('src')) { v.removeAttribute('src'); v.load() }
    }
  }
  els = []
  alive.length = 0
})
</script>

<style scoped>
/*
  ⚠️ 这里**没有**任何位置与 transform 的静态定义 —— 弹出落点、缩放、倾斜
  全部归 GSAP（它们是动效）；CSS 只管宽度、比例、层级与「默认藏着」。
  留一份 CSS transform 等于两个真相源。
*/
.cwave {
  position: absolute;
  inset: 0;
  /* 全视口 window pointermove 驱动，素材自己不拦任何事件 */
  pointer-events: none;
}

/* ---------- 标题层：唯一的参照框（压在素材簇上面，参考站如此） ---------- */
.cwave__type {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* ---------- 成片素材：没有座位，长在指针走过的地方 ---------- */
.cwave__item {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  margin: 0;
  overflow: hidden;
  /* 参考站实测 ~32% 屏宽；16:9 由宽推高 */
  width: clamp(320px, 32vw, 520px);
  aspect-ratio: 16 / 9;
  /*
    静止态：藏起来。CSS 先归零，防止首帧闪一下 —— 而且这就是 reduced-motion
    那条路径的全部（不注册机制 ⇒ 永远停在这里）。
  */
  opacity: 0;
}
.cwave__item.is-live { will-change: transform, opacity; }

/*
  ── 三层分工（参考站实测，缺一不可）──────────────────────────────────────
  `.cwave__item`  外层：只定位（GSAP 一次性 set），不写 transform 补间。
  `.cwave__mask`  中层：clip-path 揭示（中心竖线 → 全幅），写 clip-path。
  `.cwave__content` 内层：揭示 scale 0.7071→1；退休反向 1→0（缩没），写 transform。
  三层各一个写入者，合一层会让 clip 跟着 scale 一起被缩放。
*/
.cwave__mask {
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  /* 静止起手态 = 中心竖线（spawn 的 fromTo 会再钉一次，这里双保险） */
  clip-path: polygon(50% 48.69%, 50% 48.69%, 50% 51.31%, 50% 51.31%);
}
.cwave__item.is-live .cwave__mask { will-change: clip-path; }

.cwave__content {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: center center;
}
.cwave__item.is-live .cwave__content { will-change: transform; }

.cwave__video {
  display: block;
  width: 100%;
  height: 100%;
  /* cover 保证画面比例不被拉扯 —— 绝不用 fill 变形 */
  object-fit: cover;
}

/*
  ── 竖屏手机：片宽吃到 64vw ──────────────────────────────────────────────
  轨迹弹出在窄屏上只有「片多大」一个问题：32vw 在 390px 上只有 125px，
  小得读不出画面。64vw ≈ 250px，弹出时是能看清内容的尺度。
  （全部成片仍在 DOM 池内轮转，在屏五片，保持参考站的停留与缩回效果。）
*/
@media (max-width: 900px) {
  .cwave__item {
    width: 64vw;
  }
}
</style>
