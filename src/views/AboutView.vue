<template>
  <!-- 叙事顺序在此组合；各区块自己持有动画，跨区工具选择与看图状态由本页协调。 -->
  <div class="about-page">
    <AboutHero :lang="lang" :active="heroActive" />
    <main class="about-body">
      <ProfileIntro v-model:active-tool="activeTool" :lang="lang" :active="heroActive" />
      <ReferenceIntroduction class="about-divider" data-before="experience" :label="ABOUT_DIVIDERS.experience.label" :text="ABOUT_DIVIDERS.experience.text" variant="section" treatment="title" reveal-by="paragraph" />
      <ExperienceTimeline :lang="lang" />
      <ReferenceIntroduction class="about-divider" data-before="ai-workflow" :label="ABOUT_DIVIDERS.process.label" :text="ABOUT_DIVIDERS.process.text" variant="section" treatment="title" reveal-by="paragraph" />
      <AiWorkflow v-model:active-tool="activeTool" :lang="lang" />
      <ReferenceIntroduction class="about-divider" data-before="beyond-work" :label="ABOUT_DIVIDERS.beyond.label" :text="ABOUT_DIVIDERS.beyond.text" variant="section" treatment="title" reveal-by="paragraph" />
      <BeyondWork :lang="lang" @open="onOpenVisual" />
      <ReferenceIntroduction class="about-divider" data-before="contact" :label="ABOUT_DIVIDERS.contact.label" :text="ABOUT_DIVIDERS.contact.text" variant="section" treatment="title" reveal-by="paragraph" />
      <ContactEnd :lang="lang" />
    </main>
    <VisualViewer v-if="viewerItem" :item="viewerItem" :lang="lang" @close="closeViewer" />
  </div>
</template>

<script setup lang="ts">
/**
 * /about 人物专题入口：事实内容来自 data，版式与动效分别封装在 about 子组件中。
 * 本页只协调转场放行、头像与工作流共享的 AI 工具选择，以及统一图片查看器。
 */
import { computed, onBeforeUnmount, provide, ref } from 'vue'
import ReferenceIntroduction from '../components/ReferenceIntroduction.vue'
import { referenceIntroductionGate } from '../components/ReferenceIntroduction'
import AboutHero from '../components/about/AboutHero.vue'
import ProfileIntro from '../components/about/ProfileIntro.vue'
import ExperienceTimeline from '../components/about/ExperienceTimeline.vue'
import AiWorkflow from '../components/about/AiWorkflow.vue'
import BeyondWork from '../components/about/BeyondWork.vue'
import ContactEnd from '../components/about/ContactEnd.vue'
import VisualViewer from '../components/about/VisualViewer.vue'
import { WORKS, assertParity } from '../data/aboutProfile'
import { ABOUT_DIVIDERS } from '../data/aboutDividers'
import { assertVisuals, type VisualAsset } from '../data/visualPortfolio'
import { subpageLanguage as lang } from '../composables/useSubpageLanguage'
import { useVisualViewer } from '../composables/useVisualViewer'
import { ABOUT_PAGE_ID, isTransitioning, jumpTarget, markSubpageVisit, overlayActive } from '../composables/useTransition'
import { routeCurtainBlocked } from '../composables/usePageCurtain'

if (import.meta.env.DEV) {
  assertParity()
  assertVisuals(WORKS.map(work => work.id))
}
// 查看器保存触发元素以便关闭后恢复焦点；路由卸载必须同步 reset，避免回滚新页面位置。
const { active: viewerItem, open: openViewer, close: closeViewer, reset: resetViewer } = useVisualViewer()
function onOpenVisual(item: VisualAsset, trigger: HTMLElement) { openViewer(item, trigger) }
onBeforeUnmount(resetViewer)
markSubpageVisit(ABOUT_PAGE_ID)
// blocked 在全局幕布开始揭开时解除；不等幕布彻底离场，首屏文字才能接上转场节奏。
const heroActive = computed(() => !routeCurtainBlocked.value && !jumpTarget.value && !overlayActive.value && !isTransitioning.value)
provide(referenceIntroductionGate, heroActive)
const activeTool = ref('kimi')
</script>

<style scoped>
/* clip 只裁横向溢出，不另造滚动容器；人物照片与页尾曲线仍相对视口计算。 */
.about-page { position:relative; min-height:100vh; background:var(--ab-bg); color:var(--ab-ink); font-family:inherit; overflow-x:clip; }
.about-body { width:100%; max-width:1440px; margin:0 auto; padding:0 clamp(20px,4.4vw,64px); }
.about-body > .about-divider { max-width:1120px; margin:clamp(88px,10vw,144px) auto clamp(44px,5vw,72px); --reference-line-height:1.18; --reference-label-color:var(--ab-soft); }
@media(max-width:760px) { .about-body > .about-divider { margin-top:76px; margin-bottom:40px; } }
</style>
