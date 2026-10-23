<template>
  <section id="beyond-work" class="beyond" aria-labelledby="beyond-title">
    <header class="beyond__head">
      <h2 id="beyond-title">工作之外<span lang="en">Beyond work</span></h2>
      <p>留意光，也留意画面里的秩序<span lang="en">Looking for light, layers and a sense of order</span></p>
    </header>
    <div class="beyond__layout">
      <PhotoRunway :items="photography" :lang="lang" compact @open="(item, trigger) => emit('open', item, trigger)" @change="current = $event.id" />
      <aside class="beyond__note" aria-live="polite" aria-atomic="true">
        <p class="beyond__category">合成图像示例<span lang="en">Synthetic image examples</span></p>
        <Transition name="observation" mode="out-in">
          <div :key="current">
            <h3>{{ observation.title.zh }}<span lang="en">{{ observation.title.en }}</span></h3>
            <p class="beyond__copy" lang="zh">{{ observation.copy.zh }}</p>
            <p class="beyond__copy beyond__copy--en" lang="en">{{ observation.copy.en }}</p>
          </div>
        </Transition>
        <div class="beyond__links">
          <RouterLink :to="destination('/photo')"><span>更多摄影<span lang="en">More photographs</span></span><span aria-hidden="true">↗</span></RouterLink>
          <RouterLink :to="destination('/poster')"><span>海报与设计<span lang="en">Posters & design</span></span><span aria-hidden="true">↗</span></RouterLink>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 个人观察章节：复用 PhotoRunway 的翻图、拖动与查看事件，并同步当前照片的双语解读。
 * 查看器由页面统一持有；继续浏览链接保留 from，返回时仍能找到原来的作品入口。
 */
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import PhotoRunway from './PhotoRunway.vue'
import { photography, type Bi, type VisualAsset } from '../../data/visualPortfolio'
import type { Lang } from '../../data/aboutProfile'
defineProps<{ lang: Lang }>()
const emit = defineEmits<{ open: [item: VisualAsset, trigger: HTMLElement] }>()
const route = useRoute()
const destination = (path: string) => ({ path, query: { from: route.query.from === 'cards' ? 'cards' : 'gallery' } })
const current = ref(photography[0]!.id)
const observations: Record<string, { title: Bi; copy: Bi }> = {
  'sample-photo-01': {
    title: { zh: '远近之间', en: 'Between the layers' },
    copy: { zh: '用矩形、圆形和网格演示前后层次；所有画面均由程序生成', en: 'Rectangles, circles and a grid demonstrate visual layers. Every image is generated programmatically' },
  },
  'sample-photo-02': {
    title: { zh: '光与倒影', en: 'Light & reflection' },
    copy: { zh: '竖幅示例保留完整圆形与水平色块，用留白比较不同画幅的节奏', en: 'A portrait example retains the circle and level colour blocks, using space to compare image proportions' },
  },
  'sample-photo-03': {
    title: { zh: '形状与层次', en: 'Shape and layers' },
    copy: { zh: '深浅色块与圆环构成通用版式，不对应真实拍摄地点、人物或作品', en: 'Light and dark blocks with a ring form a generic layout, without depicting real locations, people or work' },
  },
}
const observation = computed(() => observations[current.value] ?? observations['sample-photo-01']!)
</script>

<style scoped>
.beyond { scroll-margin-top:72px; }
.beyond__head { display:grid; grid-template-columns:minmax(170px,.28fr) minmax(0,1fr); gap:clamp(44px,7vw,100px); margin-bottom:48px; }
.beyond__head h2 { font-size:clamp(28px,3vw,42px); font-weight:400; line-height:1.2; letter-spacing:-.045em; }
.beyond__head h2 span { display:block; margin-top:12px; font-size:15px; color:var(--ab-soft); letter-spacing:0; }
.beyond__head > p { font-size:clamp(20px,2.2vw,29px); line-height:1.5; letter-spacing:-.025em; }
.beyond__head > p span { display:block; margin-top:14px; font-size:14px; line-height:1.6; color:var(--ab-soft); letter-spacing:0; }
.beyond__layout { display:grid; grid-template-columns:minmax(0,2.5fr) minmax(0,1fr); gap:clamp(36px,5vw,72px); align-items:start; }
.beyond__note { padding-top:12px; }
.beyond__category { font-size:11px; color:var(--ab-soft); }
.beyond__category span { display:block; font-size:10px; margin-top:4px; }
.beyond__note h3 { margin-top:40px; font-size:clamp(25px,2.6vw,36px); font-weight:400; line-height:1.3; letter-spacing:-.035em; }
.beyond__note h3 span { display:block; margin-top:12px; font-size:17px; letter-spacing:0; }
.beyond__copy { margin-top:24px; font-size:15px; line-height:1.8; }
.beyond__copy--en { margin-top:14px; font-size:13px; line-height:1.65; color:var(--ab-soft); }
.beyond__links { margin-top:40px; }
.beyond__links a { display:flex; justify-content:space-between; gap:20px; align-items:center; padding:18px 0; border-top:1px solid var(--ab-line); font-size:15px; color:inherit; text-decoration:none; }
.beyond__links a span[lang=en] { display:block; margin-top:4px; font-size:11px; color:var(--ab-soft); }
.beyond__links a > span:last-child { font-size:24px; transition:transform .35s ease; }
.beyond__links a:hover > span:last-child { transform:translate(3px,-3px); }
.beyond__links a:focus-visible { outline:2px solid currentColor; outline-offset:4px; }
.observation-enter-active,.observation-leave-active { transition:opacity .2s; }
.observation-enter-from,.observation-leave-to { opacity:0; }
@media(max-width:980px) { .beyond__head { grid-template-columns:1fr; gap:24px; } .beyond__layout { grid-template-columns:1fr; gap:30px; } .beyond__note { display:grid; grid-template-columns:1fr 1fr; gap:16px 40px; } .beyond__category { grid-column:1/-1; } .beyond__note h3 { margin-top:12px; } .beyond__links { margin-top:12px; } }
@media(max-width:600px) { .beyond__head { margin-bottom:32px; } .beyond__head > p { font-size:20px; } .beyond__note { grid-template-columns:1fr; gap:20px; } .beyond__copy { margin-top:18px; } .beyond__links { margin-top:0; } }
@media(prefers-reduced-motion:reduce) { .observation-enter-active,.observation-leave-active,.beyond__links a > span:last-child { transition:none; } }
</style>
