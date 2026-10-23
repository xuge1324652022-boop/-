<template>
  <section ref="root" class="ipg" aria-labelledby="internship-posters-title">
    <header class="ipg__intro">
      <span class="ipg__eyebrow">SYNTHETIC LAYOUTS / TEMPLATE EXAMPLES</span>
      <h2 id="internship-posters-title" class="ipg__big"><span class="ipg__title-line"><span>版面示例</span></span><span class="ipg__title-line"><span lang="en">LAYOUT SAMPLES</span></span></h2>
      <ReferenceIntroduction class="ipg__intro-copy" :text="GALLERY_INTRO" label="Synthetic layout samples" variant="section" />
      <nav class="ipg__nav" :aria-label="lang === 'zh' ? '合成版面章节' : 'Synthetic layout chapters'">
        <a v-for="(chapter, i) in chapters" :key="chapter.group.id" :href="`#internship-${chapter.group.id}`">
          <span>{{ String(i + 1).padStart(2, '0') }}</span>{{ chapter.theme.model }}<span>↓</span>
        </a>
      </nav>
    </header>

    <section v-for="(chapter, i) in chapters" :id="`internship-${chapter.group.id}`" :key="chapter.group.id" class="ipg__chapter">
      <header class="ipg__chapter-heading">
        <span class="ipg__eyebrow">{{ String(i + 1).padStart(2, '0') }} / {{ chapter.group.items.length }} {{ lang === 'zh' ? '页 · 合成示例' : 'PAGES · SYNTHETIC SAMPLES' }}</span>
        <h3><span class="ipg__title-line ipg__model"><span>{{ chapter.theme.model }}</span></span><span class="ipg__title-line"><span lang="zh">{{ chapter.theme.title.zh }}</span></span><span class="ipg__title-line ipg__english"><span lang="en">{{ chapter.theme.title.en }}</span></span></h3>
        <ReferenceIntroduction :text="chapter.group.description" :label="chapter.theme.model" variant="section" />
      </header>

      <!-- 交互动效与合成版面并置；后续示例完整展开，不再折叠为文档入口 -->
      <div class="ipg__feature">
        <div class="ipg__motion">
          <InternshipMotionTile :theme="chapter.theme" :lang="lang" />
          <p class="ipg__motion-label">{{ lang === 'zh' ? '文字与图形 · 交互动效' : 'Type & graphic · Interactive motion study' }}</p>
        </div>
        <InternshipMotionCard :item="chapter.group.items[0]!" :lang="lang" :page="1" :total="chapter.group.items.length" @open="forwardOpen" />
      </div>

      <template v-for="(block, s) in chapter.blocks" :key="s">
        <div v-if="block.items.length" class="ipg__pages" :class="{ 'ipg__pages--closing': block.statement }">
          <InternshipMotionCard v-for="item in block.items" :key="item.id" :item="item" :lang="lang"
            :page="chapter.group.items.indexOf(item) + 1" :total="chapter.group.items.length" @open="forwardOpen" />
        </div>
        <ReferenceIntroduction v-if="block.statement" class="ipg__statement" :text="block.statement" :label="chapter.theme.model" />
      </template>
    </section>
    <!-- 版面 B 的空间叠层单独收尾，位于其他版面章节之后、几何海报系列之前。 -->
    <InternshipDepthComposition v-if="depthItems.length" :items="depthItems" :lang="lang" @open="forwardOpen" />
  </section>
</template>

<script setup lang="ts">
/**
 * 合成版面编排层：按示例组分章，单张交给 MotionCard，方法演示交给 MotionTile。
 * 版面 B 的第 12–15 页 由独立空间组件呈现，在这里从普通页序中排除，防止同稿重复出现。
 * 此处只创建章节标题的首次入场；作品内部动画和查看器状态各由下层、页面持有。
 */
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import ReferenceIntroduction from '../ReferenceIntroduction.vue'
import { referenceIntroductionGate } from '../ReferenceIntroduction'
import InternshipMotionCard from './InternshipMotionCard.vue'
import InternshipMotionTile from './InternshipMotionTile.vue'
import InternshipDepthComposition from './InternshipDepthComposition.vue'
import { type Bi, type Lang } from '../../data/aboutProfile'
import { type InternshipPosterGroup } from '../../data/internshipPosters'
import { INTERNSHIP_MOTION_THEMES } from '../../data/internshipPosterMotion'
import type { VisualAsset } from '../../data/visualPortfolio'
import { createViewportEntrance } from '../../utils/viewportEntrance'
import { requestMotionLayoutRefresh } from '../../utils/motionLayout'

