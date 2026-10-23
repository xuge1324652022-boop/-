<template>
  <!--
    完整作品查看器：摄影 / 海报点开后看全图。

    ⚠️ Teleport 到 body：`.about-page` / 子页根节点上有 `overflow-x: clip` 并建立了
       层叠上下文，留在里面可能被裁掉或困在较低层级，无法覆盖页面交互层。
       挂 body 才干净。
    ⚠️ **必须 `object-fit: contain`**：方案点名要求。海报是 8:5、摄影里还有
       竖构图（例如3712×5568），用 `cover` 会切掉标题和画面 ——
       这正是方案里「海报不能统一裁成 16:9」那条要求的落点。
    ⚠️ 打开期间给 `<html>` 加 `no-scroll`（全站约定），关闭时**还原到打开前的
       状态**，不能无条件 remove —— 否则会破坏上层调用者已有的滚动锁。
       滚动位置与触发焦点的还原在 `useVisualViewer.close()` 里。

    ⚠️ 2026-10-10 起支持**一组**作品（`items` 长度 > 1 时出现计数 / 左右箭头 /
       缩略图 / 滚轮与方向键切图）。`items` 不传就是单张，不渲染无效的翻页控件。
    ⚠️ 当前是哪一张由**调用方的 composable** 决定（`useVisualViewer` 的
       `index`），本组件只 `emit('step' | 'goTo')`。两处各存一份下标必然会不同步
       （「一个属性只有一个写入者」）。
  -->
  <Teleport to="body">
    <div
      ref="root"
      class="vv"
      :class="{ 'is-in': shown }"
      role="dialog"
      aria-modal="true"
      :aria-label="pick(item.title, lang)"
      @click.self="emit('close')"
    >
      <button ref="closeBtn" type="button" class="vv__close" :aria-label="t.close" @click="emit('close')">
        <span aria-hidden="true">✕</span>
      </button>

      <figure class="vv__figure">
        <!--
          ⚠️ 查看器按实际舞台宽高和设备像素比选择图片，手机无需固定请求2560档。
              这是方案「默认展示使用 1600px 版本，大图查看才加载 2560px 版本」的落点。
        -->
        <div class="vv__stage">
          <!-- 左右箭头：放在舞台**外侧**的绝对定位层，不占图的宽度 -->
          <button
            v-if="multi"
            type="button"
            class="vv__arrow vv__arrow--prev"
            :aria-label="t.prev"
            @click="emit('step', -1)"
          >
            ←
          </button>
          <img
            class="vv__img"
            :src="item.src"
            :srcset="visualImageSources(item)"
            :sizes="viewerImageSizes(item)"
            :width="item.width"
            :height="item.height"
            :alt="pick(item.alt, lang)"
            decoding="async"
          />
          <button
            v-if="multi"
            type="button"
            class="vv__arrow vv__arrow--next"
            :aria-label="t.next"
            @click="emit('step', 1)"
          >
            →
          </button>
        </div>

        <figcaption class="vv__cap">
          <!-- 计数只在多项时出现：单张显示「01 / 01」是废话 -->
          <span v-if="multi" class="vv__count">{{ counter }}</span>
          <span class="vv__title">{{ pick(item.title, lang) }}</span>
          <span v-if="item.note" class="vv__note">{{ pick(item.note, lang) }}</span>
        </figcaption>

        <!--
          缩略图导航。用 400 档小图：一次列 6 张，用 1600 档等于多拉近 1 MB。
          `aria-current` 让读屏知道当前在哪一张（不能只靠高亮颜色）。
        -->
        <ul v-if="multi" class="vv__thumbs" :aria-label="t.thumbs">
          <li v-for="(it, i) in items" :key="it.id">
            <button
              type="button"
              class="vv__thumb"
              :class="{ 'is-on': i === index }"
              :aria-current="i === index ? 'true' : undefined"
              :aria-label="pick(it.title, lang)"
              @click="emit('goTo', i)"
            >
              <img class="vv__thumb-img" :src="it.thumb" :alt="''" decoding="async" />
            </button>
          </li>
        </ul>
      </figure>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { visualImageSources, viewerImageSizes } from '../../工具/响应式图片'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { pick, type Lang } from '../../数据/人物资料'
