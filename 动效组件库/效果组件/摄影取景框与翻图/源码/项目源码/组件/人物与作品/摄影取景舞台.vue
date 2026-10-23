<template>
  <!--
    合成图像示例主画面：保留 sticky 滚动展开，叠加独立的指针视差与拖动翻图。

    `.runway__frame` 管滚动裁剪，surface 管指针视差，track 管拖动，item 管切图。
    章节文字仍交给 useAboutReveal，避免多个控制器写同一个节点的属性。

    ⚠️ `gsap.matchMedia()` 而不是自己判 `innerWidth`：窗口从窄拉宽时它会自动
       建立/撤销这段动画。手写判断就得自己监听 resize，而且撤销时极易漏掉
       已写入的 `clip-path` 内联样式（图会永久停在被裁掉的状态）。
  -->
  <div ref="runway" class="runway" :class="{ 'runway--compact': compact }" @keydown="onKeydown">
    <div class="runway__stage">
      <div ref="surface" class="runway__surface" :class="{ 'is-dragging': dragging }"
        @pointerenter="onPointerEnter" @pointermove="onPointerMove" @pointerleave="onPointerLeave"
        @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="cancelDrag" @lostpointercapture="onLostPointerCapture">
      <div ref="frame" class="runway__frame">
        <div ref="track" class="runway__track">
          <figure
            v-for="(item, i) in items"
            :key="item.id"
            class="runway__item"
            :class="{ 'is-on': i === index }"
            :aria-hidden="i === index ? 'false' : 'true'"
          >
            <button
              type="button"
              class="runway__btn"
              :data-cursor="dragging ? (lang === 'zh' ? '拖动' : 'Drag') : (lang === 'zh' ? '查看' : 'Explore')"
              :data-cursor-action="dragging ? 'drag' : 'view'"
              :tabindex="i === index ? 0 : -1"
              :aria-label="t.open(pick(item.title, lang))"
              @click="openPhoto(item, $event)"
            >
              <img
                class="runway__img"
                :src="item.src" :srcset="visualImageSources(item)" sizes="(max-width: 760px) calc(100vw - 32px), 90vw"
                :width="item.width"
                :height="item.height"
                :alt="pick(item.alt, lang)"
                :loading="i === 0 ? 'eager' : 'lazy'"
                :fetchpriority="i === 0 ? 'high' : 'auto'"
                decoding="async"
                draggable="false"
              />
            </button>
          </figure>
        </div>
      </div>
      </div>

      <!--
        ⚠️ 控制条位于 `.runway__frame` 的外侧，不在它里面：
           展开动画裁的正是 frame，箭头要是放进去，起始帧（上下各裁 12%、
           左右各裁 14%）会连按钮一起裁掉，用户看不到也点不到。
      -->
      <div class="runway__bar">
        <p class="runway__meta" aria-live="polite" aria-atomic="true">
          <span class="runway__no">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="runway__slash" aria-hidden="true">/</span>
          <span class="runway__total">{{ String(items.length).padStart(2, '0') }}</span>
          <span class="runway__name">{{ pick(current.title, lang) }}</span>
        </p>
        <div class="runway__navigation">
        <div class="runway__pagination" role="group" :aria-label="t.selectLabel">
          <button v-for="(item, i) in items" :key="item.id" type="button"
            :aria-label="t.select(pick(item.title, lang))" :aria-current="i === index ? 'true' : undefined"
            @click="goTo(i)"><span aria-hidden="true"></span></button>
        </div>
        <div class="runway__controls">
          <button type="button" :aria-label="t.prev" @click="step(-1)">←</button>
          <button type="button" :aria-label="t.next" @click="step(1)">→</button>
        </div>
        </div>
      </div>
      <p class="runway__hint"><span>{{ t.hint }}</span><span lang="en" v-if="lang === 'zh'">Drag to browse · Click to view</span></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../工具/响应式图片'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { pick, type Lang } from '../../数据/人物资料'
import type { VisualAsset } from '../../数据/视觉作品资料'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps<{
  items: readonly VisualAsset[]
  lang: Lang
  compact?: boolean
}>()

const emit = defineEmits<{
  open: [item: VisualAsset, trigger: HTMLElement]
  change: [item: VisualAsset]
}>()

