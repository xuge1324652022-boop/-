<template>
  <div class="cv cv-news">
    <!-- Back: ticker. Lowest visual weight, ~30 px/s, seamless. -->
    <div class="cv-news__ticker">
      <div class="cv-news__ticker-track">
        <span>NEWS</span><span>REPORT</span><span>UPDATE</span><span>NEWS</span><span>REPORT</span
        ><span>UPDATE</span>
      </div>
    </div>

    <!-- Mid-back: LIVE indicator (15 / 10 px). -->
    <div class="cv-news__live">
      <span class="cv-news__live-dot" />
      <span class="cv-news__live-label">LIVE</span>
      <span class="cv-news__live-time">09:42</span>
    </div>

    <!-- Mid: headline bar (23 / 14 px). -->
    <div class="cv-news__headline">
      <div class="cv-news__headline-bar" />
      <span class="cv-news__headline-text">LATEST UPDATE / FIELD REPORT</span>
    </div>

    <!-- Mid-front: one broadcast frame (30 / 22 px). -->
    <div class="cv-news__frames">
      <div class="cv-news__frame">
        <span class="cv-news__frame-label">NEWS FRAME</span>
        <div class="cv-news__frame-lower" />
      </div>
    </div>

    <!-- Front: giant NEWS (40 / 30 px). Clipped at the left edge. -->
    <div class="cv-news__type">
      <span class="cv-news__word">NEWS</span>
    </div>

    <!-- Static — never moves, never animates. -->
    <div class="cv-news__info">
      <span class="cv-news__eyebrow">04</span>
      <span class="cv-news__title">NEWS</span>
      <span class="cv-news__lead">新闻影像</span>
    </div>
    <div class="cv-news__dateline">
      <span>TOKYO / 2026</span>
      <span>09:42:16</span>
      <span>VIDEO REPORT</span>
    </div>
  </div>
</template>

<!-- 静态卡面；动画仍由父级 CardVisual 的 cardAnimations 实例在同一后代节点上驱动。 -->
<style scoped>
/* ---- 04 / NEWS 新闻影像 ----------------------------------------- */

/* --- 后层：跑马灯。视觉权重最低，也是唯一会自己动的元素。
       两半内容完全相同，因此位移 -50% 就能无缝循环；
       间距写在子项的 padding 里而**不是** flex gap，
       否则两半量出来的宽度不一致，循环就会出现跳帧。 --- */
.cv-news__ticker {
  position: absolute;
  left: 0;
  right: 0;
  top: 3.6%;
  overflow: hidden;
  padding: 0.7vh 0;
  border-top: 1px solid rgba(241, 241, 236, 0.07);
  border-bottom: 1px solid rgba(241, 241, 236, 0.07);
}
.cv-news__ticker-track {
  display: flex;
  width: max-content;
  will-change: transform;
}
.cv-news__ticker-track span {
  padding-right: clamp(30px, 3.6vw, 70px);
  font-size: clamp(8px, 0.72vw, 12px);
  letter-spacing: 0.34em;
  color: rgba(241, 241, 236, 0.22);
  white-space: nowrap;
}

/* --- 中后层：LIVE。整张卡唯一被允许用色的地方：一个
       直播中的圆点，小且去饱和，读起来像播报，而不是界面控件。 --- */
.cv-news__live {
  position: absolute;
  right: 9%;
  top: 13.5%;
  display: flex;
  align-items: center;
  gap: clamp(8px, 0.85vw, 15px);
}
.cv-news__live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(198, 74, 60, 0.95);
}
.cv-news__live-label {
  font-size: clamp(8px, 0.72vw, 11px);
  letter-spacing: 0.34em;
  color: rgba(241, 241, 236, 0.78);
}
.cv-news__live-time {
  font-size: clamp(8px, 0.72vw, 11px);
  letter-spacing: 0.2em;
  color: rgba(241, 241, 236, 0.34);
  font-variant-numeric: tabular-nums;
}

/* --- 中层：头条横条。一条可供擦除的横线，下方跟着新闻正文 ——
       这是「下三分之一字幕条」，不是标题块。 --- */
.cv-news__headline {
  position: absolute;
  inset: 0;
}
.cv-news__headline-bar {
  position: absolute;
  left: 9%;
  top: 64%;
  width: 30%;
  height: 2px;
  background: rgba(241, 241, 236, 0.55);
}
.cv-news__headline-text {
  position: absolute;
  left: 9%;
  top: 67.5%;
  font-size: clamp(9px, 0.86vw, 13px);
  letter-spacing: 0.28em;
  color: rgba(241, 241, 236, 0.6);
  white-space: nowrap;
}

/* --- 中前层：一个视频框。接近 16:9，发丝级描边，
       框内还有一条下三分之一字幕，好让它读起来像播报画面，而不是一个矩形。 --- */
.cv-news__frames {
  position: absolute;
  inset: 0;
}
.cv-news__frame {
  position: absolute;
  right: 11%;
  top: 25%;
  width: 33%;
  height: 38%;
  border: 1px solid rgba(241, 241, 236, 0.24);
  overflow: hidden;
}
.cv-news__frame-label {
  position: absolute;
  left: 6%;
  top: 6%;
  font-size: clamp(7px, 0.62vw, 10px);
  letter-spacing: 0.26em;
  color: rgba(241, 241, 236, 0.34);
}
.cv-news__frame-lower {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 9%;
  height: 13%;
  background: rgba(241, 241, 236, 0.07);
  border-left: 2px solid rgba(241, 241, 236, 0.5);
}

/* --- 前层：巨型 NEWS。向左偏移，好让 N 被边缘切掉。 --- */
.cv-news__type {
  position: absolute;
  inset: 0;
}
.cv-news__word {
  position: absolute;
  left: -3%;
  top: 40%;
  display: block;
  font-weight: 700;
  font-size: 26vh;
  line-height: 0.8;
  letter-spacing: -0.02em;
  color: rgba(241, 241, 236, 0.9);
  user-select: none;
  white-space: nowrap;
}

/* --- 静态：衡量其余一切的参照框。永不移动。 --- */
.cv-news__info {
  position: absolute;
  left: 9%;
  top: 10%;
  display: flex;
  flex-direction: column;
  gap: 1vh;
}
.cv-news__eyebrow {
  font-size: clamp(9px, 0.82vw, 13px);
  letter-spacing: 0.3em;
  color: rgba(241, 241, 236, 0.34);
}
.cv-news__title {
  font-size: clamp(12px, 1.3vw, 20px);
  letter-spacing: 0.22em;
  color: rgba(241, 241, 236, 0.72);
}
.cv-news__lead {
  font-size: clamp(17px, 2.1vw, 32px);
  font-weight: 300;
  letter-spacing: 0.04em;
  color: rgba(241, 241, 236, 0.9);
}
.cv-news__dateline {
  position: absolute;
  left: 9%;
  bottom: 7%;
  display: flex;
  gap: clamp(16px, 2vw, 40px);
  font-size: clamp(8px, 0.7vw, 11px);
  letter-spacing: 0.24em;
  color: rgba(241, 241, 236, 0.28);
}
.cv-news__dateline span {
  font-variant-numeric: tabular-nums;
}
</style>
