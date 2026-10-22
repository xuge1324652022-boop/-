<template>
  <div class="cv cv-poster">
    <!-- Back: layout grid (16 / 12 px). Five verticals, three horizontals,
           and they stop short of the edges so they read as guides, not as a
           CSS grid background. -->
    <div class="cv-poster__grid">
      <span
        v-for="x in [14, 32, 50, 68, 86]"
        :key="'v' + x"
        class="cv-poster__vline"
        :style="{ left: x + '%' }"
      />
      <span
        v-for="y in [22, 46, 72]"
        :key="'h' + y"
        class="cv-poster__hline"
        :style="{ top: y + '%' }"
      />
    </div>

    <!-- Mid-back: giant POSTER (46 / 30 px). Cut by the left edge; its tail
           runs under the printed sheet, so moving the pointer slides it out
           from behind the artwork. -->
    <div class="cv-poster__type">
      <span class="cv-poster__word">POSTER</span>
    </div>

    <!-- Front: one printed sheet (33 / 24 px). Off-centre, cropped by the
           right edge. The only high-contrast element on the card — every
           colour here is meant to come from the artwork itself. -->
    <div class="cv-poster__plate">
      <div class="cv-poster__art">
        <span class="cv-poster__art-kicker">POSTER</span>
        <span class="cv-poster__art-year">2026</span>
        <span class="cv-poster__art-title">VISUAL<br />STUDY</span>
        <span class="cv-poster__art-foot">GRAPHIC / 01</span>
      </div>
    </div>

    <!-- Crop + registration marks (22 / 15 px). Print furniture sitting
           outside the trim, never a frame around anything. -->
    <div class="cv-poster__marks">
      <span class="cv-poster__crop cv-poster__crop--tl" />
      <span class="cv-poster__crop cv-poster__crop--bl" />
      <span class="cv-poster__crop cv-poster__crop--tr" />
      <span class="cv-poster__reg" />
    </div>

    <!-- Static: the caption block. Never moves, never animates. -->
    <div class="cv-poster__info">
      <span class="cv-poster__eyebrow">05</span>
      <span class="cv-poster__title">POSTER</span>
      <span class="cv-poster__lead">海报设计</span>
    </div>
    <div class="cv-poster__series"><span>01</span><span>02</span><span>03</span></div>
    <div class="cv-poster__meta">
      <span>GRAPHIC DESIGN</span>
      <span>VISUAL STUDY</span>
      <span>2026</span>
    </div>
  </div>
</template>

<!-- 静态卡面；动画仍由父级 CardVisual 的 cardAnimations 实例在同一后代节点上驱动。 -->
<style scoped>
/* ---- 05 / POSTER 海报设计 --------------------------------------- */

/* --- 后层：版式网格。透明度压在 0.12，好让它读起来像
       设计师留在板子上的参考线，而不是背景花纹。 --- */
.cv-poster__grid {
  position: absolute;
  inset: 0;
  opacity: 0.12;
}
.cv-poster__vline,
.cv-poster__hline {
  position: absolute;
  background: #f1f1ec;
}
.cv-poster__vline {
  top: 6%;
  bottom: 20%;
  width: 1px;
}
.cv-poster__hline {
  left: 5%;
  right: 18%;
  height: 1px;
}

/* --- 中后层：巨型 POSTER。被左边缘裁切。 --- */
.cv-poster__type {
  position: absolute;
  inset: 0;
}
.cv-poster__word {
  position: absolute;
  left: -6%;
  top: 52%;
  display: block;
  font-weight: 700;
  font-size: 30vh;
  line-height: 0.8;
  letter-spacing: -0.03em;
  color: rgba(241, 241, 236, 0.94);
  user-select: none;
  white-space: nowrap;
}

/* --- 前层：一张印刷印张。故意偏离中心，并被卡片右边缘裁切，
       这样它读起来像一块板子，而不是一幅装了框的画。 --- */