import type { VisualAsset } from '../../数据/视觉作品资料'
import { guardOverlayTouchScroll } from '../../工具/覆盖层触摸保护'

const props = withDefaults(
  defineProps<{
    /** 当前显示的作品 */
    item: VisualAsset
    lang: Lang
    /** 同组作品；不传 = 单张（`/about` 的用法），不渲染任何翻页 UI */
    items?: readonly VisualAsset[]
    /** 当前项在 `items` 中的下标（由调用方的 composable 持有） */
    index?: number
  }>(),
  { items: () => [], index: 0 },
)

const emit = defineEmits<{
  close: []
  step: [dir: -1 | 1]
  goTo: [index: number]
}>()

const t = computed(() =>
  props.lang === 'zh'
    ? {
        close: '关闭（Esc）',
        prev: '上一张（←）',
        next: '下一张（→）',
        thumbs: '缩略图导航',
      }
    : {
        close: 'Close (Esc)',
        prev: 'Previous (←)',
        next: 'Next (→)',
        thumbs: 'Thumbnail navigation',
      },
)

/** 组内张数 > 1 才出现计数 / 箭头 / 缩略图 */
const multi = computed(() => props.items.length > 1)
const counter = computed(
  () =>
    `${String((props.index ?? 0) + 1).padStart(2, '0')} / ${String(props.items.length).padStart(2, '0')}`,
)

const root = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)
const shown = ref(false)
/** 打开前的滚动锁状态：关闭时原样还原，不覆盖调用者已有的锁。 */
let hadNoScroll = false
let disposed = false
let entranceFrame = 0
let releaseTouchGuard: (() => void) | undefined

/** 只移动缩略图条自身；不使用 scrollIntoView，避免把锁住的正文一起滚动。 */
async function revealCurrentThumbnail(): Promise<void> {
  await nextTick()
  if (disposed) return
  const strip = root.value?.querySelector<HTMLElement>('.vv__thumbs')
  const current = strip?.querySelector<HTMLElement>('[aria-current="true"]')
  if (!strip || !current) return
  const row = strip.getBoundingClientRect(), thumb = current.getBoundingClientRect()
  if (thumb.left < row.left) strip.scrollLeft += thumb.left - row.left
  else if (thumb.right > row.right) strip.scrollLeft += thumb.right - row.right
}
watch(() => props.index, revealCurrentThumbnail)

/**
 * 弹层内可聚焦的元素（按 DOM 顺序）。
 * ⚠️ 每次按 Tab **现查**，不在打开时缓存：弹层内容会随语言切换重建，
 *    缓存的节点会变成一批已经离开文档的孤儿（`focus()` 静默失败）。
 */
function focusables(): HTMLElement[] {
  const el = root.value
  if (!el) return []
  const sel = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(el.querySelectorAll<HTMLElement>(sel)).filter(
    (n) => n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement,
  )
}

/**
 * 键盘：Escape 关闭；左右方向键切图（**只在多项时接管** —— 单张时把方向键
 * 还给浏览器，否则用户按左右键翻页会被弹层吃掉）；Tab 在弹层内循环。
 * 监听挂在 `window` 上：焦点可能落在弹层里任意元素，挂在弹层根上会漏。
 */
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }
  // 方向键切图：只在多项时接管，单张按左右键不该被弹层吃掉
  if (multi.value && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    emit('step', e.key === 'ArrowLeft' ? -1 : 1)
    return
  }
  if (e.key !== 'Tab') return

  /*
   * ⚠️ `role="dialog"` + `aria-modal="true"` 只是**声明**，浏览器不会因此把 Tab
   *    关在弹层里。这里自己圈住：到两端绕回另一端，落在弹层外就拉回第一个。
   *    （与 `WorkViewer.vue` 同一套做法，两处都要各自圈 —— 它们不是同一个实例。）
   */
  const list = focusables()
  if (!list.length) {
    e.preventDefault()
    return
  }
  const first = list[0]
  const last = list[list.length - 1]
  const cur = document.activeElement as HTMLElement | null
  const inside = !!cur && !!root.value?.contains(cur)

  if (e.shiftKey) {
    if (!inside || cur === first) {
      e.preventDefault()
      last.focus()
    }
  } else if (!inside || cur === last) {
    e.preventDefault()
    first.focus()
  }
}

