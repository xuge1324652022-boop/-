<template>
  <div class="placeholder">
    <section class="placeholder__cover">
      <span class="placeholder__number">{{ id }}</span>
      <p class="placeholder__hint">占位页 · /card/{{ id }}</p>
      <RouterLink v-if="id === '01'" class="placeholder__enter" to="/about">
        进入聊天 FAQ →
      </RouterLink>
    </section>
    <WorkContinuation :next="id === '02' ? 'color' : 'poster'" />
  </div>
</template>

<script setup lang="ts">
/** 未匹配专属章节的兼容入口；六个正式章节由路由与 jumpPathFor 分流到实际页面。 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import WorkContinuation from '../components/WorkContinuation.vue'
import { markSubpageVisit } from '../composables/useTransition'

// 路由 /card/:id 通过 props: true 把 id 直接传进来，
// 兜底再读一次 route.params，两种方式都能拿到
const props = defineProps<{ id?: string }>()
const route = useRoute()

const id = computed(() => props.id ?? String(route.params.id ?? ''))

/*
 * 留下「本次会话刚显示过这个子页」的痕迹。
 *
 * 画廊靠它把「刷新 `/`」和「从子页后退回来」分开 —— 单看
 * history.state.forward 分不开：forward 写在历史条目上，刷新后仍在，
 * 于是去过一次子页后刷新 `/` 就会误判成"刚从子页退回"，开场动画被永久
 * 跳过。面包屑读一次即删，刷新 `/` 时已经没了。详见 useTransition.ts。
 */
markSubpageVisit(id.value)

</script>

<style scoped>
.placeholder {
  position: relative;
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
  overflow-x: clip;
}
.placeholder__cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100svh;
}

/* 背景居中超大编号。clamp 的下限锁在 20vw，小屏也不会缩到看不见 */
.placeholder__number {
  font-weight: 700;
  line-height: 0.8;
  letter-spacing: 0.02em;
  font-size: clamp(20vw, 40vw, 68vh);
  color: rgba(255, 255, 255, 0.14);
  user-select: none;
  pointer-events: none;
}

.placeholder__hint {
  margin: 18px 0 0;
  font-size: 13px;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.45);
}

.placeholder__enter {
  display: inline-block;
  margin-top: 18px;
  padding: 12px 22px;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: #0a0a0a;
  text-decoration: none;
  background: #ffd700;
  border-radius: 0;
  cursor: pointer;
  transition: filter 0.25s ease;
}
.placeholder__enter:hover {
  filter: brightness(1.1);
}
</style>
