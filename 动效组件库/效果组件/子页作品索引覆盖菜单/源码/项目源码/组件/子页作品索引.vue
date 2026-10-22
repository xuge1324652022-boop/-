<template>
  <Teleport to="body">
    <button ref="trigger" class="subpage-index" :class="{ 'is-visible': visible || open }"
      type="button" :aria-label="subpageLanguage === 'zh' ? '打开作品索引' : 'Open works index'" aria-controls="subpage-index-menu" :aria-expanded="open" :tabindex="open || routeCurtainActive ? -1 : 0"
      @click="show" @mouseenter="hold = true" @mouseleave="release" @focus="visible = true" @blur="release">
      <span>{{ subpageLanguage === 'zh' ? '索引' : 'Index' }}</span>
    </button>
    <Transition :css="false" @before-enter="preparePanel" @enter="enterPanel" @leave="leavePanel" @after-enter="focusPanel" @after-leave="finishClose">
      <div v-if="open" id="subpage-index-menu" ref="panel" class="subpage-menu" role="dialog" aria-modal="true"
        aria-labelledby="subpage-index-title" @keydown="onKeydown">
        <header class="subpage-menu__header">
          <h2 id="subpage-index-title" class="subpage-menu__label">{{ subpageLanguage === 'zh' ? '作品索引' : 'Works index' }}</h2>
          <button ref="closeButton" type="button" :aria-label="subpageLanguage === 'zh' ? '关闭作品索引' : 'Close works index'" @click="close()">{{ subpageLanguage === 'zh' ? '关闭' : 'Close' }}</button>
        </header>
        <nav :aria-label="subpageLanguage === 'zh' ? '作品章节' : 'Work chapters'" class="subpage-menu__chapters">
          <RouterLink v-for="(chapter, i) in CHAPTERS" :key="chapter.key" :style="{ '--order': i }"
            :to="{ path: jumpPathFor(chapter.number), query: { from: source } }"
            :aria-current="route.path === jumpPathFor(chapter.number) ? 'page' : undefined" @click="close(false)">
            <span class="subpage-menu__line">
              <span class="subpage-menu__number">{{ chapter.number }}</span>
              <span class="subpage-menu__title">{{ titles[chapter.key] }}</span>
              <span class="subpage-menu__zh">{{ chapter.subtitle }}</span>
            </span>
          </RouterLink>
        </nav>
        <footer class="subpage-menu__footer">
          <RouterLink class="subpage-menu__home" :to="backTo" @click="close(false)">{{ backLabel }}</RouterLink>
          <div class="subpage-menu__language" :aria-label="subpageLanguage === 'zh' ? '界面语言' : 'Interface language'" role="group">
            <button type="button" :aria-pressed="subpageLanguage === 'zh'" aria-label="使用中文" @click="subpageLanguage = 'zh'">中文</button>
            <span aria-hidden="true">/</span>
            <button type="button" :aria-pressed="subpageLanguage === 'en'" aria-label="Read in English" @click="subpageLanguage = 'en'">EN</button>
          </div>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 子页索引：滚动唤醒、静置隐藏，展开后通过 Teleport 脱离被 inert 的页面根节点。
 * 菜单独占 has-subpage-index 锁；关闭还原原有 inert 状态，导航时先解锁再换页。
 * 保持组件跨子页存活，使离场动画、焦点恢复与弹层节点拥有同一个生命周期。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CHAPTERS } from '../数据/作品章节资料'
import { jumpPathFor } from '../组合函数/应用转场状态'
import { subpageLanguage } from '../组合函数/子页语言状态'
import { routeCurtainActive } from '../组合函数/页面幕布控制'
import gsap from 'gsap'
import { guardOverlayTouchScroll } from '../工具/覆盖层触摸保护'

const route = useRoute()
const titles = { about: 'About', edit: 'Edit', color: 'Color', news: 'News', poster: 'Poster', photo: 'Photography' }
const source = computed(() => route.query.from === 'cards' ||
  (route.path.startsWith('/card/') && route.query.from !== 'gallery') ? 'cards' : 'gallery')
const backTo = computed(() => source.value === 'cards' ? '/cards' : '/')
const backLabel = computed(() => subpageLanguage.value === 'zh'
  ? (source.value === 'cards' ? '返回列表' : '返回作品集')
  : (source.value === 'cards' ? 'Back to list' : 'Back to works'))
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const visible = ref(true)
const open = ref(false)
let idleTimer = 0
let hold = false
let destroyed = false
let background: HTMLElement | null = null
let hadInert = false
let closing = false
let menuAnimation: gsap.core.Timeline | undefined
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
const touchQuery = window.matchMedia('(hover: none), (pointer: coarse)')
let releaseTouchGuard: (() => void) | undefined