/*
 * 滚轮切图。
 * ⚠️ 必须自己 `addEventListener(..., { passive: false })`，不能写 `@wheel`：
 *    Chromium 对滚轮监听默认按 passive 处理，`preventDefault()` 会被忽略并在
 *    控制台报「Unable to preventDefault inside passive event listener」。
 *
 * ⚠️ **只在主图舞台（`.vv__stage`）接管纵向手势**（2026-10-10 修）。
 *    旧实现是「挂在整层 `.vv` 上、无条件 `preventDefault`」，后果实测（320px）：
 *    缩略图条宽 288、内容宽 320，横向滚动 `scrollLeft` 永远停在 0 ——
 *    事件被查看器吞了，既没翻页、也没滚动缩略图。Ctrl/⌘+滚轮（页面缩放）
 *    同样被当成切图。
 *
 *    现在：目标不在 `.vv__stage` 内 → 直接放行（缩略图条自己横向滚）；
 *    带 Ctrl/Meta → 放行；横向位移 ≥ 纵向位移 → 放行。
 *
 * ⚠️ 触控板一次滑动会连发几十个 wheel，且每个 `deltaY` 常常只有 1–3。
 *    所以既不能「一个事件翻一张」（会一口气翻过全部），也不能「|deltaY|<8 就丢」
 *    （微小位移永远累积不到阈值）。这里改成**累积 + 空闲/反向重置**：
 *    相邻事件的间隔超过 `WHEEL_IDLE_MS`、或方向反转，就把累积量清零。
 * ⚠️ 翻页后 `WHEEL_LOCK_MS` 之内忽略后续事件 —— 一次滑动只翻一张。
 * ⚠️ `deltaMode` 归一化：Firefox 在行模式下 deltaY 是「行数」不是像素。
 */
const WHEEL_LOCK_MS = 360
const WHEEL_IDLE_MS = 180
const WHEEL_THRESHOLD = 32
let wheelLock = 0
let wheelLastAt = 0
let wheelSum = 0

/**
 * 滚轮切图。三层闸门（顺序不能换）：
 *   ① 只在多项时接管（单张没有「下一张」可切）；
 *   ② 事件必须来自**主图舞台**（`closest('.vv__stage')`）—— 缩略图条的横滑、
 *      页面其它区域的滚动都不该被吃；
 *   ③ 只有**以纵向为主**的手势才算（`|deltaX| >= |deltaY|` 一律放过，
 *      那是触控板横向滑动）。
 * 之后再用 `WHEEL_THRESHOLD / WHEEL_IDLE_MS / WHEEL_LOCK_MS` 把一次手势
 * 折叠成「最多切一张」，避免触控板的连续小 delta 把整个序列一口气翻完。
 */
function onWheel(e: WheelEvent): void {
  if (!multi.value || e.ctrlKey || e.metaKey) return
  const target = e.target instanceof Element ? e.target : null
  const stage = target?.closest('.vv__stage')
  if (!stage || !root.value?.contains(stage)) return
  if (!Number.isFinite(e.deltaY) || e.deltaY === 0) return
  if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return

  // 仅主图舞台的纵向手势由查看器接管。
  if (e.cancelable) e.preventDefault()
  e.stopPropagation()

  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1
  const delta = e.deltaY * unit
  const now = performance.now()

  if (now < wheelLock) {
    wheelSum = 0
    wheelLastAt = now
    return
  }
  if (
    now - wheelLastAt > WHEEL_IDLE_MS ||
    (wheelSum !== 0 && Math.sign(wheelSum) !== Math.sign(delta))
  ) {
    wheelSum = 0
  }
  wheelLastAt = now
  wheelSum += delta
  if (Math.abs(wheelSum) < WHEEL_THRESHOLD) return

  const direction: -1 | 1 = wheelSum > 0 ? 1 : -1
  wheelSum = 0
  wheelLock = now + WHEEL_LOCK_MS
  emit('step', direction)
}

