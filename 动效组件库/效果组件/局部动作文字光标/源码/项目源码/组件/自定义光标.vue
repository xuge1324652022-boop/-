<template>
  <Teleport to="body">
    <div ref="cursor" class="action-cursor" :class="{ 'is-visible': shown, 'is-left': flipLabel, 'is-normal': normalBlend }" :style="{ '--cursor-color': cursorColor }" aria-hidden="true">
      <div class="action-cursor__inner">
        <span class="action-cursor__dot" />
        <span ref="caption" class="action-cursor__label"><Transition name="action-caption"><span :key="label" class="action-cursor__text">{{ label }}</span></Transition></span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 局部动作指针：只在真正可操作的作品区域显示圆点与双语动词。
 * 普通文本、原生输入、触屏与减少动态模式保留系统指针；移动停止后 RAF 也停止。
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type WatchStopHandle } from 'vue'
import { cursorLockState } from '../组合函数/动作光标控制'
import { subpageLanguage } from '../组合函数/子页语言状态'
import { routeCurtainActive } from '../组合函数/页面幕布控制'
import { useVisualViewer } from '../组合函数/作品查看器控制'

const cursor = ref<HTMLElement | null>(null)
const caption = ref<HTMLElement | null>(null)
const shown = ref(false)
const label = ref('')
const flipLabel = ref(false)
const normalBlend = ref(false)
const cursorColor = ref('#ffffff')
const { active: viewerActive } = useVisualViewer()
const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
// 使用已有点击区域或 data 属性声明动作，不额外给每张作品注册全局鼠标监听。
const zoneSelector = '[data-cursor], [data-cursor-label], .pg__btn'
const nativeSelector = 'input, textarea, select, [contenteditable], video[controls], [data-cursor="native"], [inert], [hidden], [aria-disabled="true"], :disabled'
let zone: HTMLElement | null = null
let x = 0, y = 0, targetX = 0, targetY = 0
let hasPosition = false, pressed = false, dead = false
let frame = 0, hitFrame = 0, lastTime = 0
let hitUntil = 0, labelTimer = 0
let requestedLabel = ''
let cursorWidth = 0
let stopWatching: WatchStopHandle | undefined
let stopLanguage: WatchStopHandle | undefined
let domObserver: MutationObserver | undefined
let captionObserver: ResizeObserver | undefined