.cv-poster__plate {
  position: absolute;
  right: -8%;
  top: 13%;
  width: 38%;
  height: 56%;
  background-color: #e9e7e2;
  overflow: hidden;
}
.cv-poster__art {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 9%;
  color: #14140f;
}
.cv-poster__art-kicker {
  font-size: clamp(8px, 0.72vw, 12px);
  letter-spacing: 0.32em;
  color: rgba(20, 20, 15, 0.6);
}
/* `margin-top: auto` 把「年份 / 标题 / 页脚」这一组推到印张底部 ——
   经典的编辑式堆叠：引题在上，陈述在下。 */
.cv-poster__art-year {
  margin-top: auto;
  font-size: clamp(9px, 0.9vw, 15px);
  letter-spacing: 0.24em;
  color: rgba(20, 20, 15, 0.55);
}
.cv-poster__art-title {
  margin-top: 1.2vh;
  font-weight: 700;
  font-size: clamp(26px, 4.6vw, 74px);
  line-height: 0.86;
  letter-spacing: -0.02em;
}
.cv-poster__art-foot {
  margin-top: 1.4vh;
  font-size: clamp(7px, 0.62vw, 10px);
  letter-spacing: 0.28em;
  color: rgba(20, 20, 15, 0.45);
}

/* --- 裁切标记 + 套准标记。每个 L 都离开裁切线 10px，
       一整个标记宽 1.4vw：这是印刷业的工装，不是装饰。 --- */
.cv-poster__marks {
  position: absolute;
  inset: 0;
}
.cv-poster__crop {
  position: absolute;
  width: 1.4vw;
  height: 1.4vw;
}
.cv-poster__crop--tl {
  left: 70%;
  top: 13%;
  transform: translate(calc(-100% - 10px), calc(-100% - 10px));
  border-left: 1px solid rgba(241, 241, 236, 0.42);
  border-top: 1px solid rgba(241, 241, 236, 0.42);
}
.cv-poster__crop--bl {
  left: 70%;
  top: 69%;
  transform: translate(calc(-100% - 10px), 10px);
  border-left: 1px solid rgba(241, 241, 236, 0.42);
  border-bottom: 1px solid rgba(241, 241, 236, 0.42);
}
.cv-poster__crop--tr {
  left: 73%;
  top: 52%;
  transform: translate(10px, calc(-100% - 10px));
  border-right: 1px solid rgba(241, 241, 236, 0.42);
  border-top: 1px solid rgba(241, 241, 236, 0.42);
}
.cv-poster__reg {
  position: absolute;
  left: 70%;
  top: 41%;
  width: 12px;
  height: 12px;
  transform: translate(calc(-100% - 14px), -50%);
}
.cv-poster__reg::before,
.cv-poster__reg::after {
  content: '';
  position: absolute;
  background: rgba(241, 241, 236, 0.55);
}
.cv-poster__reg::before {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
}
.cv-poster__reg::after {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
}

/* --- 静态：说明文字块。永不移动，永不做动画。 --- */
.cv-poster__info {
  position: absolute;
  left: 8%;
  top: 9%;
  display: flex;
  flex-direction: column;
  gap: 1vh;
}
.cv-poster__eyebrow {
  font-size: clamp(9px, 0.82vw, 13px);
  letter-spacing: 0.3em;
  color: rgba(241, 241, 236, 0.34);
}
.cv-poster__title {
  font-size: clamp(12px, 1.3vw, 20px);
  letter-spacing: 0.22em;
  color: rgba(241, 241, 236, 0.72);
}
.cv-poster__lead {
  font-size: clamp(17px, 2.1vw, 32px);
  font-weight: 300;
  letter-spacing: 0.04em;
  color: rgba(241, 241, 236, 0.9);
}
.cv-poster__series {
  position: absolute;
  left: 79%;
  top: 72%;
  display: flex;
  gap: clamp(10px, 1.1vw, 22px);
  font-size: clamp(7px, 0.62vw, 10px);
  letter-spacing: 0.26em;
  color: rgba(241, 241, 236, 0.32);
}
.cv-poster__series span:first-child {
  color: rgba(241, 241, 236, 0.72);
}
.cv-poster__meta {
  position: absolute;
  left: 8%;
  bottom: 8%;
  display: flex;
  gap: clamp(14px, 1.8vw, 34px);
  font-size: clamp(8px, 0.7vw, 11px);
  letter-spacing: 0.24em;
  color: rgba(241, 241, 236, 0.3);
}
</style>
