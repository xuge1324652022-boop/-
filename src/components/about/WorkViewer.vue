<template>
  <!--
    精选案例查看器：由保留的 SelectedWork 组件持有开关，与现行页面的大图查看器独立。
    ⚠️ 与 `VisualViewer.vue` 是两个**独立实例**：本组件展示案例封面与文字，
       那个看的是个人摄影 / 海报的静态大图。滚动锁与焦点陷阱各自成立。

    ⚠️ Teleport 到 body：`.about-page` 上有 `overflow-x: clip` 且自身建立了
       层叠上下文，留在里面会被裁掉、也压不过全局遮罩。挂到 body 才干净。
    ⚠️ 当前只展示 Work.cover；不借用 /color 视频作为公司项目证据，素材归属见数据层。
    ⚠️ 打开期间给 `<html>` 加 `no-scroll`（全站约定），关闭时**还原到打开前**
       的状态 —— 不能无条件 remove，否则会破坏上层调用者已有的滚动锁。
  -->
  <Teleport to="body">
    <div
      class="wv"
      :class="{ 'is-in': shown }"
      role="dialog"
      aria-modal="true"
      :aria-label="pick(work.title, lang)"
      @click.self="close"
      @keydown.esc="close"
    >
      <div ref="panel" class="wv__panel" :class="{ 'is-in': shown }">
        <button ref="closeBtn" type="button" class="wv__close" :aria-label="t.close" @click="close">
          <span aria-hidden="true">✕</span>
        </button>

        <!--
          ⚠️ 这里现在**只**渲染封面。
             `Work` 上刻意没有 `video` 字段：四项曾经都挂 `/color/` 的调色素材，
             归属不成立（详见 `aboutProfile.ts` 的 `Work` 注释）—— 拿调色成片当
             公司案例的成片证据，播出来的画面和项目对不上。
             要恢复成片播放：先给 `Work` 加回 `video?: string`，再在这里加回
             `<video :src="work.video" :poster="work.cover" controls autoplay muted loop>`。
        -->
        <div class="wv__media">
          <img class="wv__video" :src="work.cover" :alt="pick(work.title, lang)" />
          <!-- 与作品行的「封面示意」保持一致：归属未确认的封面在弹窗里同样声明 -->
          <span v-if="!work.coverConfirmed" class="wv__flag" aria-hidden="true">{{ t.flag }}</span>
        </div>

        <div class="wv__info">
          <p class="wv__idx"><span>{{ work.index }}</span> · {{ pick(work.period, lang) }}</p>
          <h3 class="wv__title">{{ pick(work.title, lang) }}</h3>
          <p class="wv__org">{{ pick(work.org, lang) }}</p>
          <p class="wv__sum">{{ pick(work.summary, lang) }}</p>

          <ul class="wv__stats">
            <li v-for="(s, i) in work.stats" :key="i" class="wv__stat">
              <b>{{ pick(s.value, lang) }}</b>
              <span>{{ pick(s.label, lang) }}</span>
            </li>
          </ul>

          <ul class="wv__tags">
            <li v-for="(tg, i) in work.tags" :key="i">{{ pick(tg, lang) }}</li>
          </ul>

          <a class="wv__link" :href="CONTACT.portfolio" target="_blank" rel="noopener noreferrer">
            {{ t.more }} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CONTACT, pick, type Lang, type Work } from '../../data/aboutProfile'

const props = defineProps<{ work: Work; lang: Lang }>()
const emit = defineEmits<{ close: [] }>()

const t = computed(() =>
  props.lang === 'zh'
    ? { close: '关闭', more: '在作品集里看更多', flag: '封面示意' }
    : { close: 'Close', more: 'See more in the portfolio', flag: 'Cover placeholder' },
)

const closeBtn = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const shown = ref(false)
/** 打开前的滚动锁状态：关闭时原样还原，不覆盖调用者已有的锁。 */
let hadNoScroll = false

/**
 * 关闭弹层。只 `emit('close')`，不自己改 `props`：
 * 开关状态由父级 SelectedWork 持有，
 * 组件自己清会让「关闭后还原滚动位置与焦点」那条路径失去唯一入口。
 */
function close(): void {
  emit('close')
}

/**
 * 弹层内可聚焦的元素（按 DOM 顺序）。
 * ⚠️ 每次按 Tab **现查**，不在打开时缓存：弹层内容会随语言切换重建，
 *    缓存的节点会变成一批已经离开文档的孤儿（`focus()` 静默失败）。
 */
function focusables(): HTMLElement[] {
  const el = panel.value
  if (!el) return []
  const sel =
    'a[href], button:not([disabled]), video[controls], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
  return Array.from(el.querySelectorAll<HTMLElement>(sel)).filter(
    (n) => n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement,
  )
}

/**
 * 键盘：Escape 关闭；Tab / Shift+Tab 在弹层内循环。
 * ⚠️ 焦点圈是**手写**的（见下面的注释）：`aria-modal` 不会让浏览器自动圈住 Tab。
 */
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    close()
    return
  }
  if (e.key !== 'Tab') return

  /*
   * ⚠️ `role="dialog"` + `aria-modal="true"` 只是**声明**，浏览器不会因此把 Tab
   *    关在弹层里 —— 实测按 Tab 能一路走到背后页面的「← 返回列表」和语言切换按钮，
   *    而遮罩把焦点圈盖住了，键盘用户根本看不见自己在哪。
   *    这里自己圈住：到两端绕回另一端，落在弹层外就拉回第一个。
   */
  const list = focusables()
  if (!list.length) {
    e.preventDefault()
    return
  }
  const first = list[0]
  const last = list[list.length - 1]
  const cur = document.activeElement as HTMLElement | null
  const inside = !!cur && !!panel.value?.contains(cur)

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

