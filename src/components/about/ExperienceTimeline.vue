<template>
  <section id="experience" class="exp-section" aria-labelledby="experience-title">
    <header class="exp-section__head">
      <h2 id="experience-title">实习与实践<span lang="en">Internships & practice</span></h2>
      <p>用虚构经历，演示从策划到交付的表达<span lang="en">Fictional experience illustrating planning and delivery</span></p>
    </header>
    <div ref="root" class="exp">
      <nav class="exp__index" :aria-label="t.navigation">
        <div class="exp__sticky">
          <p class="exp__index-label">经历目录<span lang="en">Experience index</span></p>
          <a v-for="(experience, i) in EXPERIENCE" :key="experience.id" class="exp__jump"
            :class="{ 'is-current': current === i }" :href="`#work-${experience.workId}`"
            :aria-current="current === i ? 'location' : undefined">
            <span class="exp__jump-period">{{ pick(experience.period, lang) }}</span>
            <span class="exp__jump-company">{{ pick(experience.company, lang) }}</span>
          </a>
        </div>
      </nav>

      <ol class="exp__list">
        <li v-for="(experience, i) in EXPERIENCE" :id="`work-${experience.workId}`" :key="experience.id"
          class="exp-node" :data-exp="i" :data-experience="experience.id">
          <header class="exp-node__header">
            <p class="exp-node__period">{{ pick(experience.period, lang) }}</p>
            <h3 class="exp-node__company">{{ experience.company.zh }}<span lang="en">{{ experience.company.en }}</span></h3>
            <p class="exp-node__role">{{ experience.role.zh }}<span lang="en">{{ experience.role.en }}</span></p>
          </header>
          <div class="exp-node__details">
            <section v-for="(detail, detailIndex) in experience.details" :key="detailIndex" class="exp-node__detail">
              <h4>{{ detail.title.zh }}<span lang="en">{{ detail.title.en }}</span></h4>
              <div class="exp-node__copy">
                <p lang="zh"><template v-for="(part, partIndex) in resumeDetailParts(detail.body.zh, experience.id, detailIndex, 'zh')" :key="partIndex"><strong v-if="part.strong">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></p>
                <p lang="en"><template v-for="(part, partIndex) in resumeDetailParts(detail.body.en, experience.id, detailIndex, 'en')" :key="partIndex"><strong v-if="part.strong">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></p>
              </div>
            </section>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 完整经历正文来自 EXPERIENCE，重点片段来自简历对照表，不在模板里另写一份履历。
 * 观察器只更新侧边导航高亮，不隐藏、重建或截断经历，因此无动画时也能完整阅读。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { EXPERIENCE, pick, type Lang } from '../../data/aboutProfile'
import { resumeDetailParts } from '../../data/resumeEmphasis'

const props = defineProps<{ lang: Lang }>()
const root = ref<HTMLElement | null>(null)
const current = ref(0)
const t = computed(() => props.lang === 'zh'
  ? { navigation: '跳转到相应经历' }
  : { navigation: 'Navigate work experience' })
