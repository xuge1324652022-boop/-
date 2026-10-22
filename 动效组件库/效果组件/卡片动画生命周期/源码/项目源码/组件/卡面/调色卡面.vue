<template>
  <div class="cv cv-color">
    <!-- Back layer — auxiliary structure, never the subject (20 / 12 px). -->
    <div class="cv-color__wheel" />

    <!-- Mid-back — one graded frame slice, not an image wall (28 / 20 px). -->
    <div class="cv-color__frames">
      <div class="cv-color__frame">
        <div class="cv-color__frame-grade" />
        <div class="cv-color__divider" />
        <span class="cv-color__frame-label cv-color__frame-label--before">BEFORE</span>
        <span class="cv-color__frame-label cv-color__frame-label--after">GRADE</span>
      </div>
    </div>

    <!-- Mid — tone curve, drawn once as vector (24 / 17 px). -->
    <div class="cv-color__curves">
      <div class="cv-color__curve-wrap">
        <svg class="cv-color__curve" viewBox="0 0 200 120" aria-hidden="true">
          <path d="M4 108 C 46 100, 62 74, 86 52 S 138 18, 196 8" />
          <circle cx="4" cy="108" r="2.4" />
          <circle cx="86" cy="52" r="2.4" />
          <circle cx="196" cy="8" r="2.4" />
        </svg>
      </div>
      <span class="cv-color__curve-label">TONE CURVE</span>
    </div>

    <!-- Mid-front — shadow → midtone → highlight (35 / 25 px). -->
    <div class="cv-color__strips">
      <div class="cv-color__strip" />
      <div class="cv-color__strip-labels">
        <span>SHADOW</span>
        <span>MIDTONE</span>
        <span>HIGHLIGHT</span>
      </div>
    </div>

    <!--
        素材层已整体退役（2026-09-23）。

        这里原来放着六段真实调色画面：藏在巨型 COLOR 字体后面、静止时完全
        隐藏，指针逼近某一片才把它从字后面拨出来。机制本身没问题 —— 问题在
        于**同一批素材在画廊和专属页各出现一次**：03 卡的铺满态与 `/color`
        首屏用的是同一套「邻近才现身」，于是同一件东西被看到两次，读起来像
        重复而不是呼应。

        所以素材只留在专属页（`/color`，见 ColorWave.vue）。画廊这一页回
        归纯粹的卡面构图：巨型 COLOR + 色条 + 胶片框 + 色调曲线 + 色轮，仍然
        是一幅只有指针才能打扰的构图。`verify-color-media.cjs` 改成断言这层
        不得复活。
      -->

    <!-- Front — the subject: giant COLOR (50 / 35 px). -->
    <div class="cv-color__type">
      <span class="cv-color__word">COLOR</span>
    </div>

    <!-- Static — never moves, never animates. -->
    <div class="cv-color__info">
      <span class="cv-color__eyebrow">03</span>
      <span class="cv-color__title">COLOR</span>
      <span class="cv-color__lead">调色</span>
      <span class="cv-color__sub">COLOR GRADING</span>
      <span class="cv-color__sub">FILM / TONE / IMAGE</span>
    </div>
    <div class="cv-color__params">
      <span><i>EXPOSURE</i><b>+0.35</b></span>
      <span><i>CONTRAST</i><b>+12</b></span>
      <span><i>SATURATION</i><b>-08</b></span>
    </div>
    <div class="cv-color__lut">
      <span>FILM LOOK</span>
      <span>LUT 01</span>
      <span>35MM</span>
      <span>LOG &rarr; REC709</span>
    </div>
  </div>
</template>

<!-- 静态卡面；动画仍由父级 CardVisual 的 cardAnimations 实例在同一后代节点上驱动。 -->
<style scoped>
/* ---- 03 / COLOR 调色 — Tone / Color / Grade ---------------------- */

/* --- 后层：一个非常大、非常淡的圆环。只是辅助结构 ——
       不发光、不泛光，永远不是主体。 --- */
.cv-color__wheel {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 54vh;
  height: 54vh;
  margin: -27vh 0 0 -27vh;
  border-radius: 50%;
  /* 只用胶片级的色相，而且极度去饱和：冷青 → 蓝 →
     紫 → 暖红 → 琥珀。透明度压在 0.15 左右，读起来是「色调」，
     而不是「界面颜色」。 */
  background: conic-gradient(
    from 210deg,
    rgba(88, 126, 148, 0.15),
    rgba(78, 92, 138, 0.15),
    rgba(112, 84, 128, 0.15),
    rgba(138, 82, 88, 0.15),
    rgba(158, 116, 74, 0.15),
    rgba(88, 126, 148, 0.15)
  );
  -webkit-mask: radial-gradient(circle, transparent 56%, #000 57%);
  mask: radial-gradient(circle, transparent 56%, #000 57%);
  opacity: 0.6;
}

/* --- 中后层：一片调过色的画面切片。是单帧，不是一整面墙。 --- */
.cv-color__frames {
  position: absolute;
  inset: 0;
}
.cv-color__frame {
  position: absolute;
  left: 8%;
  top: 30%;
  width: 26%;
  height: 33%;
  border: 1px solid rgba(241, 241, 236, 0.22);
  overflow: hidden;
}
.cv-color__frame-grade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(66, 92, 112, 0.5) 0%,
    rgba(122, 118, 112, 0.42) 48%,
    rgba(168, 128, 84, 0.5) 100%
  );
}
/* 这条分割线是一个空间记号，不是前后对比滑块 —— 没有拖拽手柄。 */
.cv-color__divider {
  position: absolute;
  left: 55%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(241, 241, 236, 0.6);
}
.cv-color__frame-label {
  position: absolute;
  bottom: 1.1vh;
  font-size: clamp(7px, 0.62vw, 10px);
  letter-spacing: 0.24em;
  color: rgba(241, 241, 236, 0.42);
}
.cv-color__frame-label--before {
  left: 7%;
}
.cv-color__frame-label--after {
  left: 61%;
}