function hide() {
  shown.value = false
  zone?.removeAttribute('data-cursor-active')
  zone = null
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  lastTime = 0
  window.clearTimeout(labelTimer)
  labelTimer = 0
  requestedLabel = label.value
}
function positionLabel() {
  // 原站以整组宽度与视口两侧 2% 留白判断换侧，而不是另设固定像素边界。
  flipLabel.value = targetX + cursorWidth > window.innerWidth * .98
}
function updateLabel(content: string, immediate: boolean) {
  if (requestedLabel === content && !immediate) return
  requestedLabel = content
  window.clearTimeout(labelTimer)
  const commit = () => { labelTimer = 0; label.value = content; void nextTick(positionLabel) }
  // 对照原站 Label：跨动作时防抖 50ms，再让新旧文字分别向上接力；首次入区立即可读。
  if (immediate || !label.value) commit()
  else labelTimer = window.setTimeout(commit, 50)
}
function paint(time: number) {
  frame = 0
  if (!shown.value || dead || !zone?.isConnected) { hide(); return }
  const delta = lastTime ? Math.min((time - lastTime) / 1000, .1) : 1 / 60
  lastTime = time
  const follow = motionQuery.matches ? 1 : 1 - Math.exp(-26 * delta)
  x += (targetX - x) * follow
  y += (targetY - y) * follow
  if (cursor.value) cursor.value.style.transform = `translate3d(${x}px, ${y}px, 0)`
  if (Math.abs(targetX - x) + Math.abs(targetY - y) > .02) frame = requestAnimationFrame(paint)
  else lastTime = 0
}
function updateZone(target: EventTarget | null) {
  if (!fineQuery.matches || motionQuery.matches || pressed || cursorLockState.value || routeCurtainActive.value || viewerActive.value || document.hidden || !hasPosition) { hide(); return }
  const element = target instanceof Element ? target : null
  const next = element?.closest<HTMLElement>(zoneSelector) ?? null
  // 图内装饰可 aria-hidden，不能因此遮掉它所属按钮的动作；隐藏状态从动作区向上判定。
  if (!next || element?.closest(nativeSelector) || next.closest('[aria-hidden="true"]')) { hide(); return }
  const content = next.dataset.cursor === 'native' ? ''
    : subpageLanguage.value === 'zh'
      ? next.dataset.cursorZh ?? next.dataset.cursorLabel ?? next.dataset.cursor ?? (next.matches('.pg__btn') ? '放大' : '查看作品')
      : next.dataset.cursorEn ?? next.dataset.cursorLabel ?? next.dataset.cursor ?? (next.matches('.pg__btn') ? 'Zoom in' : 'Explore')
  if (!content) { hide(); return }
  if (zone !== next) {
    zone?.removeAttribute('data-cursor-active')
    zone = next
    zone.setAttribute('data-cursor-active', '')
  }
  const wasVisible = shown.value
  normalBlend.value = next.dataset.cursorBlend === 'normal'
  // 普通图像使用白色 difference，由浏览器逐像素反相；色带可显式指定正常混合的墨色。
  // 不在 pointermove 里反复把照片读进 canvas，也不把所有区域强制改成同一黑色。
  if (normalBlend.value) {
    const declared = next.dataset.cursorColor
    cursorColor.value = declared && CSS.supports('color', declared) ? declared : getComputedStyle(next).color
  } else cursorColor.value = '#ffffff'
  updateLabel(content, !wasVisible)
  shown.value = true
  if (!wasVisible) { x = targetX; y = targetY }
  if (!frame) frame = requestAnimationFrame(paint)
  positionLabel()
}
function onPointer(event: PointerEvent) {
  if (event.pointerType !== 'mouse') { hide(); return }
  targetX = event.clientX
  targetY = event.clientY
  hasPosition = true
  updateZone(event.target)
}
function recheck(duration = 0) {
  // 页面滚动或打开浮层时鼠标未必移动，必须按原坐标重新命中当前最上层元素。
  if (dead || !hasPosition || document.hidden) return
  hitUntil = Math.max(hitUntil, performance.now() + duration)
  if (!hitFrame) hitFrame = requestAnimationFrame(checkHit)
}
function checkHit(time: number) {
  hitFrame = 0
  if (dead || !hasPosition || document.hidden) return
  updateZone(document.elementFromPoint(targetX, targetY))
  // 动画舞台可能在 scroll 事件的下一帧才变形；短时重采样接住最后几帧，闲置后立即停。
  if (time < hitUntil) hitFrame = requestAnimationFrame(checkHit)
}
function onScroll() { recheck(180) }
function onSceneMotion(event: Event) { if (!cursor.value?.contains(event.target as Node)) recheck(event.type.endsWith('end') || event.type.endsWith('cancel') ? 0 : 500) }
function onDown() { pressed = true; hide() }
function onUp() { pressed = false; recheck() }
function stopSampling() { if (hitFrame) cancelAnimationFrame(hitFrame); hitFrame = 0; hitUntil = 0 }
function onExit(event: PointerEvent) { if (!event.relatedTarget) { hasPosition = false; stopSampling(); hide() } }
function onBlur() { pressed = false; hasPosition = false; stopSampling(); hide() }
function onVisibility() { if (document.hidden) { stopSampling(); hide() } else recheck(180) }
function onPreference() { if (!fineQuery.matches || motionQuery.matches) { stopSampling(); hide() } else recheck() }
// 两种偏好分别持有回调并成对撤销；CSS 同时兜底，查询通知抵达前也不隐藏原生指针。
const onFinePreference = () => onPreference()
const onMotionPreference = () => onPreference()

onMounted(() => {
  document.body.classList.remove('has-custom-cursor')
  stopWatching = watch([cursorLockState, routeCurtainActive, viewerActive], ([lock, curtain, viewer]) => {
    document.body.classList.toggle('is-cursor-dragging', lock === 'drag')
    if (lock || curtain || viewer) { stopSampling(); hide() } else recheck(180)
  }, { immediate: true, flush: 'sync' })
  stopLanguage = watch(subpageLanguage, () => recheck())
  document.addEventListener('pointermove', onPointer, { passive: true })
  document.addEventListener('pointerover', onPointer, { passive: true })
  document.addEventListener('pointerout', onExit, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  window.addEventListener('pointerup', onUp, { passive: true })
  window.addEventListener('pointercancel', onUp, { passive: true })
  window.addEventListener('blur', onBlur)
  document.addEventListener('scroll', onScroll, { passive: true, capture: true })
  window.addEventListener('resize', onScroll, { passive: true })
  for (const type of ['transitionrun', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel']) document.addEventListener(type, onSceneMotion, true)
  document.addEventListener('visibilitychange', onVisibility)
  fineQuery.addEventListener('change', onFinePreference)
  motionQuery.addEventListener('change', onMotionPreference)
  // 新查看器/菜单打开后替换旧命中区域；只观察结构变化，不观察逐帧动画样式。
  domObserver = new MutationObserver(records => {
    if (records.some(record => !cursor.value?.contains(record.target))) recheck(180)
  })
  domObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'inert', 'disabled', 'hidden', 'aria-hidden', 'aria-disabled', 'data-cursor', 'data-cursor-label', 'data-cursor-zh', 'data-cursor-en', 'data-cursor-blend', 'data-cursor-color'] })
  captionObserver = new ResizeObserver(entries => {
    const entry = entries.find(item => item.target === cursor.value)
    // Safari/WebView 的早期 ResizeObserver 可能不提供 borderBoxSize。
    if (entry) cursorWidth = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
    positionLabel()
  })
  if (cursor.value) captionObserver.observe(cursor.value)
})

