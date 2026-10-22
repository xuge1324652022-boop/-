<template>
  <!--
    从照片到版面：一张摄影原片 + 一张基于它做的封面排版。

    用途
      两张必须**成对**出现、用同一套版式 —— 分开两屏就读不出「转换」这件事。
      两张素材比例相同（16:9 + 16:9），所以桌面可以叠进同一个取景框。

    两种模式
      · 默认（不传 `morph`）—— 两张并排，各自入场，适合直接阅读原片与版面。
      · `morph` —— 桌面由 `setupEditorialScroll.ts` 把 `.editorial-scene` 钉成
        居中舞台，滚动进度沿 x 轴把「版面」从左往右擦出来；手机 / 矮屏 /
        减少动态**不建立舞台**，退回两张完整并排的静态对照（`is-pinned` 缺席
        时下面的 CSS 就只是普通两列）。

    ⚠️ 命中区（morph 且已钉住时）
      上层「版面」那张的 `clip-path` 限定了它自己的可点区域：
      被盖住的左半边点开的是**版面**，还露着的右半边点开的是**原片** ——
      所以原片那张**不能**再写 `pointer-events: none`（那会让露出的部分点不动）。
    键盘聚焦到图片时临时显示对应原片或版面，离开焦点后恢复滚动构图。
  -->
  <div class="editorial-scene" :data-morph="morph ? '' : null">
    <div class="editorial-pair">
      <figure
        v-for="(item, i) in items"
        :key="item.id"
        class="ep"
        :data-reveal="morph ? null : ''"
        :data-morph-before="morph && i === 0 ? '' : null"
        :data-morph-after="morph && i === 1 ? '' : null"
      >
        <button
          type="button"
          class="ep__btn"
          :data-cursor="lang === 'zh' ? '查看' : 'Explore'" data-cursor-action="view"
          :aria-label="t.open(pick(item.title, lang))"
          @click="emit('open', item, $event.currentTarget as HTMLElement)"
        >
          <img
            class="ep__img"
            :src="item.src" :srcset="visualImageSources(item)" sizes="(max-width: 760px) calc(100vw - 32px), 46vw"
            :width="item.width"
            :height="item.height"
            :alt="pick(item.alt, lang)"
            loading="lazy"
            decoding="async"
          />
        </button>
        <figcaption class="ep__cap">
          <span class="ep__step">{{ i === 0 ? t.before : t.after }}</span>
          <span class="ep__title">{{ pick(item.title, lang) }}</span>
          <span v-if="item.note" class="ep__note">{{ pick(item.note, lang) }}</span>
        </figcaption>
      </figure>

      <!-- 转换进度线：只占一行、1px，由滚动进度驱动 `scaleX`（见 setupEditorialScroll） -->
      <span v-if="morph" class="ep__rule" data-morph-rule aria-hidden="true"></span>
    </div>

  </div>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../工具/响应式图片'
import { computed } from 'vue'
import { pick, type Lang } from '../../数据/人物资料'
import type { VisualAsset } from '../../数据/视觉作品资料'

const props = withDefaults(
  defineProps<{
    items: readonly VisualAsset[]
    lang: Lang
    /**
     * 滚动驱动的「照片 → 版面」转换（仅桌面）。
     * ⚠️ 打开前先确认两张素材**比例相同**：比例不同就叠不齐，
     *    擦除会露出两套错位的边。`/poster` 那对是 16:9 + 16:9。
     */
    morph?: boolean
  }>(),
  { morph: false },
)

const emit = defineEmits<{
  open: [item: VisualAsset, trigger: HTMLElement]
}>()

const t = computed(() =>
  props.lang === 'zh'
    ? {
        before: '原片',
        after: '排版后',
        open: (title: string) => `查看完整作品：${title}`,
      }
    : {
        before: 'Original',
        after: 'After layout',
        open: (title: string) => `View full piece: ${title}`,
      },
)
</script>

<style scoped>
.editorial-scene {
  min-width: 0;
}

.editorial-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(24px, 4vw, 72px);
  align-items: center;
}

.ep {
  margin: 0;
}

.ep__btn {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}
.ep__btn:focus-visible {
  outline: 2px solid var(--ab-ink);
  outline-offset: 4px;
}