onMounted(async () => {
  hadNoScroll = document.documentElement.classList.contains('no-scroll')
  document.documentElement.classList.add('no-scroll')
  document.addEventListener('keydown', onKey)
  await nextTick()
  /* 先落一帧再上 is-in，过渡才会真的播（同帧加类浏览器会合并掉） */
  requestAnimationFrame(() => {
    shown.value = true
  })
  closeBtn.value?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (!hadNoScroll) document.documentElement.classList.remove('no-scroll')
})
</script>

<style scoped>
.wv {
  position: fixed;
  inset: 0;
  z-index: 9998; /* 低于全局 PageCurtain(10005)，高于普通页面内容 */
  display: grid;
  place-items: center;
  padding: clamp(16px, 4vh, 48px) clamp(16px, 4vw, 56px);
  background: rgba(6, 3, 16, 0.86);
  backdrop-filter: blur(10px);
  opacity: 0;
  transition: opacity 0.32s ease;
}
.wv.is-in {
  opacity: 1;
}

.wv__panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.32fr) minmax(0, 1fr);
  width: min(1180px, 100%);
  max-height: 100%;
  overflow: hidden;
  border: 1px solid var(--ab-line);
  border-radius: 8px;
  /* ⚠️ 固定深色，不随 --ab-bg：查看器是深色沉浸弹窗（02–06 屏已转纸白底，
     弹窗如果跟着变白会和深色遮罩 + 深色媒体区断裂）。 */
  background: #151515;
  /* 弹窗内的文字 / 分隔线 / 强调统一翻浅 —— 全局 --ab-* 现在是纸面深色系，
     直接继承会让深字落在深面板上读不清。局部覆盖只作用在弹窗子树里。 */
  --ab-ink: #ffffff;
  --ab-soft: rgba(255, 255, 255, 0.72);
  --ab-dim: rgba(255, 255, 255, 0.5);
  --ab-line: rgba(255, 255, 255, 0.18);
  --ab-accent: #ffffff;
  opacity: 0;
  transform: translateY(14px) scale(0.985);
  transition:
    opacity 0.36s ease,
    transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
.wv__panel.is-in {
  opacity: 1;
  transform: none;
}

.wv__close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
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
.wv__close:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.55);
}

/* ---------------- 媒体 ---------------- */

.wv__media {
  position: relative;
  min-height: 240px;
  background: #06030f;
}
.wv__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* 封面示意角标：与作品行 .work__flag 视觉一致（深色 media 上用白字） */
.wv__flag {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 2;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  pointer-events: none;
  backdrop-filter: blur(2px);
}

/* ---------------- 信息 ---------------- */

.wv__info {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: clamp(24px, 3vw, 40px);
  overflow-y: auto;
}
.wv__idx {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--ab-dim);
}
.wv__idx span {
  color: var(--ab-accent);
}
.wv__title {
  margin: 14px 0 0;
  font-size: clamp(22px, 2.4vw, 32px);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #fff;
}
.wv__org {
  margin: 10px 0 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--ab-soft);
}
.wv__sum {
  margin: 20px 0 0;
  font-size: 14px;
  line-height: 1.85;
  color: var(--ab-soft);
}

.wv__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 24px 0 0;
  padding: 18px 0 0;
  border-top: 1px solid var(--ab-line);
  list-style: none;
}
.wv__stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wv__stat b {
  font-size: 19px;
  font-weight: 800;
  line-height: 1;
  color: var(--ab-accent);
}
.wv__stat span {
  font-size: 11px;
  line-height: 1.45;
  color: var(--ab-dim);
}

.wv__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}
.wv__tags li {
  padding: 0;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--ab-soft);
}
.wv__tags li + li { border-left: 1px solid var(--ab-line); padding-left: 10px; }

.wv__link {
  align-self: flex-start;
  margin-top: 26px;
  padding: 10px 0;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--ab-line);
  color: var(--ab-ink);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
  text-decoration: none;
  transition: border-color .25s ease;
}
.wv__link:hover {
  border-color: currentColor;
}
.wv__link:focus-visible { outline: 2px solid currentColor; outline-offset: 5px; }

/* ---------------- 窄屏：纵向堆叠 ---------------- */

@media (max-width: 860px) {
  .wv {
    align-items: stretch;
    padding: 0;
  }
  .wv__panel {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    width: 100%;
    max-height: 100%;
    border: 0;
    border-radius: 0;
  }
  .wv__media {
    aspect-ratio: 16 / 9;
    min-height: 0;
  }
  .wv__info {
    padding: 22px 20px 34px;
  }
  .wv__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .wv__stat b {
    font-size: 16px;
  }
}

/* 减少动态效果：不播过渡，直接呈现 */
@media (prefers-reduced-motion: reduce) {
  .wv,
  .wv__panel {
    transition: none;
  }
  .wv {
    opacity: 1;
  }
  .wv__panel {
    opacity: 1;
    transform: none;
  }
}
</style>