onMounted(async () => {
  hadNoScroll = document.documentElement.classList.contains('no-scroll')
  document.documentElement.classList.add('no-scroll')
  document.addEventListener('keydown', onKey)
  root.value?.addEventListener('wheel', onWheel, { passive: false })
  releaseTouchGuard = guardOverlayTouchScroll(() => root.value, () => !disposed)
  await nextTick()
  if (disposed) return
  /* 先落一帧再上 is-in，过渡才会真的播（同帧加类浏览器会合并掉） */
  entranceFrame = requestAnimationFrame(() => {
    entranceFrame = 0
    if (disposed) return
    shown.value = true
  })
  closeBtn.value?.focus({ preventScroll: true })
  void revealCurrentThumbnail()
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(entranceFrame)
  document.removeEventListener('keydown', onKey)
  root.value?.removeEventListener('wheel', onWheel)
  releaseTouchGuard?.()
  /*
   * ⚠️ 必须在这里摘锁，而且要在 `useVisualViewer.close()` 还原滚动位置**之前** ——
   *    `html.no-scroll` 是 `overflow: hidden`，滚动锁还在时 `scrollTo` 不生效。
   *    调用方靠 `await nextTick()` 保证这个卸载已经发生。
   */
  if (!hadNoScroll) document.documentElement.classList.remove('no-scroll')
})
</script>

<style scoped>
.vv {
  position: fixed;
  inset: 0;
  z-index: 9998; /* 低于全局 PageCurtain(10005)，高于普通页面内容 */
  display: grid;
  /*
   * ⚠️ 这一行**不能省**：只写 `display: grid` 时隐式行是 `auto`，行高按内容算，
   *    于是 `.vv__figure` 的 `height: 100%` 无处可解析（百分比对 auto 高度＝auto），
   *    里面的 `minmax(0, 1fr)` 也跟着按 max-content 算 ⇒ **竖图会把整个 figure
   *    撑到自然高度**。实测 1707×2560 的竖向示例图在 1440×900 下把 figure 顶到
   *    2138px，计数条跑到 y=2094、缩略图 y=2139 —— 全在视口外，只剩一张大图。
   *    显式给出 `minmax(0, 1fr)` 后行高变成容器内容高（900−上下内边距），
   *    `height: 100%` 才有确定值，内部的 `1fr` 才会真的把大图压进剩余高度。
   */
  grid-template-rows: minmax(0, 1fr);
  place-items: center;
  padding: clamp(16px, 5vh, 56px) clamp(16px, 4vw, 64px);
  padding-top: max(clamp(16px, 5vh, 56px), env(safe-area-inset-top, 0px));
  padding-bottom: max(clamp(16px, 5vh, 56px), env(safe-area-inset-bottom, 0px));
  padding-left: max(clamp(16px, 4vw, 64px), env(safe-area-inset-left, 0px));
  padding-right: max(clamp(16px, 4vw, 64px), env(safe-area-inset-right, 0px));
  overscroll-behavior: contain;
  background: rgba(6, 3, 16, 0.92);
  backdrop-filter: blur(10px);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.vv.is-in {
  opacity: 1;
}

.vv__close {
  position: absolute;
  top: clamp(14px, 2.4vh, 24px);
  right: clamp(14px, 2.4vw, 26px);
  top: max(clamp(14px, 2.4vh, 24px), env(safe-area-inset-top, 0px));
  right: max(clamp(14px, 2.4vw, 26px), env(safe-area-inset-right, 0px));
  z-index: 3;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition:
    background-color 0.25s ease,
    border-color 0.25s ease;
}
.vv__close:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.55);
}

.vv__figure {
  display: grid;
  /* 舞台吃掉剩余高度，图注/缩略图按内容高 —— 图注再长也不会把图挤出去 */
  grid-template-rows: minmax(0, 1fr) auto auto;
  gap: clamp(12px, 2vh, 22px);
  width: 100%;
  height: 100%;
  /* 与上面 `grid-template-rows` 配套：grid 子项默认 min-height:auto，压不住就顶出去 */
  min-height: 0;
  margin: 0;
  /* 给关闭按钮留出上边距，免得大图顶到它下面 */
  padding-top: 44px;
}

