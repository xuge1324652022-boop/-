<template>
  <div class="cv cv-photo">
    <!-- Mount frame (22 / 15 px), plus the single whisper of light. -->
    <div class="cv-photo__frame">
      <span class="cv-photo__frame-box" />
      <span class="cv-photo__light" />
    </div>

    <!-- The photograph (30 / 22 px). Right of centre — never dead-centre. -->
    <div class="cv-photo__image">
      <div class="cv-photo__plate">
        <span class="cv-photo__plate-label">PLACEHOLDER</span>
      </div>
    </div>

    <!-- Focus mark + capture metadata (8 / 6 px): the smallest movement
           on the card, so the annotations feel pinned to the wall. -->
    <div class="cv-photo__meta">
      <span class="cv-photo__mark" />
      <span class="cv-photo__exif">35MM</span>
      <span class="cv-photo__archive">PHOTO / 01</span>
      <span class="cv-photo__year">2026</span>
    </div>

    <!-- Title (15 / 10 px): a caption beside the work, not the subject.
           Deliberately mid-size — this card belongs to the photograph. -->
    <div class="cv-photo__type">
      <span class="cv-photo__word">PHOTO</span>
    </div>

    <!-- Static: never moves, never animates. -->
    <div class="cv-photo__info">
      <span class="cv-photo__eyebrow">06</span>
      <span class="cv-photo__lead">摄影</span>
    </div>
    <span class="cv-photo__note">FRAME / LIGHT</span>
  </div>
</template>

<!-- 静态卡面；动画仍由父级 CardVisual 的 cardAnimations 实例在同一后代节点上驱动。 -->
<style scoped>
/* ---- 06 / PHOTO 摄影 -------------------------------------------- */

/* --- 卡纸框。一条落在照片外 8px 的发丝线，加下方一道短光线。
       这就是全部用来「画」的语汇。 --- */
.cv-photo__frame {
  position: absolute;
  inset: 0;
}
.cv-photo__frame-box {
  position: absolute;
  right: calc(14% - 8px);
  top: calc(26% - 8px);
  width: calc(35% + 16px);
  height: calc(45% + 16px);
  border: 1px solid rgba(241, 241, 236, 0.62);
  opacity: 0.6;
}
.cv-photo__light {
  position: absolute;
  right: 14%;
  top: calc(71% + 26px);
  width: 20%;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(241, 241, 236, 0) 0%,
    rgba(241, 241, 236, 0.32) 45%,
    rgba(241, 241, 236, 0) 100%
  );
}

/* --- 照片本体。偏右，是这张卡上唯一允许承载图像的东西。
       在真实照片载入之前，它就是暗房里一张空白的相纸；
       setMedia() 会把照片直接放进去。 --- */
.cv-photo__image {
  position: absolute;
  inset: 0;
}
.cv-photo__plate {
  position: absolute;
  right: 14%;
  top: 26%;
  width: 35%;
  height: 45%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: #141413;
  background-image: radial-gradient(
    120% 88% at 50% 32%,
    rgba(241, 241, 236, 0.055) 0%,
    rgba(241, 241, 236, 0) 68%
  );
}
.cv-photo__plate-label {
  font-size: clamp(7px, 0.62vw, 10px);
  letter-spacing: 0.34em;
  color: rgba(241, 241, 236, 0.16);
}

/* --- 对焦标记与拍摄参数。标记居中落在照片下方 ——
       这是取景提示，不是十字准星。 --- */
.cv-photo__meta {
  position: absolute;
  inset: 0;
}
.cv-photo__mark {
  position: absolute;
  left: 68.5%;
  top: 75.5%;
  width: 11px;
  height: 11px;
  transform: translate(-50%, -50%);
}
.cv-photo__mark::before,
.cv-photo__mark::after {
  content: '';
  position: absolute;
  background: rgba(241, 241, 236, 0.6);
}
.cv-photo__mark::before {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
}
.cv-photo__mark::after {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
}
.cv-photo__exif,
.cv-photo__archive,
.cv-photo__year {
  position: absolute;
  right: 14%;
  font-size: clamp(8px, 0.7vw, 11px);
  letter-spacing: 0.24em;
  color: rgba(241, 241, 236, 0.32);
}
.cv-photo__exif {
  bottom: 16%;
  color: rgba(241, 241, 236, 0.6);
}
.cv-photo__archive {
  bottom: 11.5%;
}
.cv-photo__year {
  bottom: 7%;
}

/* --- 标题。刻意用中等字号：它是作品旁的说明，不是主体。 --- */
.cv-photo__type {
  position: absolute;
  inset: 0;
}
.cv-photo__word {
  position: absolute;
  left: 8%;
  top: 18%;
  display: block;
  font-weight: 700;
  font-size: 13vh;
  line-height: 0.86;
  letter-spacing: -0.01em;
  color: rgba(241, 241, 236, 0.9);
  user-select: none;
  white-space: nowrap;
}

/* --- 静态：页面的边距。永不移动，永不做动画。 --- */
.cv-photo__info {
  position: absolute;
  left: 8%;
  top: 9%;
  display: flex;
  flex-direction: column;
  gap: 0.8vh;
}
.cv-photo__eyebrow {
  font-size: clamp(9px, 0.82vw, 13px);
  letter-spacing: 0.3em;
  color: rgba(241, 241, 236, 0.34);
}
.cv-photo__lead {
  font-size: clamp(17px, 2.1vw, 32px);
  font-weight: 300;
  letter-spacing: 0.04em;
  color: rgba(241, 241, 236, 0.9);
}
.cv-photo__note {
  position: absolute;
  left: 8%;
  bottom: 7%;
  font-size: clamp(8px, 0.7vw, 11px);
  letter-spacing: 0.24em;
  color: rgba(241, 241, 236, 0.28);
}
</style>