const t = computed(() =>
  props.lang === 'zh'
    ? {
        prev: '上一张',
        next: '下一张',
        open: (title: string) => `查看完整示例：${title}`,
        selectLabel: '选择合成图像',
        select: (title: string) => `切换到：${title}`,
        hint: '拖动切换 · 点击查看',
      }
    : {
        prev: 'Previous',
        next: 'Next',
        open: (title: string) => `View full sample: ${title}`,
        selectLabel: 'Choose a synthetic image',
        select: (title: string) => `Show ${title}`,
        hint: 'Drag to browse · Click to view',
      },
)

const runway = ref<HTMLElement | null>(null)
const frame = ref<HTMLElement | null>(null)
const surface = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)
const dragging = ref(false)

const index = ref(0)
const current = computed(() => props.items[index.value] ?? props.items[0])

/**
 * 局部动画入口由 matchMedia 安装；减少动态时保持空操作，切图仍由 Vue 即时呈现。
 * 相邻切换按实际素材数量取模循环，直接点选则校验范围，二者共用 goTo。
 */
let animateSwitch: (previous: number, next: number, direction: -1 | 1) => void = () => {}
let moveSurface: (x: number, y: number) => void = () => {}
let resetSurface = () => {}
let moveTrack: (x: number) => void = () => {}
let pointerBounds: { left: number; top: number; width: number; height: number } | null = null
let drag: { id: number; x: number; y: number; active: boolean } | null = null
let ignoreClickUntil = 0

function goTo(next: number, direction: -1 | 1 = next > index.value ? 1 : -1): void {
  if (next < 0 || next >= props.items.length || next === index.value) return
  const previous = index.value
  const buttons = runway.value?.querySelectorAll<HTMLButtonElement>('.runway__btn')
  const restoreFocus = document.activeElement === buttons?.[previous]
  cancelDrag()
  resetSurface()
  index.value = next
  emit('change', props.items[next]!)
  animateSwitch(previous, next, direction)
  if (restoreFocus) void nextTick(() => buttons?.[next]?.focus({ preventScroll: true }))
}
function step(direction: -1 | 1): void {
  const n = props.items.length
  if (n > 1) goTo((index.value + direction + n) % n, direction)
}
function onKeydown(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') goTo(0)
  else if (event.key === 'End') goTo(props.items.length - 1)
  else step(event.key === 'ArrowLeft' ? -1 : 1)
}
function onPointerEnter(event: PointerEvent): void {
  if (event.pointerType === 'mouse') measurePointerBounds()
}
function measurePointerBounds(): void {
  const stage = surface.value?.parentElement, photoFrame = frame.value
  if (!stage || !photoFrame) return
  const bounds = stage.getBoundingClientRect()
  // Read the untransformed stage so pointer tilt never feeds back into its own coordinates.
  pointerBounds = { left: bounds.left + (bounds.width - photoFrame.offsetWidth) / 2,
    top: bounds.top, width: photoFrame.offsetWidth, height: photoFrame.offsetHeight }
}
function onPointerDown(event: PointerEvent): void {
  // 先记录意图，不立即抓住指针；纵向手势仍交给页面，确认横拖后才 capture。
  if (!event.isPrimary || event.button !== 0 || props.items.length < 2) return
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false }
  measurePointerBounds()
}
function onPointerMove(event: PointerEvent): void {
  if (drag && event.pointerId === drag.id) {
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y
    if (!drag.active && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { cancelDrag(); return }
    if (!drag.active && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      drag.active = true
      dragging.value = true
      surface.value?.setPointerCapture(event.pointerId)
      resetSurface()
    }
    if (drag.active) {
      if (event.cancelable) event.preventDefault()
      moveTrack(Math.max(-70, Math.min(70, dx * .28)))
      return
    }
  }
  if (event.pointerType !== 'mouse' || event.buttons) return
  if (!pointerBounds) measurePointerBounds()
  const bounds = pointerBounds
  if (!bounds) return
  moveSurface(Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)),
    Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)))
}
function onPointerUp(event: PointerEvent): void {
  if (!drag || drag.id !== event.pointerId) return
  const dx = event.clientX - drag.x, active = drag.active
  cancelDrag()
  if (!active) return
  // 浏览器在拖动结束后仍可能派发 click；只抑制这类指针 click，键盘激活继续有效。
  ignoreClickUntil = performance.now() + 400
  if (Math.abs(dx) >= 48) step(dx < 0 ? 1 : -1)
}
function cancelDrag(): void {
  if (drag?.active) ignoreClickUntil = performance.now() + 400
  const pointerId = drag?.id
  drag = null
  dragging.value = false
  moveTrack(0)
  if (pointerId !== undefined && surface.value?.hasPointerCapture(pointerId)) surface.value.releasePointerCapture(pointerId)
}
function onLostPointerCapture(event: PointerEvent): void {
  // Touch starts with implicit capture on the button; transferring it to the surface is not a cancellation.
  if (event.target === surface.value) cancelDrag()
}
function onPointerLeave(): void {
  if (drag?.active) return
  cancelDrag()
  pointerBounds = null
  resetSurface()
}
function openPhoto(item: VisualAsset, event: MouseEvent): void {
  if (event.detail > 0 && performance.now() < ignoreClickUntil) return
  resetSurface()
  emit('open', item, event.currentTarget as HTMLElement)
}
function resetInteraction(): void {
  pointerBounds = null
  cancelDrag()
  resetSurface()
}

