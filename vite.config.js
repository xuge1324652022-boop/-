import { existsSync, statSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { sendMediaFile } from './scripts/media-http.mjs'
import { routePages } from './scripts/route-pages.mjs'

/**
 * 真实调色素材的静态服务（dev + preview 两用）。
 *
 * 原片统一放在 `作品/调色-成片/`；网页压缩版放在 `media/color/`。
 * 优先读未过期的网页版本，没有时读原片，URL 始终保持 `/color/<文件名>`。
 * 视频不进 public / dist，也不重复拷贝原片；部署时需单独提供这些媒体 URL。
 */
const ROOT = dirname(fileURLToPath(import.meta.url))
// 公开模板只读取已审核的合成示例，绝不自动读取本机作品或私人媒体。
const COLOR_SOURCE_DIR = resolve(ROOT, 'public/color')
const COLOR_WEB_DIR = resolve(ROOT, 'public/color')
const COLOR_PREFIX = '/color/'

function serveColorMedia() {
  // 中间件与原始作品目录是本机开发能力；静态部署需另行映射 /color/ 媒体地址。
  const middleware = (req, res, next) => {
    const url = (req.url || '').split('?')[0]
    if (!url.startsWith(COLOR_PREFIX)) return next()
    // 只允许单层文件名：既防目录穿越，也防把别的目录当素材端出去
    let name
    try { name = decodeURIComponent(url.slice(COLOR_PREFIX.length)) }
    catch { res.statusCode = 400; res.end('bad request'); return }
    if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
      res.statusCode = 403
      res.end('forbidden')
      return
    }
    const source = resolve(COLOR_SOURCE_DIR, name)
    const web = resolve(COLOR_WEB_DIR, name)
    // 原片被更新后，旧压缩版不能继续遮住新内容；重新生成才恢复优先使用。
    const hasSource = existsSync(source) && statSync(source).isFile()
    const hasWeb = existsSync(web) && statSync(web).isFile()
    const file = hasWeb && (!hasSource || statSync(web).mtimeMs >= statSync(source).mtimeMs)
      ? web
      : source
    /*
     * 缺失的文件不交给 SPA fallback —— 否则浏览器把 `<video>` 当 text/html
     * 静默吃掉（无 console error，但 readyState 永远 0、循环依赖 MDN 报错）。
     * 直接 404，让 `<video>` 派发 MEDIA_ERR_SRC_NOT_SUPPORTED，校验脚本能捕到。
     */
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404
      res.end('not found')
      return
    }
    const size = statSync(file).size
    const type = extname(file).toLowerCase() === '.mp4' ? 'video/mp4' : 'application/octet-stream'
    sendMediaFile(req, res, file, { size, type })
  }
  return {
    name: 'serve-color-media',
    // 两个钩子都在内部中间件**之前**安装，所以 /color/ 不会被 SPA fallback 吃掉
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [vue(), routePages(), serveColorMedia()],
  // Vite 8（rolldown）的 dev 依赖扫描默认会从根目录所有 HTML 里抽
  // `<script type="module">`，结果把 outputs/_archived-20260920/ 下 8 份历史
  // 归档（含 React/JSX）也当 entry 解析，第一次启动就报
  // "Failed to scan for dependencies from entries / Unexpected JSX expression"。
  // 这里把 entries 锁死到根 index.html，扫描就不会越界去摸归档目录。
  // outputs/ 中同时有受版本控制的校验脚本和被忽略的采样归档；dev 扫描不看 Git。
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    open: false,
    watch: {
      ignored: ['**/tmp/**', '**/outputs/**', '**/backups/**', '**/作品/**', '**/参考资料/**', '**/上线交付/**', '**/网站部署文件/**', '**/逆向工程工具/**'],
    },
  },
  build: {
    // 不沿用 Vite 8 的 Safari 16.4/Chrome 111 默认语法门槛；移动 WebView 单独保守编译。
    // 这只约束输出语法；媒体策略及 CSS/DOM 能力仍由组件检测和回退处理。
    target: ['chrome94', 'safari15', 'ios15'],
    outDir: 'dist',
    copyPublicDir: true,
    assetsInlineLimit: 0,  // 图片作为独立请求缓存，避免小图内联到 JS/CSS；不改变源图像素。
  },
})
