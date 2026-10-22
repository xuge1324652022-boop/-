<template>
  <!--
    横向作品带：统一**高度**、宽度随原始比例走。

    ⚠️ 为什么不能统一宽度或裁成 16:9：这组三张海报实际是 5118×3198 ≈ **8:5**，
       标题就排在画面上。裁成 16:9 会直接把标题切掉 —— 方案里「海报不能统一裁成
       16:9，裁切会破坏标题和画面构图」说的就是这件事。
       做法：`height: clamp(...)` 定高 + `width: auto` + `max-width: none`，
       浏览器按 `<img>` 上的宽高比算出各自的宽度，一张都不裁。

    ⚠️ 揭示动画由页面的 `useAboutReveal.ts` 统一建（`data-reveal` 标记）。
       本组件只管理原生横向滚动和箭头边界；open 上报素材与按钮，弹层由页面持有。
  -->
  <div class="strip">
    <div class="strip__bar">
      <p v-if="label" class="strip__label">{{ label }}</p>
      <div class="strip__controls">
        <button
          type="button"
          :aria-label="t.prev"
          :disabled="atStart"
          @click="move(-1)"
        >
          ←
        </button>
        <button
          type="button"
          :aria-label="t.next"
          :disabled="atEnd"
          @click="move(1)"
        >
          →
        </button>
      </div>
    </div>

    <!--
      `tabindex="0"`：横向滚动区必须能被键盘进入，否则只有鼠标用户翻得动。
      它自带 aria-label，读屏会念成「作品带，可横向滚动」。
    -->
    <div
      ref="strip"
      class="strip__track"
      tabindex="0"
      role="group"
      :aria-label="t.group"
      @scroll.passive="read"
    >
      <figure v-for="(item, i) in items" :key="item.id" class="strip__item" data-reveal>
        <button
          type="button"
          class="strip__btn"
          :aria-label="t.open(pick(item.title, lang))"
          @click="emit('open', item, $event.currentTarget as HTMLElement)"
        >
          <img
            class="strip__img"
            :src="item.src"
            :srcset="visualImageSources(item)"
            :sizes="`(max-width: 760px) clamp(${170 * item.width / item.height}px, ${46 * item.width / item.height}vw, ${260 * item.width / item.height}px), clamp(${200 * item.width / item.height}px, ${30 * item.width / item.height}vw, ${420 * item.width / item.height}px)`"
            :width="item.width"
            :height="item.height"
            :alt="pick(item.alt, lang)"
            :loading="i === 0 ? 'eager' : 'lazy'"
            decoding="async"
          />
        </button>
        <figcaption class="strip__cap">
          <span class="strip__title">{{ pick(item.title, lang) }}</span>
          <span v-if="item.note" class="strip__note">{{ pick(item.note, lang) }}</span>
        </figcaption>
      </figure>
    </div>
  </div>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../utils/responsiveImage'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { pick, type Lang } from '../../data/aboutProfile'
import type { VisualAsset } from '../../data/visualPortfolio'

const props = defineProps<{
  items: readonly VisualAsset[]
  lang: Lang
  /** 可选：作品带上方的小标签（如「个人主题海报系列」） */
  label?: string
}>()

const emit = defineEmits<{
  open: [item: VisualAsset, trigger: HTMLElement]
}>()

const t = computed(() =>
  props.lang === 'zh'
    ? {
        prev: '向左浏览',
        next: '向右浏览',
        group: '横向作品带，可左右滚动浏览',
        open: (title: string) => `查看完整作品：${title}`,
      }
    : {
        prev: 'Scroll left',
        next: 'Scroll right',
        group: 'Horizontal work strip, scrollable left and right',
        open: (title: string) => `View full piece: ${title}`,
      },
)

const strip = ref<HTMLElement | null>(null)
/** 到两端就把对应箭头禁用 —— 让「还能不能翻」在视觉上可见 */
const atStart = ref(true)
const atEnd = ref(false)

const EDGE = 2

/** 重算两端箭头能不能点（横向滚动 / 容器尺寸变化 / 图片落位后都会调） */
function read(): void {
  const el = strip.value
  if (!el) return
  atStart.value = el.scrollLeft <= EDGE
  // 内容没溢出时 scrollWidth === clientWidth ⇒ 两端同时为真，两个箭头都禁用（正确）
  atEnd.value = el.scrollLeft >= el.scrollWidth - el.clientWidth - EDGE
}

/** 按一屏的 80% 翻页；减少动态时用瞬时跳转，不做平滑滚动 */
function move(direction: -1 | 1): void {
  const el = strip.value
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollBy({
    left: direction * el.clientWidth * 0.8,
    behavior: reduced ? 'auto' : 'smooth',
  })
}

let ro: ResizeObserver | null = null

onMounted(() => {
  read()
  /*
   * ⚠️ 图片是懒加载的，`scrollWidth` 在图片落位之前是错的 —— 不重量一次，
   *    首屏就会显示「两个箭头都禁用」，看起来像作品带坏了。
   */
  ro = new ResizeObserver(read)
  if (strip.value) ro.observe(strip.value)
  window.addEventListener('load', read)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  window.removeEventListener('load', read)
})
</script>

<style scoped>
.strip {
  position: relative;
}

.strip__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ab-line);
}
.strip__label {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--ab-dim);
}
.strip__controls {
  display: flex;
  gap: 8px;
}
.strip__controls button {
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
  font-size: 24px;
  cursor: pointer;
  transition: opacity 0.25s ease;
}
.strip__controls button:hover:not(:disabled) {
  opacity: 0.65;
}
.strip__controls button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.strip__controls button:disabled {
  opacity: 0.3;
  cursor: default;
}

.strip__track {
  display: flex;
  gap: clamp(20px, 3vw, 48px);
  overflow-x: auto;
  scroll-snap-type: x proximity;
  padding-block: clamp(20px, 3vh, 34px);
  /* 触屏惯性 + 不吃掉纵向滚动 */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  /* 焦点环贴着内容走，别贴到整条带子的边缘 */
  scroll-padding-inline: 2px;
}
.strip__track:focus-visible {
  outline: 2px solid var(--ab-ink);
  outline-offset: 4px;
}

.strip__item {
  flex: 0 0 auto;
  margin: 0;
  scroll-snap-align: start;
}

.strip__btn {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  /* 键盘聚焦时给按钮本体一个可见的环 */
  border-radius: 2px;
}
.strip__btn:focus-visible {
  outline: 2px solid var(--ab-ink);
  outline-offset: 3px;
}

/*
 * ⚠️ 这三个属性是一组，缺一个就会裁图或变形：
 *    height 定高 → width:auto 让浏览器按宽高比算宽 → max-width:none 解除
 *    「图片不超出容器」的默认约束（否则窄屏上会被压扁）。
 */
.strip__img {
  display: block;
  height: clamp(200px, 30vw, 420px);
  width: auto;
  max-width: none;
  background: #ececea;
}

.strip__cap {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin-top: 14px;
  max-width: 30ch;
}
.strip__title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ab-ink);
}
.strip__note {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  padding: 3px 8px;
  border: 1px solid var(--ab-line);
  border-radius: 999px;
  color: var(--ab-dim);
}

@media (max-width: 760px) {
  .strip__img {
    /* 手机上别让一张图占满整屏宽，留出「后面还有」的暗示 */
    height: clamp(170px, 46vw, 260px);
  }
  .strip__track {
    /* 手机上加一点左右内边距，滚动时首尾不会贴死屏幕边 */
    padding-inline: 2px;
  }
}
</style>