/**
 * 展开动画的起点裁剪量。
 * ⚠️ 只作用在 `.runway__frame` 上，且只在「宽屏 + 允许动态」时建立。
 */
const CLIP_FROM = 'inset(12% 14% 12% 14%)'
const CLIP_TO = 'inset(0% 0% 0% 0%)'

let mm: gsap.MatchMedia | null = null

onMounted(() => {
  if (!runway.value || !frame.value) return

  mm = gsap.matchMedia()
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)',
    finePointer: '(hover: hover) and (pointer: fine)' }, context => {
    if (!context.conditions!.motion) return
    const slides = Array.from(runway.value!.querySelectorAll<HTMLElement>('.runway__item'))
    const dragTo = gsap.quickTo(track.value!, 'x', { duration: .32, ease: 'power3.out' })
    let trackOffset = 0
    moveTrack = x => { if (x !== trackOffset) { trackOffset = x; dragTo(x) } }
    // The frame owns scroll clipping, the surface owns pointer tilt, and each slide owns its transition.
    animateSwitch = context.add('switchPhoto', (previous: number, next: number, direction: -1 | 1) => {
      gsap.killTweensOf(slides)
      // Freeze the outgoing visual before Vue removes its active class on the next tick.
      gsap.set(slides[previous]!, { opacity: gsap.getProperty(slides[previous]!, 'opacity'), visibility: 'visible' })
      gsap.set(slides.filter((_, i) => i !== previous && i !== next), { autoAlpha: 0, xPercent: 0, clearProps: 'clipPath' })
      gsap.timeline()
        .to(slides[previous]!, { xPercent: direction * -5, autoAlpha: 0, duration: .65, ease: 'power3.inOut' }, 0)
        .fromTo(slides[next]!, { xPercent: direction * 7, opacity: 0, visibility: 'visible',
          clipPath: direction > 0 ? 'inset(0% 0% 0% 14%)' : 'inset(0% 14% 0% 0%)' },
          { xPercent: 0, opacity: 1, clipPath: CLIP_TO, duration: .85, ease: 'power3.inOut' }, 0)
    }) as typeof animateSwitch
    if (context.conditions!.finePointer) {
      const xTo = gsap.quickTo(surface.value!, 'x', { duration: .7, ease: 'power3.out' })
      const yTo = gsap.quickTo(surface.value!, 'y', { duration: .7, ease: 'power3.out' })
      const rxTo = gsap.quickTo(surface.value!, 'rotationX', { duration: .85, ease: 'power3.out' })
      const ryTo = gsap.quickTo(surface.value!, 'rotationY', { duration: .85, ease: 'power3.out' })
      let displaced = false
      moveSurface = (x, y) => { displaced = x !== 0 || y !== 0; xTo(x * 7); yTo(y * 5); rxTo(-y * 1.25); ryTo(x * 1.8) }
      resetSurface = () => { if (displaced) moveSurface(0, 0) }
    }
    return () => {
      animateSwitch = () => {}
      moveTrack = () => {}
      moveSurface = () => {}
      resetSurface = () => {}
      pointerBounds = null
      cancelDrag()
    }
  }, runway.value)
  if (!props.compact) mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    // 文档滚动统一缓动，图框直接跟随，交接时不再叠加另一层追赶。
    gsap.fromTo(
      frame.value!,
      { clipPath: CLIP_FROM },
      {
        clipPath: CLIP_TO,
        ease: 'none',
        scrollTrigger: {
          trigger: runway.value!,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          /*
           * ⚠️ 图片落位后文档高度会变，触发点要重量。这里不 refresh 的话，
           *    懒加载的图一到位，展开的起止点就偏了（表现为「滚到底还没展开完」）。
           */
          invalidateOnRefresh: true,
        },
      },
    )
    // 撤销时把内联的 clip-path 清掉，回到 CSS 的完整状态
    return () => gsap.set(frame.value!, { clearProps: 'clipPath' })
  })
})