let observer: IntersectionObserver | undefined
onMounted(() => {
  if (!root.value || typeof IntersectionObserver === 'undefined') return
  // 将阅读带限制在屏幕中上部，避免标题刚碰到底边就抢走当前经历的高亮。
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) current.value = Number((entry.target as HTMLElement).dataset.exp)
    }
  }, { rootMargin: '-25% 0px -55% 0px', threshold: 0 })
  root.value.querySelectorAll('.exp-node').forEach(node => observer!.observe(node))
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.exp-section { scroll-margin-top:72px; }
.exp-section__head { display:grid; grid-template-columns:minmax(170px,.28fr) minmax(0,1fr); gap:clamp(44px,7vw,100px); align-items:start; margin-bottom:clamp(42px,6vw,80px); }
.exp-section__head h2 { margin:0; font-size:clamp(28px,3vw,42px); font-weight:400; letter-spacing:-.045em; line-height:1.2; }
.exp-section__head h2 span { display:block; margin-top:12px; font-size:15px; letter-spacing:-.015em; color:var(--ab-soft); }
.exp-section__head > p { max-width:30em; margin:0; padding-top:5px; font-size:clamp(20px,2.2vw,29px); line-height:1.5; letter-spacing:-.025em; }
.exp-section__head > p span { display:block; margin-top:14px; font-size:14px; line-height:1.6; letter-spacing:0; color:var(--ab-soft); }
.exp { display:grid; grid-template-columns:minmax(170px,.28fr) minmax(0,1fr); gap:clamp(44px,7vw,100px); }
.exp__sticky { position:sticky; top:100px; }
.exp__index-label { margin:0 0 26px; padding-top:28px; border-top:1px solid var(--ab-line); font-size:13px; }
.exp__index-label span { display:block; margin-top:5px; color:var(--ab-soft); font-size:11px; }
.exp__jump { display:flex; flex-direction:column; gap:7px; padding:16px 0; color:var(--ab-soft); text-decoration:none; font-size:13px; line-height:1.6; transition:color .25s ease; }
.exp__jump-period { font-size:11px; }
.exp__jump-company { position:relative; }
.exp__jump-company::before { content:''; position:absolute; left:-17px; top:.65em; width:7px; height:1px; background:currentColor; transform:scaleX(0); transform-origin:left; transition:transform .25s ease; }
.exp__jump.is-current,.exp__jump:hover { color:var(--ab-ink); }
.exp__jump.is-current .exp__jump-company::before { transform:scaleX(1); }
.exp__jump:focus-visible { outline:2px solid currentColor; outline-offset:5px; }
.exp__list { min-width:0; list-style:none; margin:0; padding:0; }
.exp-node { scroll-margin-top:80px; border-top:1px solid var(--ab-line); padding-top:30px; }
.exp-node + .exp-node { margin-top:clamp(64px,8vw,110px); }
.exp-node__period { margin:0; font-size:12px; color:var(--ab-soft); }
.exp-node__company { max-width:19em; margin:24px 0 0; font-size:clamp(25px,2.6vw,36px); font-weight:400; line-height:1.25; letter-spacing:-.035em; }
.exp-node__company > span { display:block; margin-top:14px; font-size:15px; line-height:1.5; letter-spacing:-.01em; color:var(--ab-soft); }
.exp-node__role { margin:20px 0 0; font-size:18px; line-height:1.5; }
.exp-node__role > span { display:block; margin-top:6px; font-size:13px; color:var(--ab-soft); }
.exp-node__details { margin-top:36px; }
.exp-node__detail { display:grid; grid-template-columns:minmax(110px,.3fr) minmax(0,1fr); gap:clamp(22px,3vw,40px); padding:26px 0; border-top:1px solid var(--ab-line); }
.exp-node__detail h4 { margin:0; font-size:15px; font-weight:400; line-height:1.5; }
.exp-node__detail h4 > span { display:block; margin-top:7px; font-size:11px; line-height:1.5; color:var(--ab-soft); }
.exp-node__copy { min-width:0; }
.exp-node__copy p { max-width:37em; margin:0; font-size:17px; line-height:1.85; overflow-wrap:break-word; }
.exp-node__copy p[lang=en] { max-width:64ch; margin-top:16px; font-size:14px; line-height:1.75; color:var(--ab-soft); }
.exp-node__copy strong { font-weight:600; color:inherit; }
@media(max-width:980px) {
 .exp-section__head { grid-template-columns:minmax(0,1fr); gap:24px; }
 .exp-section__head > p { max-width:40em; font-size:22px; }
 .exp { grid-template-columns:minmax(0,1fr); gap:0; }
 .exp__index { display:none; }
 .exp-node__company { font-size:clamp(28px,4.4vw,40px); }
}
@media(max-width:600px) {
 .exp-section__head { margin-bottom:36px; }
 .exp-section__head > p { font-size:20px; }
 .exp-section__head > p span { font-size:13px; }
 .exp-node { scroll-margin-top:64px; padding-top:24px; }
 .exp-node__company { margin-top:20px; }
 .exp-node__company > span { font-size:13px; }
 .exp-node__role { margin-top:20px; font-size:16px; }
 .exp-node__role > span { font-size:12px; }
 .exp-node__details { margin-top:30px; }
 .exp-node__detail { grid-template-columns:minmax(0,1fr); gap:18px; padding:26px 0; }
 .exp-node__detail h4 { font-size:17px; }
 .exp-node__detail h4 > span { margin-top:4px; }
 .exp-node__copy p { font-size:16px; line-height:1.8; }
 .exp-node__copy p[lang=en] { font-size:13px; line-height:1.7; }
}
@media(prefers-reduced-motion:reduce) { .exp__jump,.exp__jump-company::before { transition:none; } }
</style>