onBeforeUnmount(() => {
  // 全局事件、观察器与追随/命中两个 RAF 都由本实例释放，避免热更新后重复响应。
  dead = true
  hide()
  stopSampling()
  domObserver?.disconnect()
  captionObserver?.disconnect()
  stopWatching?.()
  stopLanguage?.()
  document.removeEventListener('pointermove', onPointer)
  document.removeEventListener('pointerover', onPointer)
  document.removeEventListener('pointerout', onExit)
  window.removeEventListener('pointerdown', onDown)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  window.removeEventListener('blur', onBlur)
  document.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
  for (const type of ['transitionrun', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel']) document.removeEventListener(type, onSceneMotion, true)
  document.removeEventListener('visibilitychange', onVisibility)
  fineQuery.removeEventListener('change', onFinePreference)
  motionQuery.removeEventListener('change', onMotionPreference)
  document.body.classList.remove('has-custom-cursor', 'is-cursor-dragging')
})
</script>

<style>
.action-cursor {
  --cursor-unit: .6944444444vw;
  --cursor-dot: round(nearest, calc(var(--cursor-unit) * .8), 1px);
  --cursor-gap: calc(var(--cursor-unit) * .8);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10000;
  pointer-events: none;
  color: var(--cursor-color, #fff);
  mix-blend-mode: difference;
  opacity: 0;
  transition: opacity .3s ease, color .3s ease;
  width: max-content;
  text-transform: capitalize;
}
.action-cursor.is-visible { opacity: 1; }
.action-cursor.is-normal { mix-blend-mode: normal; }
.action-cursor__inner { display:flex; align-items:center; gap:var(--cursor-gap); transform:translate(calc(var(--cursor-dot) * -.5), -50%); }
.action-cursor__dot {
  flex-shrink: 0;
  width: var(--cursor-dot);
  height: var(--cursor-dot);
  background: currentColor;
  border-radius: 50%;
}
.action-cursor__label {
  position: relative;
  display: block;
  overflow-y: clip;
  font-size: calc(var(--cursor-unit) * 1.6);
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: -.02em;
  white-space: pre-line;
}
.action-cursor__text { display:block; }
.action-cursor.is-left .action-cursor__label { text-align:right; transform:translateX(calc(-100% - var(--cursor-dot) * 2 - var(--cursor-gap))); }
.action-caption-enter-active,.action-caption-leave-active { transition:transform .45s cubic-bezier(.4,0,.2,1),opacity .35s cubic-bezier(.4,0,.2,1); }
.action-caption-enter-from { opacity:0; transform:translateY(75%); }
.action-caption-enter-to,.action-caption-leave-from { opacity:1; transform:translateY(0); }
.action-caption-leave-to { opacity:0; transform:translateY(-75%); }
.action-caption-leave-active { position:absolute; inset:0; }
@media(max-width:900px) { .action-cursor { --cursor-unit:2.6666666667vw; } }
@media(min-width:500px) and (max-width:900px) { .action-cursor { --cursor-unit:clamp(13px,1.46484375vw,14px); } }
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  [data-cursor-active], [data-cursor-active] * { cursor: none !important; }
}
@media (hover: hover) and (pointer: fine) {
  body.is-cursor-dragging .three-home,
  body.is-cursor-dragging .three-home .gallery-camera,
  body.is-cursor-dragging .three-home .gallery-camera * { cursor: grabbing; }
}
@media (hover: none), (pointer: coarse) { .action-cursor { display: none; } }
@media (prefers-reduced-motion: reduce) { .action-cursor { display:none; } .action-cursor,.action-caption-enter-active,.action-caption-leave-active { transition: none; } }
</style>
