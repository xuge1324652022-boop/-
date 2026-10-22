<template>
  <!--
    通用章节壳：摄影、海报及保留的案例组件共用，不代表当前关于页的固定屏序。

    职责只有「编号 + 标题 + 导语 + 内容槽」这一层骨架 —— 版式一致靠它，
    各屏的具体内容不进这里。这样各屏的节奏（编号对齐、标题基线、上下留白）
    只有一个写入者，加屏时不会各自长出一套标题样式。

    编号与标题仍交给 `useAboutReveal.ts`；导语由共享行遮罩组件独立管理，
    不再挂 `data-reveal`，避免整段揭示与逐行揭示同时写同一段文字。
  -->
  <section class="ab-sec" :data-sec="index" :data-motion="motion">
    <header class="ab-sec__head" data-reveal-stagger>
      <p class="ab-sec__kicker" data-reveal>
        <span class="ab-sec__no">{{ index }}</span>
        <span class="ab-sec__slash" aria-hidden="true">/</span>
        <span class="ab-sec__label">{{ label }}</span>
        <span class="ab-sec__rule" aria-hidden="true"></span>
      </p>
      <h2 class="ab-sec__title" data-reveal>{{ title }}</h2>
      <ReferenceIntroduction v-if="lead" class="ab-sec__lead" :text="lead" :label="label" variant="section" />
    </header>

    <div class="ab-sec__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import ReferenceIntroduction from '../ReferenceIntroduction.vue'
import type { Bi } from '../../data/aboutProfile'

withDefaults(
  defineProps<{
    /** 章号，如 `02` */
    index: string
    /** 英文小标签，如 `PROFILE` */
    label: string
    /** 章节大标题（已按语言算好，组件不感知语言） */
    title: string
    /** 可选导语 */
    lead?: string | Bi
    /**
     * 这一章的揭示机制（`rise` / `slide` / `wipe` / `scale` / `fade`）。
     * 只写进 `data-motion`，由 `useAboutReveal.ts` 读取 —— 组件自己不建动画。
     * 不传就是 `rise`（老的「淡入 + 上移 26px」），所以没标过的屏一行都不用改。
     * ⚠️ 可选值表在 `useAboutReveal.ts` 的 `MOTIONS`，那里是唯一一处真相。
     */
    motion?: string
  }>(),
  { motion: 'rise' },
)
</script>

<style scoped>
.ab-sec {
  /* 章与章之间的呼吸：由 AboutView 的 `> * + *` 统一给，这里只管自己内部 */
  position: relative;
}

.ab-sec__head {
  position: relative;
  padding-bottom: clamp(30px, 4.4vh, 52px);
  border-bottom: 1px solid var(--ab-line);
}

.ab-sec__kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.28em;
}
.ab-sec__no {
  color: var(--ab-accent);
}
.ab-sec__slash {
  color: var(--ab-dim);
}
.ab-sec__label {
  color: var(--ab-soft);
}
/* 从标签一路拉到右边缘的细线 —— 让每屏的起始有一条共同的视觉基线 */
.ab-sec__rule {
  flex: 1;
  height: 1px;
  margin-left: 6px;
  background: linear-gradient(90deg, var(--ab-line), transparent);
}

.ab-sec__title {
  margin: 20px 0 0;
  font-size: clamp(30px, 5.4vw, 68px);
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--ab-ink);
}

.ab-sec__lead {
  margin-top: clamp(40px, 7vh, 80px);
}

.ab-sec__body {
  padding-top: clamp(36px, 6vh, 76px);
}
</style>