.vv__stage {
  /* min-height:0 是关键：否则 grid 子项不会收缩，竖图会把弹层撑破 */
  position: relative;
  min-height: 0;
  display: grid;
  /*
   * ⚠️ 与 `.vv` 上那条**完全同一个坑**，别以为修了外层就完事：只写 `display: grid`
   *    时隐式行/列都是 `auto`，大图的 `max-height: 100%` 依旧解析不出确定值
   *    （实测外层修好后 figure 已经是 810px，但 `.vv__img` 还是 1987px、直接
   *    溢出舞台 659px）。显式给出两个 `minmax(0, 1fr)`，`max-width/max-height`
   *    才有确定的百分比基准，替换元素按 CSS 2.1 §10.4 保持原比例缩到框内。
   */
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: minmax(0, 1fr);
  place-items: center;
}

/* ---------------- 左右箭头 ---------------- */

.vv__arrow {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  transform: translateY(-50%);
  appearance: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #fff;
  mix-blend-mode: difference;
  font-size: 24px;
  cursor: pointer;
  transition: opacity 0.25s ease;
}
.vv__arrow:hover {
  opacity: 0.65;
}
.vv__arrow:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.vv__arrow--prev {
  left: 0;
}
.vv__arrow--next {
  right: 0;
}

/* ---------------- 大图 ---------------- */

/*
 * ⚠️ `contain` 是方案点名的要求，而且这里必须**同时**用「盒贴合图 + contain」两道：
 *    · `max-width/max-height: 100%` + `width/height: auto` 让**元素盒**按原比例
 *      缩到舞台里（竖图 3712×5568 不会溢出）；
 *    · `object-fit: contain` 兜住元素盒被拉伸的情况（例如将来给舞台加了固定尺寸），
 *      有它就不会出现裁切。
 *    只写 `object-fit` 而让盒子撑满舞台也能"通过"断言，但那要靠 contain 去补救 ——
 *    两道都写才是真的不裁。
 */
.vv__img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 2px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
}

/* ---------------- 图注 ---------------- */

.vv__cap {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 6px 14px;
  margin: 0;
  text-align: center;
}
.vv__count {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.62);
  /* 等宽数字：01 → 02 时计数不会左右跳 */
  font-variant-numeric: tabular-nums;
}
.vv__title {
  font-size: clamp(14px, 1.5vw, 17px);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
}
.vv__note {
  font-size: 12px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.66);
}

/* ---------------- 缩略图导航 ---------------- */

.vv__thumbs {
  display: flex;
  gap: 8px;
  /* auto 外边距只吸收正向余量：短条居中，长条从第一张开始完整横滚。 */
  justify-content: flex-start;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  /* 窄屏放不下就横向滚动，不要换行把大图挤小 */
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
.vv__thumbs > li { flex: none; }
.vv__thumbs > li:first-child { margin-inline-start: auto; }
.vv__thumbs > li:last-child { margin-inline-end: auto; }

.vv__thumb {
  display: block;
  width: 64px;
  height: 44px;
  padding: 0;
  overflow: hidden;
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  opacity: 0.55;
  transition:
    opacity 0.25s ease,
    border-color 0.25s ease;
}
.vv__thumb:hover {
  opacity: 0.85;
}
.vv__thumb.is-on {
  opacity: 1;
  border-color: rgba(255, 255, 255, 0.85);
}
.vv__thumb-img {
  display: block;
  width: 100%;
  height: 100%;
  /* 缩略图是**索引**不是作品本身，这里可以裁成统一小方块 */
  object-fit: cover;
}

@media (max-width: 720px) {
  .vv__arrow {
    width: 44px;
    height: 44px;
  }
  .vv__thumb {
    width: 52px;
    height: 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .vv, .vv__close, .vv__arrow, .vv__thumb { transition: none; }
}
</style>
