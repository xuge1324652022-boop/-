<template>
  <!--
    DEMO —— 圆、平行线与折线组成的中性几何结构，不含姓名字母。

    全部参数集中在 GEO 里，方便整体调构图；描边只有两种粗细（主结构 / 辅助），
    填充弱到几乎看不见 —— 静态时它是「线条为主」的。

    三条水平扫描线的可见区域由 mask 限定为图形本身：它们只在结构内部亮起，
    不会在背景上留下痕迹。三条线的周期彼此不成整数比，相位也错开，
    所以永远不会对齐成一条「节拍」。
  -->
  <svg
    class="demo"
    :viewBox="`0 0 ${GEO.w} ${GEO.h}`"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <!--
        mask 是扫描线的「可见区域」：描边处最亮（100% 白），填充内略暗
        （约 18% 灰）—— 扫描线扫过填充区是一条若隐若现的暗线，经过描边
        时才亮起，符合规格「只在图形内部显示」+「弱填充」的层次。
        描边宽度比实际结构粗一圈（4 vs 1.4），给扫描线一点可见宽度。
      -->
      <mask :id="maskId">
        <g stroke="#fff" stroke-width="4" stroke-linecap="butt">
          <circle
            :cx="GEO.circle.cx"
            :cy="GEO.circle.cy"
            :r="GEO.circle.r"
            fill="#666"
          />
          <line
            v-for="(l, i) in GEO.bars"
            :key="`bar-${i}`"
            :x1="l.x1"
            :y1="l.y1"
            :x2="l.x2"
            :y2="l.y2"
            fill="none"
          />
          <path :d="GEO.stem" fill="none" />
          <path :d="GEO.fork" fill="none" />
        </g>
      </mask>
    </defs>

    <!-- 结构本体 -->
    <g class="demo__structure">
      <!-- 圆：弱填充，几乎是空的 -->
      <circle
        class="demo__circle"
        :cx="GEO.circle.cx"
        :cy="GEO.circle.cy"
        :r="GEO.circle.r"
      />
      <!-- X：两条对角线 -->
      <line
        v-for="(l, i) in GEO.bars"
        :key="`x-${i}`"
        class="demo__bar"
        :x1="l.x1"
        :y1="l.y1"
        :x2="l.x2"
        :y2="l.y2"
      />
      <!-- Y：竖干 + 分叉 -->
      <path class="demo__stem" :d="GEO.stem" />
      <path class="demo__fork" :d="GEO.fork" />
      <!-- 一条基准细线：把整组结构压在一个可读的水平面上 -->
      <line
        class="demo__base"
        :x1="GEO.base.x1"
        :y1="GEO.base.y"
        :x2="GEO.base.x2"
        :y2="GEO.base.y"
      />
    </g>

    <!-- 三条扫描线：只在图形内部可见 -->
    <g :mask="`url(#${maskId})`">
      <rect
        v-for="(s, i) in GEO.scans"
        :key="`scan-${i}`"
        class="demo__scan"
        :class="`demo__scan--${i + 1}`"
        :x="0"
        :y="s.y"
        :width="s.width"
        :height="s.height"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { useId } from 'vue'
/*
 * 构图参数。全都在 240×240 的 viewBox 里定义，改这里就能整体重排。
 *
 * 关系说明：
 *   · 圆偏左、最大 —— 它是主体
 *   · X 偏右、中等 —— 与圆的右缘相交，两条对角线穿过圆内
 *   · Y 从圆心正下方长出 —— 竖干起于圆心，分叉落在基准线上
 *   · 基准细线横贯全图，把三者锚在同一个水平面上
 */
const GEO = {
  w: 240,
  h: 240,
  circle: { cx: 104, cy: 116, r: 70 },
  // 两条平行水平线
  bars: [
    { x1: 132, y1: 92, x2: 210, y2: 92 },
    { x1: 132, y1: 140, x2: 210, y2: 140 },
  ],
  // 开放的矩形与折线，保持扫描遮罩的层次
  stem: 'M50 188 L50 164 L112 164 L112 188',
  fork: 'M144 178 L170 160 L196 178',
  base: { x1: 24, y: 196, x2: 216 },
  // 三条扫描线：高度、宽度、基准 y 各不相同
  scans: [
    { y: 78, width: 52, height: 2 },
    { y: 112, width: 38, height: 2 },
    { y: 158, width: 64, height: 2 },
  ],
} as const

/*
 * SVG 的 mask id 必须文档唯一。useId跨组件实例分配标识，避免扫描线串用遮罩。
 */
const maskId = `demo-scan-${useId()}`
</script>

<style scoped>
.demo {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* --- 结构本体：线条为主，弱填充 --- */
.demo__circle {
  fill: rgba(241, 241, 236, 0.035);
  stroke: rgba(241, 241, 236, 0.62);
  stroke-width: 1.4;
}
.demo__bar {
  stroke: rgba(241, 241, 236, 0.5);
  stroke-width: 1.2;
}
.demo__stem {
  stroke: rgba(241, 241, 236, 0.58);
  stroke-width: 1.4;
}
.demo__fork {
  stroke: rgba(241, 241, 236, 0.44);
  stroke-width: 1.2;
}
/* 辅助线：比主结构弱一档，只用来锚定水平面 */
.demo__base {
  stroke: rgba(241, 241, 236, 0.22);
  stroke-width: 0.8;
}

/* --- 扫描线：机械、匀速、无限循环 --- */
/*
 * 三条线的周期刻意取成彼此不成整数比（4.2 / 5.6 / 7.1），相位也用负的
 * delay 错开，于是它们永远不会同时回到起点 —— 眼睛看不出重复的节拍。
 * ease 用 linear：这是「扫描」，不是「弹出」，任何 ease 都会显得在讨好观众。
 */
.demo__scan {
  fill: rgba(241, 241, 236, 0.92);
  animation: demo-scan 4.2s linear infinite;
}
.demo__scan--2 {
  animation-duration: 5.6s;
  animation-delay: -1.4s;
}
.demo__scan--3 {
  animation-duration: 7.1s;
  animation-delay: -2.9s;
}

@keyframes demo-scan {
  from {
    transform: translateX(-72px);
  }
  to {
    transform: translateX(248px);
  }
}

/* 开启「减少动态效果」时扫描停住：一条静止的线仍然是构图的一部分 */
@media (prefers-reduced-motion: reduce) {
  .demo__scan {
    animation: none;
    opacity: 0.5;
  }
}
</style>
