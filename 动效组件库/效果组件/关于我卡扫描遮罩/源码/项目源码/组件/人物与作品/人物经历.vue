<template>
  <!--
    01 / ABOUT —— 首页画廊里「关于我」卡片的装饰预览，非 AboutView 正文首屏。
    三层由远及近：巨型 ABOUT 排版 → DEMO 几何图形 → 文字信息。
    尺度、层级、颜色都在 aboutExperience.css；指针位移在
    aboutExperienceAnimation.ts。这里只负责把它们摆在一起。

    aria-hidden：整张卡是装饰性排版，文字信息在别处以可读形式存在，
    屏幕阅读器不该再读一遍超尺寸被裁掉一半的巨型字。
  -->
  <div ref="rootRef" class="about-exp" aria-hidden="true">
    <!-- 第 1 层：巨型 ABOUT。主导尺度，允许被卡片边缘裁掉一部分 -->
    <h2 class="about-exp__type">ABOUT</h2>

    <!-- 第 2 层：DEMO —— 藏在空间里的几何结构，带三条扫描线 -->
    <div class="about-exp__logo">
      <TemplateMark />
    </div>

    <!-- 第 3 层：文字信息。尺度最小，锚在左下 -->
    <div class="about-exp__info">
      <span class="about-exp__index">01</span>
      <span class="about-exp__rule" />
      <h3 class="about-exp__lead">关于我</h3>
      <span class="about-exp__name">示例求职者</span>
      <span class="about-exp__role">VIDEO EDITOR</span>
      <span class="about-exp__role">COLORIST</span>
      <span class="about-exp__role">VISUAL DESIGNER</span>
      <div class="about-exp__meta">
        <span>2026</span>
        <span>CHINA</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import TemplateMark from './个人标志扫描.vue'
import {
  createAboutExperience,
  type AboutExperienceHandle,
} from './人物经历动画'
import './人物经历样式.css'

const rootRef = ref<HTMLElement | null>(null)
let handle: AboutExperienceHandle | null = null

onMounted(() => {
  if (rootRef.value) handle = createAboutExperience(rootRef.value)
})

onUnmounted(() => {
  handle?.destroy()
  handle = null
})
</script>
