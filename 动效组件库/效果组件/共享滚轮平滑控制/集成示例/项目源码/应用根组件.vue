<template>
  <div id="app">
    <!--
      路由出口：首页画廊、卡片列表和六个子页随路由切换而销毁重建。
      幕布仍在揭开时保持 inert，避免可见但尚未解锁的页面接收点击或焦点。
    -->
    <div class="route-stage" :inert="routeCurtainActive"><RouterView /></div>

    <!--
      全站唯一幕布持有在路由之外，覆盖、等待目标就绪和弧形揭幕连续播放。
    -->
    <PageCurtain ref="curtain" :active="routeCurtainActive" :title="curtainTitle" />

    <!--
      跳转失败的出口。
         没有它，用户只能对着一块近黑底的旧页面干等 —— 这是「黑屏」里最坏的部分：
         屏幕是黑的、地址停在首页、控制台之外没有任何提示、也没有任何可点的东西。
         `role="alert"` 让读屏立刻念出来；z-index 压过弧形幕（10005），
         因为超时那条路径上幕布还挂着。
    -->
    <div v-if="jumpError" class="nav-error" role="alert">
      <span class="nav-error__text">{{ jumpError }}</span>
      <button type="button" class="nav-error__btn" @click="reloadPage">刷新重试</button>
    </div>

    <!--
      局部动作光标与索引：挂在路由外，页面切换时保持反馈连续。
      子页之间切换时不销毁索引组件，避免 Teleport 的离场节点遗留在 body。
    -->
    <CustomCursor />
    <SubpageIndex v-if="isSubpage" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import PageCurtain from './组件/页面幕布.vue'
import CustomCursor from './组件/自定义光标.vue'
import SubpageIndex from './组件/子页作品索引.vue'
import { useSmoothScroll } from './组合函数/平滑滚动控制'
import { routeCurtainActive } from './组合函数/页面幕布控制'
import { useRouteCurtainNavigation } from './组合函数/路由幕布导航'

const router = useRouter()
const route = useRoute()
const isSubpage = computed(() =>
  ['/about', '/edit', '/news', '/color', '/poster', '/photo'].includes(route.path),
)
const curtain = ref<InstanceType<typeof PageCurtain> | null>(null)
const { curtainTitle, jumpError, reloadPage } = useRouteCurtainNavigation({ router, curtain })
// Color 的首屏进度闸门由该页自己的控制器消费，避免重复接管滚轮。
useSmoothScroll(
  undefined,
  () => isSubpage.value && route.path !== '/color' && !routeCurtainActive.value,
)
</script>

<style>
/* 全局重置与字体已由 src/style.css 提供，这里只保留本页根容器 + 遮罩。 */
#app {
  position: relative;
  width: 100%;
  /*
    改成了 min-height：作品集自己会锁 100vh，
    而卡片列表页需要能滚动，根容器不能再写死高度 + overflow: hidden。
  */
  min-height: 100vh;
  background: #0a0a0a;
}

/* ========== 全局转场输入锁 ========== */
html.page-turn-lock {
  overflow: hidden;
  cursor: wait;
}
html.page-turn-lock body {
  overflow: hidden;
}

/* ========== 跳转失败的出口 ========== */
/*
 * ⚠️ 刻意用**白底深字**，不跟站点色板走。
 *    它要同时出现在两种底色上：铺满全屏的 03 卡（近黑底）和 /color 的白底。
 *    一个「反色」的告警条是唯一在两边都一眼可见的做法 —— 这里可读性优先于统一感。
 */
.nav-error {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  /* 压过装载幕（10001）：超时那条路径上幕布还挂着 */
  z-index: 10010;
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: min(680px, calc(100vw - 40px));
  padding: 14px 18px;
  border-radius: 6px;
  background: #fff;
  color: #111;
  font-size: 13px;
  line-height: 1.5;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
}

.nav-error__text {
  flex: 1;
  min-width: 0;
}

.nav-error__btn {
  flex: none;
  appearance: none;
  padding: 8px 14px;
  border: 1px solid #111;
  border-radius: 4px;
  background: #111;
  color: #fff;
  font: inherit;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}
.nav-error__btn:hover {
  background: #333;
  border-color: #333;
}
.nav-error__btn:focus-visible {
  outline: 2px solid #111;
  outline-offset: 3px;
}
</style>
