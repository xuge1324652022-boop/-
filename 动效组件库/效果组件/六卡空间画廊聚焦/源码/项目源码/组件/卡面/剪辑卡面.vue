<template>
  <div class="cv cv-edit">
    <!-- Back layer — smallest pointer response (20 / 13 px). -->
    <div class="cv-edit__frames">
      <div class="cv-edit__frame cv-edit__frame--b" />
      <div class="cv-edit__frame cv-edit__frame--a">
        <span>VIDEO</span>
        <span>FRAME</span>
      </div>
    </div>

    <!-- Middle layer — the subject. Largest pointer response (55 / 36 px). -->
    <div class="cv-edit__type">
      <span class="cv-edit__letter cv-edit__letter--e">E</span>
      <span class="cv-edit__letter cv-edit__letter--d">D</span>
      <span class="cv-edit__letter cv-edit__letter--i">I</span>
      <span class="cv-edit__letter cv-edit__letter--t">T</span>
    </div>

    <!-- Front layer — medium pointer response (30 / 20 px). -->
    <div class="cv-edit__timeline">
      <div class="cv-edit__track" />
      <div class="cv-edit__clips">
        <span class="cv-edit__clip cv-edit__clip--a" />
        <span class="cv-edit__clip cv-edit__clip--b" />
        <span class="cv-edit__clip cv-edit__clip--c" />
      </div>
      <div class="cv-edit__playhead" />
      <span class="cv-edit__timecode">00:01:24:12</span>
    </div>

    <!-- Static frame of reference — movement 0, never animated. -->
    <div class="cv-edit__info">
      <span class="cv-edit__eyebrow">02</span>
      <span class="cv-edit__title">EDIT</span>
      <span class="cv-edit__lead">视频剪辑</span>
      <span class="cv-edit__role">VIDEO EDITOR</span>
    </div>
    <div class="cv-edit__words">
      <span>CUT</span>
      <span>SEQUENCE</span>
      <span>RHYTHM</span>
    </div>
  </div>
</template>

<!-- 静态卡面；动画仍由父级 CardVisual 的 cardAnimations 实例在同一后代节点上驱动。 -->
<style scoped>
/* ---- 02 / EDIT 剪辑 — Time / Sequence / Cut ---------------------- */

/* --- 后层：视频帧。只用两帧，在深度和高度上错开 --- */
.cv-edit__frames {
  position: absolute;
  inset: 0;
}
.cv-edit__frame {
  position: absolute;
  border: 1px solid rgba(241, 241, 236, 0.32);
}
.cv-edit__frame--a {
  right: 7%;
  top: 26%;
  width: 21%;
  height: 27%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.4vh;
  padding: 1.2vh 1vw;
}
.cv-edit__frame--a span {
  font-size: clamp(8px, 0.72vw, 12px);
  letter-spacing: 0.24em;
  color: rgba(241, 241, 236, 0.4);
}
/* 位置更靠后、更高 —— 不靠任何透视技巧就做出了深度。 */
.cv-edit__frame--b {
  right: 19%;
  top: 17%;
  width: 13%;
  height: 17%;
  border-color: rgba(241, 241, 236, 0.14);
}

/* --- 中层：巨型 EDIT。它是一串序列，不是一个logo。 ----------
   故意在水平方向上错开，并允许它冲出上下边缘 ——
   这种裁切本身就是构图，不是意外。 */
.cv-edit__type {
  position: absolute;
  inset: 0;
}
.cv-edit__letter {
  position: absolute;
  display: block;
  font-weight: 700;
  font-size: 30vh;
  line-height: 0.78;
  letter-spacing: -0.04em;
  color: rgba(241, 241, 236, 0.9);
  user-select: none;
}
.cv-edit__letter--e {
  left: 30%;
  top: -4%;
}
.cv-edit__letter--d {
  left: 38%;
  top: 21%;
}
.cv-edit__letter--i {
  left: 34%;
  top: 46%;
}
.cv-edit__letter--t {
  left: 45%;
  top: 71%;
}

/* --- 前层：抽象化的时间线。 -------------------------------------- */
.cv-edit__timeline {
  position: absolute;
  inset: 0;
}
.cv-edit__track {
  position: absolute;
  left: 8%;
  right: 8%;
  top: 64%;
  height: 1px;
  background: rgba(241, 241, 236, 0.22);
}
.cv-edit__clips {
  position: absolute;
  left: 8%;
  right: 8%;
  top: 67.5%;
}
.cv-edit__clip {
  position: absolute;
  height: 1.1vh;
  background: rgba(241, 241, 236, 0.5);
}
.cv-edit__clip--a {
  left: 2%;
  width: 17%;
}
.cv-edit__clip--b {
  left: 27%;
  width: 26%;
  background: rgba(241, 241, 236, 0.34);
}
.cv-edit__clip--c {
  left: 60%;
  width: 14%;
  background: rgba(241, 241, 236, 0.24);
}
.cv-edit__playhead {
  position: absolute;
  left: 46%;
  top: 58%;
  width: 1px;
  height: 12vh;
  background: #f1f1ec;
}
.cv-edit__timecode {
  position: absolute;
  left: 8%;
  top: 73%;
  font-size: clamp(8px, 0.7vw, 11px);
  letter-spacing: 0.22em;
  font-variant-numeric: tabular-nums;
  color: rgba(241, 241, 236, 0.34);
}

/* --- 静态参照框：永不移动。 -------------------------------------- */
.cv-edit__info {
  position: absolute;
  left: 9%;
  top: 11%;
  display: flex;
  flex-direction: column;
  gap: 1.1vh;
}
.cv-edit__eyebrow {
  font-size: clamp(9px, 0.82vw, 13px);
  letter-spacing: 0.3em;
  color: rgba(241, 241, 236, 0.34);
}
.cv-edit__title {
  font-size: clamp(12px, 1.3vw, 20px);
  letter-spacing: 0.22em;
  color: rgba(241, 241, 236, 0.72);
}
.cv-edit__lead {
  font-size: clamp(17px, 2.1vw, 32px);
  font-weight: 300;
  letter-spacing: 0.04em;
  color: rgba(241, 241, 236, 0.9);
}
.cv-edit__role {
  font-size: clamp(9px, 0.82vw, 13px);
  letter-spacing: 0.26em;
  color: rgba(241, 241, 236, 0.4);
}
.cv-edit__words {
  position: absolute;
  left: 9%;
  bottom: 8%;
  display: flex;
  gap: clamp(16px, 2vw, 40px);
  font-size: clamp(8px, 0.72vw, 12px);
  letter-spacing: 0.26em;
  color: rgba(241, 241, 236, 0.3);
}
</style>