function preparePanel(element: Element) {
  menuAnimation?.kill()
  const lines = element.querySelectorAll('.subpage-menu__line')
  gsap.set(element, { opacity: motionQuery.matches ? 1 : 0, pointerEvents: 'auto' })
  gsap.set(lines, { yPercent: motionQuery.matches ? 0 : 100 })
}
function enterPanel(element: Element, done: () => void) {
  if (motionQuery.matches) { done(); return }
  menuAnimation = gsap.timeline({ onComplete: done })
    .to(element, { opacity: 1, duration: .6, ease: 'power2.out' }, 0)
    .to(element.querySelectorAll('.subpage-menu__line'), {
      yPercent: 0, duration: .8, stagger: .04, ease: 'power3.out',
    }, .15)
}
function leavePanel(element: Element, done: () => void) {
  menuAnimation?.kill()
  ;(element as HTMLElement).inert = true
  gsap.set(element, { pointerEvents: 'none' })
  if (motionQuery.matches) { done(); return }
  menuAnimation = gsap.timeline({ onComplete: done })
    .to(element, { opacity: 0, duration: .4, ease: 'power2.in' })
}

// 正反向滚动共用一个闲置计时器，不依赖 delta 正负，也不建立常驻 RAF。
function wake() {
  if (document.hidden) return
  visible.value = true
  window.clearTimeout(idleTimer)
  // 触屏没有悬停，隐藏唯一导航入口后很难再次发现；桌面仍保留原来的闲置退场。
  if (open.value || touchQuery.matches) return
  idleTimer = window.setTimeout(() => {
    if (!hold && !open.value && !trigger.value?.matches(':focus-visible')) visible.value = false
  }, 1600)
}
function release() { hold = false; wake() }
function focusPanel() { closeButton.value?.focus({ preventScroll: true }) }
async function show() {
  // 现有查看器或加载幕拥有滚动锁时，不再叠加第二个对话框。
  if (open.value || closing || routeCurtainActive.value || document.documentElement.classList.contains('no-scroll') ||
      document.querySelector('.vv, .wv, .page-loader, .pp__intro, .pv__intro, .foundation__curtain')) return
  open.value = true
  window.clearTimeout(idleTimer)
  background = document.getElementById('app')
  hadInert = background?.inert ?? false
  if (background) background.inert = true
  document.documentElement.classList.add('has-subpage-index')
  await nextTick()
  if (!destroyed && open.value) focusPanel()
}
function close(restoreFocus = true) {
  if (!open.value) return
  open.value = false
  closing = true
  if (background) background.inert = hadInert
  background = null
  // 导航必须先撤锁，路由的 scrollBehavior 才能把新页置顶；仅关闭时等揭幕结束
  if (!restoreFocus) document.documentElement.classList.remove('has-subpage-index')
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
  wake()
}
function finishClose() {
  closing = false
  // 只撤自己的锁，不能误删查看器、加载幕使用的 no-scroll。
  document.documentElement.classList.remove('has-subpage-index')
}
function onKeydown(event: KeyboardEvent) {
  // 对话框内循环 Tab 焦点，Escape 关闭；关闭时不改变页面原来的滚动位置。
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key !== 'Tab') return
  const controls = [...(panel.value?.querySelectorAll<HTMLElement>('a[href], button') ?? [])]
  const first = controls[0], last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
watch(() => route.fullPath, () => { close(false); hold = false })
onMounted(() => {
  wake()
  releaseTouchGuard = guardOverlayTouchScroll(() => panel.value, () => open.value || closing)
  touchQuery.addEventListener('change', wake)
  window.addEventListener('scroll', wake, { passive: true })
  window.addEventListener('wheel', wake, { passive: true })
  window.addEventListener('touchmove', wake, { passive: true })
})
onBeforeUnmount(() => {
  destroyed = true
  releaseTouchGuard?.()
  touchQuery.removeEventListener('change', wake)
  menuAnimation?.kill()
  window.clearTimeout(idleTimer)
  window.removeEventListener('scroll', wake)
  window.removeEventListener('wheel', wake)
  window.removeEventListener('touchmove', wake)
  document.documentElement.classList.remove('has-subpage-index')
  if (background) background.inert = hadInert
})
</script>

