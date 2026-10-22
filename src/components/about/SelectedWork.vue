<template>
  <!--
    保留的精选案例列表；当前 AboutView 改用完整经历，此组件不在现行正文中挂载。

    ⚠️ 版式是**连续宽幅项目行**，不是卡片网格（2026-10-10 改）。
       上一版做成两列四宫格：每项被压成一张小卡，画面只有 16:9 的一半宽，
       「职责」根本没有位置 —— 读起来像作品墙，不像履历。
       现在一项一行：左侧大画面，右侧「编号·时间 → 标题 → 机构 → 职责 → 成果 → 标签」。
       行与行之间只有一条细分隔线，**没有卡片边框**（去掉「普通卡片感」）。

    ⚠️ 一行一个 `.work`，但**不加** `data-reveal-stagger` 容器：
       容器很高，`start: 'top 84%'` 只会触发一次，四行会在同一瞬间一起错峰出现 ——
       后三行出现时人还没滚到，等于白演。这里让每行各自触发（`data-reveal`）。

    ⚠️ 可点区域是覆盖整行的 `<button class="work__hit">`（stretched hit area），
       不是给 `<article>` 挂 click：行里有 `<h3>`，整块当按钮会毁掉标题语义。
    ⚠️ 封面是本人成片的真实静帧（`public/about/work-0N.webp`），不是占位图；
       换素材直接覆盖同名文件。
    ⚠️ 这里**没有**视频：四项曾经都挂 `/color/` 的调色素材，归属不成立（见
       `aboutProfile.ts` 的 `Work` 注释）。未确认之前只展示封面 + 文字案例。
  -->
  <AboutSection :index="'06'" :label="'WORK'" :title="t.title" :lead="SECTION_LEAD" motion="slide">
    <div class="works">
      <article v-for="w in WORKS" :key="w.id" :id="`work-${w.id}`" class="work" data-reveal>
        <div class="work__cover">
          <img
            class="work__img"
            :src="w.cover"
            width="1200"
            height="675"
            :alt="`${pick(w.title, lang)} 封面`"
            loading="lazy"
            decoding="async"
          />
          <!-- 封面归属未确认时声明「示意素材」，避免被读成该公司案例的证据 -->
          <span v-if="!w.coverConfirmed" class="work__flag" aria-hidden="true">{{ t.coverFlag }}</span>
          <span class="work__cue" aria-hidden="true">{{ t.cue }}</span>
        </div>

        <div class="work__body">
          <p class="work__meta">
            <span class="work__idx">{{ w.index }}</span>
            <span class="work__period">{{ pick(w.period, lang) }}</span>
          </p>

          <h3 class="work__title">{{ pick(w.title, lang) }}</h3>
          <p class="work__org">{{ pick(w.org, lang) }}</p>
          <p class="work__sum">{{ pick(w.summary, lang) }}</p>

          <ul class="work__stats">
            <li v-for="(s, si) in w.stats" :key="si" class="work__stat">
              <!--
                ⚠️ `data-count-value` 必须是**当前语言**的原值：数字补间每帧从这里
                   现取目标与后缀（切语言后不会把中文格式写回英文页）。
              -->
              <b class="work__stat-v" data-count :data-count-value="pick(s.value, lang)">
                {{ pick(s.value, lang) }}
              </b>
              <span class="work__stat-k">{{ pick(s.label, lang) }}</span>
            </li>
          </ul>

          <ul class="work__tags">
            <li v-for="(tg, ti) in w.tags" :key="ti" class="work__tag">{{ pick(tg, lang) }}</li>
          </ul>
        </div>

        <button
          type="button"
          class="work__hit"
          :aria-label="t.open(pick(w.title, lang))"
          @click="open(w, $event)"
        ></button>
      </article>
    </div>

    <WorkViewer v-if="active" :work="active" :lang="lang" @close="close" />
  </AboutSection>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AboutSection from './AboutSection.vue'
import WorkViewer from './WorkViewer.vue'
import { WORKS, pick, type Lang, type Work } from '../../data/aboutProfile'

const props = defineProps<{ lang: Lang }>()
const SECTION_LEAD = {
  zh: '四段经历里能拿出数据的那四件：海外社媒短视频、AIGC 漫剧分镜与成片、3C 与家居账号运营、校园融媒体宣传',
  en: 'The four pieces with numbers behind them: overseas social video, AIGC comic-drama production, 3C & home account operations, and campus media',
}

const t = computed(() =>
  props.lang === 'zh'
    ? {
        title: '精选作品',
        cue: '查看',
        coverFlag: '封面示意',
        open: (n: string) => `查看作品：${n}`,
      }
    : {
        title: 'Selected work',
        cue: 'View',
        coverFlag: 'Cover placeholder',
        open: (n: string) => `View work: ${n}`,
      },
)

/** 当前打开的作品；null = 关闭。 */
const active = ref<Work | null>(null)
/** 触发元素：关闭后把焦点还回去，键盘用户不会掉到页首。 */
let lastTrigger: HTMLElement | null = null

