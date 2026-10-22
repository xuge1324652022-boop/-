<template>
  <!--
    站点首页（路由 `/`）：Preloader 撕裂开场与 ThreeHome 的 CSS 3D 画廊。
    从子页后退时恢复已展开的卡片，普通进入才播放开场；`/cards` 是独立列表入口。
  -->
  <div class="gallery-view">
    <Preloader v-if="showPreloader" @complete="onPreloaderComplete" />
    <ThreeHome :restore-index="restoreIndex" :preloader-done="!showPreloader" :auto-enter-about="autoEnterAbout" />
  </div>
</template>

<script setup lang="ts">
/** 本层负责判断进入来源；卡片几何、拖动和章节动画由 ThreeHome 持有。 */
import { ref } from 'vue'
import Preloader from '../components/Preloader.vue'
import ThreeHome from '../components/ThreeHome.vue'
import {
  consumeSubpageVisit,
  galleryLeavePosition,
  inAppNavigation,
  lastFocusedCard,
} from '../composables/useTransition'

/*
 * 这次进 `/` 是不是「浏览器后退回来的」？
 *
 * vue-router 给每条历史记录写了自增的 position。后退会回到更早的条目，
 * 所以当前 position ≤ 离开时记下的 position；而程序化导航（占位页的
 * 「← 返回作品集」）是新推一条，position 更大 —— 那种情况仍走完整开场。
 *
 * 是后退就把离开前铺满全屏的那张卡交给 ThreeHome，让它重新展开、铺满；
 * 不是就走正常开场。
 */
const historyState = window.history.state as
  | { position?: number; forward?: string | null }
  | null
const currentPosition = historyState?.position ?? null
const isBack =
  galleryLeavePosition.value !== null &&
  currentPosition !== null &&
  currentPosition <= galleryLeavePosition.value

/*
 * 兜底：就算内存态丢了（典型场景 —— 在子页上刷新过，再按后退），
 * 也还能认出「刚从哪个卡片子页退回来」。
 *
 * 跨文档恢复必须同时有 back_forward 类型和子页面包屑；SPA 后退由上方
 * isBack 接管。普通 navigate/reload 不用旧面包屑的位置关系猜测返回，
 * 否则遗留记录会阻止首页开场及自动进入关于我。
 *
 * ⚠️ 面包屑存的是**规范卡号**（'01'..'06'）而不是路径 —— 因为
 *    03 的专属页是 `/color`、01/05/06 又分别是 `/about` / `/poster` / `/photo`。
 *    按路径反推就得为每个专属页写一个分支，将来每加一个专属页都要改这里一次。
 *    现在卡号统一，这里只要求「上一个显示过的页面是个**子页**」，卡号直接读。
 *
 * ⚠️ 新增专属页时**只需**在 `useTransition.ts` 的 `CHAPTER_PATHS` 加一行、
 *    并让新子页调 `markSubpageVisit(新卡号)` —— 这里不再有需要同步的路由集合
 *    （旧版这里有一份 `/card/NN|/color|/about|/photo|/poster` 的正则，就是
 *    漏改它会「子页刷新后按后退、回首页却重播开场」，所以整条判据都换掉了）。
 */
const lastSubpage = consumeSubpageVisit()

/** 这个文档是不是浏览器「后退/前进」加载出来的（跨文档导航才有效）。 */
const navigationType = (
  performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
)?.type
const documentIsBackForward = navigationType === 'back_forward'

const restoreIndex =
  isBack && lastFocusedCard.value !== null
    ? lastFocusedCard.value
    : lastSubpage !== null && documentIsBackForward
      ? Number(lastSubpage.id) - 1
      : null

// 预加载动画是否还在显示。它撕开之后，下面的画廊才会露出来
// ?galleryDebug=1 时直接跳过 —— ThreeHome 会用 cancelBoot() 接管 state，
// 但 Preloader 是 GalleryView 的子组件，没人来卸载它，整屏就被黄幕
// 永久盖住。直接不渲染即可，省得它占着 z-index 9999 永不退出。
// 后退回来时同样跳过：开场是第一阶段，重放一遍等于把人踢回起点，
// 取而代之的是 ThreeHome 里那张卡的「展开 → 铺满全屏」。
const isDebug = new URLSearchParams(location.search).has('galleryDebug')
const showPreloader = ref(!isDebug && restoreIndex === null)
// 每次正常打开或刷新都引导；实际返回和应用内导航继续由历史恢复接管。
const autoEnterAbout = !isDebug && restoreIndex === null &&
  !documentIsBackForward && !inAppNavigation.value

// 预加载动画播完：卸载它，把舞台交给画廊
function onPreloaderComplete() {
  showPreloader.value = false
}
</script>

<style scoped>
/*
  作品集是全屏体验，需要自己锁死视口高度。
  App 根容器使用 min-height 兼容长子页，首页需要在本层独立限制视口。
*/
.gallery-view {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #0a0a0a;
}
</style>