/* --- 中层：色调曲线。矢量图形，只画一次，从不重绘。 --- */
.cv-color__curves {
  position: absolute;
  inset: 0;
}
.cv-color__curve-wrap {
  position: absolute;
  right: 10%;
  top: 60%;
  width: 22%;
  height: 18%;
}
.cv-color__curve {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.cv-color__curve path {
  fill: none;
  stroke: rgba(241, 241, 236, 0.5);
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
}
.cv-color__curve circle {
  fill: #f1f1ec;
  opacity: 0.55;
}
.cv-color__curve-label {
  position: absolute;
  right: 10%;
  top: 79%;
  font-size: clamp(7px, 0.62vw, 10px);
  letter-spacing: 0.26em;
  color: rgba(241, 241, 236, 0.34);
}

/* --- 中前层：暗部 → 中间调 → 高光。这是整张卡唯一
       被允许带颜色的地方，即便如此也保持胶片感。 --- */
.cv-color__strips {
  position: absolute;
  inset: 0;
}
.cv-color__strip {
  position: absolute;
  left: 8%;
  top: 68%;
  width: 52%;
  height: 1.4vh;
  background: linear-gradient(
    90deg,
    rgba(72, 108, 132, 0.55) 0%,
    rgba(120, 128, 134, 0.5) 30%,
    rgba(150, 148, 144, 0.5) 52%,
    rgba(176, 138, 92, 0.55) 78%,
    rgba(186, 148, 96, 0.55) 100%
  );
}
.cv-color__strip-labels {
  position: absolute;
  left: 8%;
  top: 71.5%;
  width: 52%;
  display: flex;
  justify-content: space-between;
  font-size: clamp(7px, 0.62vw, 10px);
  letter-spacing: 0.24em;
  color: rgba(241, 241, 236, 0.34);
}

/* --- 前层：巨型 COLOR。向右偏移，好让 R 冲出边缘。 --- */
.cv-color__type {
  position: absolute;
  inset: 0;
}
.cv-color__word {
  position: absolute;
  right: -4%;
  top: 24%;
  display: block;
  font-weight: 700;
  font-size: 24vh;
  line-height: 0.8;
  letter-spacing: -0.02em;
  color: rgba(241, 241, 236, 0.92);
  user-select: none;
  white-space: nowrap;
}

/* --- 静态：永不移动，永不做动画。 --- */
.cv-color__info {
  position: absolute;
  left: 9%;
  top: 10%;
  display: flex;
  flex-direction: column;
  gap: 1vh;
}
.cv-color__eyebrow {
  font-size: clamp(9px, 0.82vw, 13px);
  letter-spacing: 0.3em;
  color: rgba(241, 241, 236, 0.34);
}
.cv-color__title {
  font-size: clamp(12px, 1.3vw, 20px);
  letter-spacing: 0.22em;
  color: rgba(241, 241, 236, 0.72);
}
.cv-color__lead {
  font-size: clamp(17px, 2.1vw, 32px);
  font-weight: 300;
  letter-spacing: 0.04em;
  color: rgba(241, 241, 236, 0.9);
}
.cv-color__sub {
  font-size: clamp(8px, 0.72vw, 12px);
  letter-spacing: 0.26em;
  color: rgba(241, 241, 236, 0.38);
}
.cv-color__params {
  position: absolute;
  left: 9%;
  bottom: 15%;
  display: flex;
  flex-direction: column;
  gap: 0.7vh;
  font-size: clamp(8px, 0.7vw, 11px);
  letter-spacing: 0.2em;
}
.cv-color__params span {
  display: flex;
  gap: 1.4vw;
}
.cv-color__params i {
  font-style: normal;
  color: rgba(241, 241, 236, 0.34);
}
.cv-color__params b {
  font-weight: 400;
  color: rgba(241, 241, 236, 0.6);
  font-variant-numeric: tabular-nums;
}
.cv-color__lut {
  position: absolute;
  left: 9%;
  bottom: 6%;
  display: flex;
  gap: clamp(14px, 1.8vw, 34px);
  font-size: clamp(7px, 0.62vw, 10px);
  letter-spacing: 0.24em;
  color: rgba(241, 241, 236, 0.28);
}
</style>