const props = defineProps<{ groups: readonly InternshipPosterGroup[]; lang: Lang }>()
const GALLERY_INTRO: Bi = { zh: '合成几何素材，展示版面、层次与交互动效', en: 'Synthetic geometric assets demonstrate layouts, layers and interactive motion' }
const emit = defineEmits<{ open: [item: VisualAsset, trigger: HTMLElement] }>()
const root = ref<HTMLElement | null>(null)
const pageGate = inject(referenceIntroductionGate, ref(true))
const depthItems = computed(() => props.groups.find(group => group.id === 'demo-measure')?.items
  .filter(item => ['demo-measure-12', 'demo-measure-13', 'demo-measure-14', 'demo-measure-15'].includes(item.id)) ?? [])
type GalleryBlock = { items: readonly VisualAsset[]; statement?: Bi }
const chapters = computed(() => props.groups.map(group => {
  const theme = INTERNSHIP_MOTION_THEMES[group.id]!
  const remaining = group.items.slice(1)
  const blocks: GalleryBlock[] = []
  function pages(items: readonly VisualAsset[]) {
    for (let start = 0; start < items.length; start += 6) blocks.push({ items: items.slice(start, start + 6) })
  }
  if (group.id === 'demo-measure') {
    // 版面 B 正文保留第1页；第12–15页由展区末尾的独立叠层呈现。
    pages(remaining.filter(item => Number(item.id.slice(-2)) < 12))
    if (blocks.length) blocks[blocks.length - 1]!.statement = theme.statements[0]
  } else pages(remaining)
  return { group, theme, blocks }
}))
let media: gsap.MatchMedia | undefined
let dead = false
let armHeadings = () => {}
let disarmHeadings = () => {}
let cancelRefresh: (() => void) | undefined
// 元素是否已读与媒体查询实例分离，切换偏好或重新布置触发器时不会重播旧标题。
const revealed = new WeakSet<Element>()
gsap.registerPlugin(ScrollTrigger)
function forwardOpen(item: VisualAsset, trigger: HTMLElement) { emit('open', item, trigger) }
async function refresh() {
  await nextTick()
  if (dead) return
  cancelRefresh?.()
  cancelRefresh = requestMotionLayoutRefresh()
}
watch(() => props.lang, refresh)
watch(pageGate, active => { if (active) armHeadings(); else disarmHeadings() })
onMounted(async () => {
  await nextTick()
  if (dead || !root.value) return
  media = gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)', context => {
    const pending: Array<{ heading: HTMLElement; reveal: gsap.core.Tween }> = []
    const triggers = new Map<HTMLElement, ScrollTrigger>()
    // 大字进入视口就入场一次；小幅上下滚动不反复隐藏与重播。
    root.value!.querySelectorAll<HTMLElement>('.ipg__big,.ipg__chapter-heading h3').forEach(heading => {
      const reveal = gsap.fromTo(heading.querySelectorAll('.ipg__title-line > span'), { yPercent: 100 }, { yPercent: 0, stagger: .09, duration: .95,
        ease: 'power2.out', paused: true })
      if (revealed.has(heading)) reveal.progress(1)
      else pending.push({ heading, reveal })
    })
    armHeadings = () => {
      if (dead || !pageGate.value) return
      context.add(() => pending.forEach(({ heading, reveal }) => {
        if (revealed.has(heading) || triggers.has(heading)) return
        const trigger = createViewportEntrance({ trigger: heading,
          play: () => { revealed.add(heading); reveal.play(0) },
          complete: () => { revealed.add(heading); reveal.progress(1).pause() } })
        triggers.set(heading, trigger)
      }))
    }
    disarmHeadings = () => { triggers.forEach(trigger => trigger.kill()); triggers.clear() }
    armHeadings()
    return () => { disarmHeadings(); armHeadings = () => {}; disarmHeadings = () => {} }
  }, root.value)
  void document.fonts.ready.then(refresh)
  void refresh()
})
onBeforeUnmount(() => { dead = true; cancelRefresh?.(); media?.revert() })
</script>