/**
 * 打开作品。
 * ⚠️ 触发元素**从事件里取**（`e.currentTarget`）而不是读 `document.activeElement`：
 *    某些浏览器点击 `<button>` 不会让它拿到焦点，读 activeElement 会还错地方。
 */
function open(w: Work, e: MouseEvent): void {
  lastTrigger = e.currentTarget as HTMLElement
  active.value = w
}

/** 关闭并把焦点还给触发按钮（键盘用户不会掉回页首重新 Tab 一遍） */
function close(): void {
  active.value = null
  lastTrigger?.focus()
  lastTrigger = null
}
</script>

<style scoped>
/*
 * 项目行：一行一项。
 * ⚠️ 用 `border-top` + 最后一行 `border-bottom` 画分隔线，不用卡片边框 ——
 *    四张带边框的卡会立刻读成「网格」，而不是「一份连续的清单」。
 */
.works {
  display: flex;
  flex-direction: column;
}

.work {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
  gap: clamp(22px, 3.4vw, 64px);
  align-items: center;
  padding: clamp(30px, 4.4vh, 62px) 0;
  border-top: 1px solid var(--ab-line);
  transition: background-color 0.35s ease;
}
.work:last-child {
  border-bottom: 1px solid var(--ab-line);
}
.work:hover {
  background-color: rgba(37, 37, 37, 0.035);
}

/* ---------------- 画面 ---------------- */

.work__cover {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 4px;
  background: #141414;
}
.work__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 作品画面保留原本色彩 —— 黑白风只作用于档案人像，作品是「证据」，要真 */
  transition: transform 0.7s ease;
}
.work:hover .work__img {
  transform: scale(1.04);
}

/* ---------------- 正文 ---------------- */

.work__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.work__meta {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ab-dim);
}
.work__idx {
  font-size: 13px;
  font-weight: 800;
  color: var(--ab-accent);
}

.work__title {
  margin: 12px 0 0;
  font-size: clamp(21px, 2.3vw, 32px);
  font-weight: 800;
  line-height: 1.24;
  letter-spacing: -0.015em;
  color: var(--ab-ink);
}
.work__org {
  margin: 9px 0 0;
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: 0.03em;
  color: var(--ab-soft);
}
/* 职责：宽幅行里第一次有位置把它写全 */
.work__sum {
  margin: 16px 0 0;
  font-size: 14px;
  line-height: 1.85;
  color: var(--ab-soft);
}

/* ---------------- 成果数据 ---------------- */

.work__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: clamp(20px, 2.6vh, 30px) 0 0;
  padding: clamp(16px, 2vh, 22px) 0 0;
  border-top: 1px solid var(--ab-line);
  list-style: none;
}
.work__stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.work__stat-v {
  /*
   * ⚠️ 这一格现在既可能是数字（`630万+`），也可能是平台名（`红网 · 新湖南`）——
   *    后者长得多，字号上限必须收着，否则三列会被撑破。
   */
  font-size: clamp(15px, 1.6vw, 22px);
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
  color: var(--ab-accent);
  /* 等宽数字：滚动计数时宽度不抖 */
  font-variant-numeric: tabular-nums;
}
.work__stat-k {
  font-size: 11px;
  line-height: 1.45;
  color: var(--ab-dim);
}

/* ---------------- 标签 ---------------- */

.work__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: clamp(18px, 2.2vh, 26px) 0 0;
  padding: 0;
  list-style: none;
}
.work__tag {
  padding: 0;
  font-size: 11px;
  line-height: 1.4;
  letter-spacing: 0.06em;
  color: var(--ab-soft);
}
.work__tag + .work__tag { border-left: 1px solid var(--ab-line); padding-left: 10px; }

/* ---------------- 封面示意角标（归属未确认时） ---------------- */

.work__flag {
  position: absolute;
  left: 10px;
  top: 10px;
  z-index: 3;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  pointer-events: none;
  backdrop-filter: blur(2px);
}

/* ---------------- 命中区与提示 ---------------- */

.work__hit {
  position: absolute;
  inset: 0;
  z-index: 2;
  appearance: none;
  border: 0;
  background: none;
  cursor: pointer;
}
.work__hit:focus-visible {
  outline: 2px solid var(--ab-accent);
  outline-offset: 4px;
}
.work__cue {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 3;
  padding: 6px 14px;
  background: var(--ab-accent);
  color: #f7f7f5;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
  pointer-events: none;
}
.work:hover .work__cue,
.work__hit:focus-visible ~ .work__cover .work__cue {
  opacity: 1;
  transform: none;
}

/* ---------------- 窄屏：画面在上，正文在下 ---------------- */

@media (max-width: 860px) {
  .work {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding: 34px 0;
  }
  .work__stat-v {
    font-size: 16px;
  }
  .work__stats {
    gap: 10px;
  }
}
</style>
