<template>
  <main class="not-found" aria-labelledby="not-found-title">
    <p class="not-found__code">404</p>
    <h1 id="not-found-title">{{ language === 'zh' ? '这个页面没有找到' : 'Page not found' }}</h1>
    <p>{{ language === 'zh' ? '链接可能有误，或页面已经移除。请从作品目录继续浏览。' : 'The link may be incorrect, or the page may have moved. Continue from the work index.' }}</p>
    <nav :aria-label="language === 'zh' ? '继续浏览' : 'Continue browsing'">
      <RouterLink to="/">{{ language === 'zh' ? '返回首页' : 'Back to home' }}</RouterLink>
      <RouterLink to="/cards">{{ language === 'zh' ? '浏览作品目录' : 'Browse work index' }}</RouterLink>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { subpageLanguage as language } from '../composables/useSubpageLanguage'
</script>

<style scoped>
.not-found { min-height: 100svh; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 1.5rem; padding: clamp(2rem, 7vw, 7rem); background: #f4f0e8; color: #171715; }
.not-found__code { margin: 0; font-size: clamp(5rem, 17vw, 12rem); font-weight: 700; line-height: .85; letter-spacing: -.08em; }
h1 { margin: 0; font-size: clamp(1.75rem, 5vw, 3.5rem); }
.not-found > p:not(.not-found__code) { max-width: 38rem; margin: 0; line-height: 1.8; }
nav { display: flex; flex-wrap: wrap; gap: 1rem 2rem; margin-top: 1rem; }
a { color: inherit; text-underline-offset: .3em; }
a:focus-visible { outline: 2px solid currentColor; outline-offset: .4rem; }
</style>