/*
 * ⚠️ 包一层箭头函数：`ScrollTrigger.refresh` 的第一个形参是 `safe: boolean`，
 *    直接把它当监听器传，类型和运行时都会把 `Event` 当成 `safe`。
 */
const onLoad = (): void => ScrollTrigger.refresh()

onMounted(() => {
  window.addEventListener('load', onLoad)
  window.addEventListener('scroll', resetInteraction, { passive: true })
  window.addEventListener('blur', resetInteraction)
})

onBeforeUnmount(() => {
  window.removeEventListener('load', onLoad)
  window.removeEventListener('scroll', resetInteraction)
  window.removeEventListener('blur', resetInteraction)
  cancelDrag()
  mm?.revert()
  mm = null
})
</script>

<style scoped>
/* ==================== 默认：普通文档流（手机 / 减少动态） ====================
 * ⚠️ 默认就是「没有 sticky、没有裁剪」的完整版式 —— 脚本挂了或用户开了
 *    减少动态，页面依然是一张能读的静态版式，而不是一片空白或半张图。
 */
.runway {
  position: relative;
}

.runway__stage {
  display: grid;
  grid-template-rows: auto auto auto;
  gap: clamp(16px, 2.4vh, 26px);
  perspective: 1600px;
}

.runway__surface {
  position: relative;
  width: 100%;
  min-height: 0;
  touch-action: pan-y pinch-zoom;
  user-select: none;
}

/*
 * ⚠️ 满幅：主画面必须铺到**视口边缘**（方案「大画面」的落点）。
 *    实测过不做满幅的样子：正文栏宽 1400、内边距 63 ⇒ 画面只有 1273/1440
 *    （88%），两侧各留 83px 白边，「大画面」就退化成了「一张插图」。
 *
 *    手法：`width: 100vw` + `margin-left: calc(50% - 50vw)`。
 *    `50%` 解析的是**容器内容宽**的一半，`50vw` 是视口的一半，两者之差
 *    正好等于「内容栏中心 → 视口中心」的距离 —— 所以哪怕正文栏既有内边距
 *    又受 `max-width: 1400px` 居中约束，元素依然**精确居中于视口**。
 *    ⚠️ 真实浏览器有 8px 滚动条时 `100vw` 会比可视区宽 8px（左右各溢出 4px，
 *       仍然居中）；这些溢出由 `.about-page` 的 `overflow-x: clip` 收掉，
 *       不会产生横向滚动条。**不要**为了这点去用 `width: 100%` —— 那就退回
 *       到 1273px 了。
 * ⚠️ 控制条（`.runway__bar`）**不**满幅：计数器与箭头要跟正文栏对齐，
 *    否则会和上面章节标题的左基线错开。
 */
.runway__frame {
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  /* 稳定的取景框：竖图横图都完整装进去，不裁不拉伸 */
  aspect-ratio: 16 / 10;
  /*
   * ⚠️ 垫色必须是**页面底色**，不能是 `#ececea` 这类灰：
   *    取景框满幅后是 1440×838（比例 1.72），而 3:2 的照片 `contain` 进去
   *    只占 1257 宽 ⇒ 左右各留 ~90px。用灰色垫底就会变成「灰底上的一张插图」，
   *    用页面底色则看不见接缝，画面读起来是**满幅居中**的。
   */
  background: var(--ab-bg);
  overflow: hidden;
}

.runway__track {
  position: relative;
  width: 100%;
  height: 100%;
}

