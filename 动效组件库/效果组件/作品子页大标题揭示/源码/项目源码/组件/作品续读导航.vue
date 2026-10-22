<template>
  <footer class="wc" :aria-label="lang === 'zh' ? '继续浏览作品' : 'Explore more work'">
    <div class="wc__inner">
      <p class="wc__prompt"><span>继续浏览</span><span lang="en">Keep exploring</span></p>
      <RouterLink class="wc__next" :to="nextTo" :data-cursor="lang === 'zh' ? '探索' : 'Explore'" data-cursor-action="explore" :aria-label="`${lang === 'zh' ? '查看' : 'Explore'} ${work.title.zh} / ${work.title.en}`">
        <span class="wc__preview" aria-hidden="true">
          <img v-if="work.image" :src="work.image" alt="" loading="lazy" decoding="async" draggable="false" />
          <span v-else class="wc__preview-type">{{ work.title.en }}</span>
        </span>
        <span class="wc__copy">
          <span class="wc__title">{{ work.title.zh }}</span>
          <span class="wc__english" lang="en">{{ work.title.en }}</span>
          <span class="wc__description"><span>{{ work.description.zh }}</span><span lang="en">{{ work.description.en }}</span></span>
        </span>
        <svg class="wc__arrow" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M8 32 32 8M8 8h24v24" />
        </svg>
      </RouterLink>
      <div class="wc__base">
        <RouterLink class="wc__return" :to="backTo">
          <span aria-hidden="true">←</span><span>{{ lang === 'zh' ? source === 'cards' ? '返回列表' : '返回作品集' : source === 'cards' ? 'Back to list' : 'All works' }}</span>
        </RouterLink>
        <button class="wc__top" type="button" @click="toTop">
          <span>{{ lang === 'zh' ? '回到顶部' : 'Back to top' }}</span><span aria-hidden="true">↑</span>
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
/**
 * 子页统一收尾：下一章节预览、来源对应的返回入口与回到顶部。
 * 使用正常 RouterLink 交给全站幕布处理导航；悬停反馈留在 CSS，避免额外滚动监听。
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { subpageLanguage as lang } from '../组合函数/子页语言状态'
import { visualById } from '../数据/视觉作品资料'
import colorFrame from '../素材/调色帧/调色第7帧.jpg'

type Destination = 'about' | 'edit' | 'video' | 'color' | 'news' | 'creative' | 'poster' | 'photo'
type Bilingual = { zh: string; en: string }
type Work = { path: string; title: Bilingual; description: Bilingual; image?: string }

const props = defineProps<{ next: Destination }>()
const destinations: Record<Destination, Work> = {
  about: { path: '/about', title: { zh: '关于我', en: 'About me' },
    description: { zh: '经历、创作与内容实践', en: 'Experience, creation and content practice' }, image: '/about/portrait.webp' },
  edit: { path: '/edit', title: { zh: '剪辑', en: 'Editing' },
    description: { zh: '节奏、衔接与声音的主题研究', en: 'Studies in rhythm, continuity and sound' } },
  video: { path: '/edit', title: { zh: '剪辑', en: 'Editing' },
    description: { zh: '节奏、衔接与声音的主题研究', en: 'Studies in rhythm, continuity and sound' } },
  color: { path: '/color', title: { zh: '影像调色', en: 'Colour grading' },
    description: { zh: '在明暗与冷暖之间，寻找画面的情绪', en: 'Light, colour and the mood of an image' }, image: colorFrame },
  news: { path: '/news', title: { zh: '新闻影像', en: 'News & visual stories' },
    description: { zh: '人物、现场与观察的叙事笔记', en: 'Notes on people, place and context' } },
  creative: { path: '/news', title: { zh: '新闻影像', en: 'News & visual stories' },
    description: { zh: '人物、现场与观察的叙事笔记', en: 'Notes on people, place and context' } },
  poster: { path: '/poster', title: { zh: '海报设计', en: 'Poster design' },
    description: { zh: '实习产出与个人视觉练习', en: 'Internship work and personal poster studies' }, image: visualById('mbt-2000').src },
  photo: { path: '/photo', title: { zh: '摄影', en: 'Photography' },
    description: { zh: '光线、风景与被记录的瞬间', en: 'Light, landscapes and moments observed' }, image: visualById('mountain-cloud').src },
}
const route = useRoute()
const work = computed(() => destinations[props.next])
// 继续浏览保持来源，返回作品集/列表始终落在最初的入口。
const source = computed(() => route.query.from === 'cards' || (route.path.startsWith('/card/') && route.query.from !== 'gallery') ? 'cards' : 'gallery')
const backTo = computed(() => source.value === 'cards' ? '/cards' : '/')
const nextTo = computed(() => ({ path: work.value.path, query: { from: source.value } }))
function toTop() {
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
</script>

<style scoped>
.wc { width:100%; color:inherit; padding:clamp(80px,12vh,160px) 0 36px; }
.wc__inner { max-width:1400px; margin-inline:auto; padding-inline:clamp(20px,4.4vw,64px); }
.wc__prompt { display:flex; align-items:baseline; gap:14px; padding-top:24px; border-top:1px solid color-mix(in srgb,currentColor 18%,transparent); font-size:13px; line-height:1.5; }
.wc__prompt [lang=en] { opacity:.58; font-size:12px; }
.wc__next { display:grid; grid-template-columns:minmax(140px,.72fr) minmax(0,1.5fr) 60px; align-items:center; gap:clamp(24px,4.4vw,64px); min-height:280px; padding:42px 0 48px; text-decoration:none; color:inherit; }
.wc__preview { display:flex; align-items:center; justify-content:flex-start; overflow:clip; }
.wc__preview img { display:block; width:100%; max-height:210px; height:auto; object-fit:contain; transform-origin:center; transition:transform .7s cubic-bezier(.22,1,.36,1); }
.wc__preview-type { font-size:clamp(24px,3vw,50px); line-height:1.1; }
.wc__copy { display:flex; flex-direction:column; align-items:flex-start; min-width:0; }
.wc__title { position:relative; display:block; font-size:clamp(38px,5.6vw,78px); line-height:1.15; font-weight:500; letter-spacing:-.055em; }
.wc__title::after { content:''; position:absolute; left:0; bottom:-6px; width:100%; height:1px; background:currentColor; transform:scaleX(0); transform-origin:left; transition:transform .55s cubic-bezier(.22,1,.36,1); }
.wc__english { display:block; margin-top:10px; font-size:clamp(18px,2vw,27px); line-height:1.3; letter-spacing:-.025em; }
.wc__description { display:flex; flex-direction:column; gap:4px; margin-top:22px; font-size:12px; line-height:1.6; opacity:.65; }
.wc__description [lang=en] { font-size:11px; }
.wc__arrow { width:48px; height:48px; justify-self:end; stroke:currentColor; stroke-width:1.5; transition:transform .6s cubic-bezier(.22,1,.36,1); }
.wc__next:hover .wc__preview img,.wc__next:focus-visible .wc__preview img { transform:scale(1.025); }
.wc__next:hover .wc__title::after,.wc__next:focus-visible .wc__title::after { transform:scaleX(1); }
.wc__next:hover .wc__arrow,.wc__next:focus-visible .wc__arrow { transform:translate(5px,-5px); }
.wc__base { display:flex; justify-content:space-between; align-items:center; gap:20px; padding-top:20px; border-top:1px solid color-mix(in srgb,currentColor 18%,transparent); }
.wc__return,.wc__top { display:inline-flex; align-items:center; gap:14px; min-height:44px; border:0; padding:0; background:none; color:inherit; text-decoration:none; font-family:inherit; font-size:12px; line-height:1.5; cursor:pointer; }
.wc__return>span:first-child,.wc__top>span:last-child { transition:transform .35s ease; }
.wc__return:hover>span:first-child { transform:translateX(-4px); }
.wc__top:hover>span:last-child { transform:translateY(-4px); }
.wc a:focus-visible,.wc button:focus-visible { outline:2px solid currentColor; outline-offset:6px; }
@media(max-width:640px) {
 .wc { padding-top:72px; padding-bottom:24px; }
 .wc__next { grid-template-columns:minmax(0,1fr) 36px; gap:24px 20px; padding-top:32px; padding-bottom:36px; }
 .wc__preview { grid-column:1/-1; width:clamp(170px,62vw,280px); }
 .wc__preview img { max-height:185px; }
 .wc__title { font-size:clamp(36px,9vw,54px); }
 .wc__english { margin-top:8px; font-size:20px; }
 .wc__description { margin-top:18px; max-width:31ch; }
 .wc__arrow { width:32px; height:32px; align-self:start; margin-top:8px; }
 .wc__prompt { flex-wrap:wrap; }
}
@media(prefers-reduced-motion:reduce) {
 .wc__preview img,.wc__title::after,.wc__arrow,.wc__return>span,.wc__top>span { transition:none; }
 .wc__next:hover .wc__preview img,.wc__next:focus-visible .wc__preview img,.wc__next:hover .wc__arrow,.wc__next:focus-visible .wc__arrow { transform:none; }
}
</style>