<style scoped>
.ipg { padding:clamp(80px,14vh,170px) clamp(20px,4.4vw,80px) 40px; background:var(--ab-bg); color:var(--ab-ink); }
.ipg__eyebrow { font-size:10px; letter-spacing:.12em; color:var(--ab-soft); }
.ipg__intro { margin-bottom:clamp(100px,20vh,240px); }
.ipg__big { display:flex; flex-wrap:wrap; align-items:baseline; gap:.06em .25em; margin:35px 0; font-size:clamp(62px,13.5vw,210px); font-weight:400; letter-spacing:-.04em; line-height:.95; }
.ipg__title-line { display:block; overflow:clip; padding-bottom:.06em; }
.ipg__title-line > span { display:block; }
.ipg__intro-copy { margin:clamp(42px,7vh,80px) 0 42px; }
.ipg__nav { display:flex; flex-wrap:wrap; gap:16px 38px; }
.ipg__nav a { display:flex; gap:14px; align-items:center; padding:8px 0; color:inherit; text-decoration:none; font-size:13px; transition:transform .3s; }
.ipg__nav a:hover { transform:translateX(4px); }
.ipg__nav a:focus-visible { outline:2px solid var(--ab-ink); outline-offset:4px; }
.ipg__chapter { scroll-margin-top:84px; margin-bottom:clamp(120px,25vh,280px); }
.ipg__chapter-heading { margin-bottom:clamp(56px,10vh,120px); border-top:1px solid var(--ab-line); padding-top:28px; }
.ipg__chapter-heading h3 { display:flex; flex-direction:column; gap:12px; margin:35px 0 28px; font-size:clamp(28px,4.2vw,70px); font-weight:400; line-height:1.04; letter-spacing:-.03em; }
.ipg__chapter-heading .ipg__model { font-size:clamp(40px,7vw,120px); font-weight:400; letter-spacing:-.04em; }
.ipg__chapter-heading .ipg__english { font-size:.5em; letter-spacing:-.015em; }
.ipg__feature { display:grid; grid-template-columns:minmax(0,.9fr) minmax(0,1fr); gap:clamp(36px,10vw,180px); align-items:start; margin:0 4vw clamp(110px,22vh,240px); }
.ipg__feature > .imc { margin-top:clamp(80px,18vh,220px); }
.ipg__motion-label { margin:18px 0 0; font-size:12px; color:var(--ab-soft); }
.ipg__pages { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:clamp(90px,18vh,220px) clamp(40px,12vw,220px); margin-inline:4vw; margin-bottom:clamp(100px,20vh,230px); align-items:start; }
.ipg__pages > :nth-child(even) { margin-top:clamp(70px,14vh,160px); }
.ipg__pages--closing { margin-bottom:0; }
.ipg__statement { width:auto; margin:clamp(40px,7vh,88px) 4vw 0; }
@media(max-width:760px) {
 .ipg__big { flex-direction:column; font-size:clamp(58px,15vw,100px); gap:10px; }
 .ipg__feature,.ipg__pages { grid-template-columns:1fr; gap:60px; margin-inline:0; }
 .ipg__feature > .imc,.ipg__pages > :nth-child(even) { margin-top:0; }
 .ipg__motion { max-width:480px; width:100%; margin-inline:auto; }
 .ipg__chapter-heading h3 { overflow-wrap:anywhere; }
 .ipg__statement { margin-inline:0; }
 .ipg__nav a { gap:12px; }
}
@media(prefers-reduced-motion:reduce) { .ipg__nav a { transition:none; } }
</style>