/* 原始比例：只按宽度铺满栅格，高度自动 —— 绝不固定高度去裁 */
.ep__img {
  display: block;
  width: 100%;
  height: auto;
  background: #ececea;
}

.ep__cap {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin-top: 14px;
}
.ep__step {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--ab-soft);
}
.ep__title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ab-ink);
}
.ep__note {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--ab-soft);
}

/* 进度线：默认不占位（只有 morph 模式才渲染这个节点，且只在钉住时才显示） */
.ep__rule {
  display: none;
}

/* ---------------- 钉住时的居中舞台（由 setupEditorialScroll 加 .is-pinned） ----------------
 *
 * ⚠️ 这一段只在 JS 确实建立了 pin 时生效。它一出现，版式就从「两列」变成
 *    「两张叠在同一个取景框里」；条件退出（窄屏 / 矮屏 / 减少动态）时
 *    `is-pinned` 被摘掉，页面立刻回到上面那套普通两列 —— 不会留下半张叠图。
 * ⚠️ `min-height: 100svh` + `justify-content: center`：舞台占满一屏、内容居中。
 *    `padding-top` 用 JS 写的 `--ep-nav-h`（保留的变量名，现表示顶部留白）。
 *    图版保留真实16:9比例，144px为顶部留白、图注、进度线和下留白。
 *    已删去独立查看按钮，不再为旧控制条预留高度。
 */
.editorial-scene.is-pinned {
  box-sizing: border-box;
  min-height: 100svh;
  padding: var(--ep-nav-h, 56px) 0 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.editorial-scene.is-pinned .editorial-pair {
  width: 100%;
  max-width: calc((100svh - 144px) * 16 / 9);
  margin-inline: auto;
  grid-template-columns: minmax(0, 1fr);
  /*
   * ⚠️ 必须 `start` 而不是继承基类的 `center`：两张 figure 的高度会被**图注**
   *    撑开（「原片」「排版后」两个徽标的字宽不同，换行与否可能不一样），
   *    高度差 2px，`center` 就会把两张各偏移 1px —— 叠在一起的画面错开 1px，
   *    擦除时能看见一条细缝。
   */
  align-items: start;
  gap: 0;
}
/*
 * 两张进同一个网格单元 ⇒ 完全重合。
 * ⚠️ 靠的是「比例相同 + 同一列宽」，不是绝对定位：图注仍在 figure 的正常流里，
 *    所以两张 figure 仍然等高，图注也就落在同一行上（交叉淡入才叠得准）。
 */
.editorial-scene.is-pinned .ep {
  grid-area: 1 / 1;
}
.editorial-scene.is-pinned .ep__rule {
  display: block;
  grid-area: 2 / 1;
  height: 1px;
  margin-top: 18px;
  background: var(--ab-line);
  /* `scaleX` 从左边长出来，与擦除同向 */
  transform-origin: left center;
}
/*
 * ⚠️ 原片那张**不写** `pointer-events: none`：上层的 `clip-path` 已经把「版面」
 *    的可点区域限定在它自己露出的那部分，露着的右半边本来就该归原片。
 */

/* 键盘直接使用图片入口；聚焦期间让对应作品完整可见，滚动补间保留原进度。 */
.editorial-scene.is-pinned .ep__btn:focus-visible {
  outline-offset: -4px;
}
.editorial-scene.is-pinned:has([data-morph-before] .ep__btn:focus-visible) [data-morph-after] {
  clip-path: inset(0 100% 0 0) !important;
}
.editorial-scene.is-pinned:has([data-morph-after] .ep__btn:focus-visible) [data-morph-after] {
  clip-path: inset(0) !important;
}
.editorial-scene.is-pinned:has([data-morph-before] .ep__btn:focus-visible) [data-morph-before] .ep__cap,
.editorial-scene.is-pinned:has([data-morph-after] .ep__btn:focus-visible) [data-morph-after] .ep__cap {
  opacity: 1 !important;
}
.editorial-scene.is-pinned:has([data-morph-before] .ep__btn:focus-visible) [data-morph-after] .ep__cap,
.editorial-scene.is-pinned:has([data-morph-after] .ep__btn:focus-visible) [data-morph-before] .ep__cap {
  opacity: 0 !important;
}

/* 手机：上下排列（方案指定），morph 的舞台不参与 */
@media (max-width: 760px) {
  .editorial-pair {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}
</style>