<style>
html.has-subpage-index { overflow: hidden; }
html.page-turn-lock .subpage-index { opacity:0; pointer-events:none; }
.subpage-index {
  position: fixed;
  top: clamp(20px, 2.10625vw, 44px);
  right: clamp(20px, 2.78vw, 64px);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  mix-blend-mode: difference;
  font: inherit;
  font-size: clamp(18px, 1.667vw, 32px);
  font-weight: 400;
  line-height: 1.25;
  letter-spacing: normal;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-10px);
  pointer-events: none;
  transition: opacity .2s ease-in, transform .2s ease-in;
}
.subpage-index.is-visible,
.subpage-index:focus-visible {
  opacity: 1;
  transform: none;
  pointer-events: auto;
  transition-duration: .5s;
  transition-timing-function: cubic-bezier(.215, .61, .355, 1);
}
.subpage-index::before,
.subpage-menu__header button::before { content: ''; position: absolute; inset: -10px -4px; }
.subpage-menu {
  --index-size: clamp(32px, min(5.903vw, calc(var(--stable-viewport-height) * .105)), 114px);
  position: fixed;
  inset: 0;
  height: var(--dynamic-viewport-height);
  z-index: 9997;
  display: flex;
  flex-direction: column;
  padding: max(clamp(20px, 2.10625vw, 44px), env(safe-area-inset-top, 0px)) max(clamp(20px, 2.78vw, 64px), env(safe-area-inset-right, 0px)) max(18px, env(safe-area-inset-bottom, 0px)) max(clamp(20px, 2.78vw, 64px), env(safe-area-inset-left, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  background: rgb(245 241 232 / .8);
  -webkit-backdrop-filter: blur(40px);
  backdrop-filter: blur(40px);
  color: #252525;
}
.subpage-menu__header {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  align-items: center;
}
.subpage-menu__label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.subpage-menu__header button {
  position: relative;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: clamp(18px, 1.667vw, 32px);
  font-weight: 400;
  line-height: 1.25;
  letter-spacing: normal;
  cursor: pointer;
}
.subpage-menu__chapters {
  flex: 0 0 auto;
  width: 100%;
  margin-top: clamp(26px, calc(var(--stable-viewport-height) * .0575), 57px);
  padding-bottom: 12px;
}
.subpage-menu__chapters a {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow: clip;
  color: inherit;
  text-decoration: none;
  opacity: 1;
  transition: opacity .5s ease;
}
.subpage-menu__line {
  display: flex;
  align-items: baseline;
  gap: clamp(12px, 1.1vw, 22px);
  transition: translate .5s cubic-bezier(.215, .61, .355, 1);
}
.subpage-menu__chapters:has(a:focus-visible) a { opacity: .3; }
.subpage-menu__chapters a:focus-visible { opacity: 1; }
.subpage-menu__chapters a:focus-visible .subpage-menu__line { translate: clamp(18px, 2.78vw, 40px) 0; }
@media (hover: hover) and (pointer: fine) {
  .subpage-menu__chapters:has(a:hover) a { opacity:.3; }
  .subpage-menu__chapters a:hover { opacity:1; }
  .subpage-menu__chapters a:hover .subpage-menu__line { translate:clamp(18px,2.78vw,40px) 0; }
}
.subpage-menu__number {
  align-self: flex-start;
  flex: 0 0 auto;
  margin-top: .6em;
  font-size: clamp(10px, .9vw, 16px);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.subpage-menu__title {
  font-size: var(--index-size);
  font-weight: 400;
  line-height: 1.17;
  letter-spacing: -.025em;
}
.subpage-menu__zh {
  margin-left: clamp(4px, 1vw, 20px);
  font-size: clamp(10px, .95vw, 16px);
  line-height: 1.4;
  white-space: nowrap;
}
.subpage-menu__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-top: auto;
}
.subpage-menu__home {
  min-height: 44px;
  padding: 12px 0;
  color: inherit;
  font-size: 12px;
  text-decoration: none;
}
.subpage-menu__language { display: flex; align-items: center; gap: 8px; }
.subpage-menu__language span { font-size: 12px; opacity: .32; }
.subpage-menu__language button {
  min-height: 44px;
  padding: 12px 2px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  opacity: .32;
  transition: opacity .25s ease;
}
.subpage-menu__language button:hover,
.subpage-menu__language button:focus-visible,
.subpage-menu__language button[aria-pressed=true] { opacity: 1; }
.subpage-menu button:focus-visible,
.subpage-menu a:focus-visible,
.subpage-index:focus-visible { outline: 2px solid currentColor; outline-offset: 5px; }
@media (max-width: 600px) {
  .subpage-index { top: max(20px, env(safe-area-inset-top, 0px)); right: max(20px, env(safe-area-inset-right, 0px)); min-height:44px; min-width:44px; }
  .subpage-menu { --index-size: clamp(32px, 10.5vw, 58px); padding-top: max(20px, env(safe-area-inset-top, 0px)); }
  .subpage-menu__header button { min-height:44px; min-width:44px; }
  .subpage-menu__line { gap: 10px; }
  .subpage-menu__zh { margin-left: 0; font-size: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .subpage-index,
  .subpage-menu__line,
  .subpage-menu__chapters a,
  .subpage-menu__language button { transition: none; }
}
</style>