.runway__item {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  /* visibility 让非当前张彻底离开可点区与无障碍树，光靠 opacity 挡不住点击 */
  visibility: hidden;
  pointer-events: none;
}
.runway__item.is-on {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.runway__btn {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}
.runway__btn:focus-visible {
  outline: 2px solid var(--ab-ink);
  outline-offset: -4px;
}

/*
 * ⚠️ `contain` 不是 `cover`：方案要求保留原始比例，这组里有一张竖构图
 *    （示例比例 3712×5568），用 cover 在宽取景框里会只剩中间一条。
 */
.runway__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.runway__surface.is-dragging .runway__btn { cursor: grabbing; }

/* ---------------- 控制条 ---------------- */

.runway__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 4px;
}
.runway__navigation { display:flex; align-items:center; gap:clamp(20px,3vw,44px); }
.runway__pagination { display:flex; gap:6px; }
.runway__pagination button { display:grid; place-items:center; width:44px; height:44px; padding:0; border:0; border-radius:0; background:none; color:var(--ab-ink); cursor:pointer; }
.runway__pagination span { display:block; width:100%; height:1px; background:var(--ab-line); position:relative; }
.runway__pagination span::after { content:''; position:absolute; inset:0; background:currentColor; transform:scaleX(0); transform-origin:left; transition:transform .65s cubic-bezier(.215,.61,.355,1); }
.runway__pagination [aria-current=true] span::after,.runway__pagination button:hover span::after { transform:scaleX(1); }
.runway__hint { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 20px; margin:0; font-size:11px; line-height:1.4; color:var(--ab-soft); }
.runway__hint [lang=en] { font-size:10px; }
.runway__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--ab-dim);
}
.runway__no {
  color: var(--ab-ink);
}
.runway__name {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ab-ink);
}
.runway__controls {
  display: flex;
  gap: 8px;
}
.runway__controls button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  appearance: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #fff;
  mix-blend-mode: difference;
  font-size: 27px;
  cursor: pointer;
  transition: transform .45s cubic-bezier(.215,.61,.355,1);
}
.runway__controls button:first-child:hover { transform:translateX(-4px); }
.runway__controls button:last-child:hover { transform:translateX(4px); }
.runway__navigation button:focus-visible { outline:2px solid var(--ab-ink); outline-offset:3px; }
@media(max-width:680px) {
  .runway__bar { flex-wrap:wrap; gap:8px; }
  .runway__meta { width:100%; }
  .runway__navigation { width:100%; justify-content:space-between; }
}
@media(prefers-reduced-motion:reduce) {
  .runway__pagination span::after,.runway__controls button { transition:none; }
}
@media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference) {
  .runway__surface { will-change:transform; }
}

/* ==================== 宽屏 + 允许动态：sticky 滚动展开 ==================== */

@media (min-width: 900px) and (prefers-reduced-motion: no-preference) {
  /*
   * 跑道高度 200svh：滚过 100svh 的距离完成整段展开。
   * ⚠️ 这是建议起点；改小会让展开变急，改大会让它迟迟不动。
   */
  .runway {
    height: calc(var(--stable-viewport-height,100vh) * 2);
  }
  .runway__stage {
    position: sticky;
    top: 0;
    /* 支持时沿用100svh；旧微信内核回退到有效的vh，不让舞台高度失效。 */
    height: var(--stable-viewport-height,100vh);
    /* 取景框吃掉剩余高度、控制条按内容高 —— 控制条永远在框外，不被裁剪 */
    grid-template-rows: minmax(0, 1fr) auto auto;
    /*
     * ⚠️ 上下内边距收成 0：省下的高度**全部给画面**。
     *    这是「大画面」的关键一步 —— 3:2 的照片在 `contain` 下是**高度受限**的
     *    （宽 = 高 × 1.5），所以每多 100px 高度，画面就宽 150px。
     *    留 36px 内边距时实测画面只有 1137 宽（视口 1440 的 79%）；收掉之后
     *    是 1257（87%）。改这里之前先量画面宽度，别凭感觉调。
     */
    padding-block: 0;
    gap: clamp(8px, 1.4vh, 16px);
  }
  .runway__frame {
    aspect-ratio: auto;
    height: 100%;
  }
}
/* About 的短篇影像区复用浏览交互，采用自然文档流。 */
.runway--compact { height:auto; }
.runway--compact .runway__stage { position:relative; top:auto; height:auto; grid-template-rows:auto auto auto; gap:14px; padding:0; }
.runway--compact .runway__frame { width:100%; margin:0; height:auto; aspect-ratio:3/2; }
.runway--compact .runway__img { max-height:680px; }
.runway--compact .runway__name { font-weight:400; letter-spacing:0; }
@media(max-width:680px) { .runway--compact .runway__frame { aspect-ratio:4/3; } }
</style>
