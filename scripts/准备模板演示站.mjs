/** 在独立的忽略目录构建匿名演示；不读取个人入口站点或任何私人原件。 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteOrigin } from './route-pages.mjs'

const root = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
const config = JSON.parse(readFileSync(path.join(root, '发布配置/模板演示站.json'), 'utf8'))
const origin = siteOrigin(config.站点网址)
if (!config.站点编号 || origin !== config.站点网址 || !origin.startsWith('https://')) throw new Error('模板演示站配置无效')
const checkout = path.join(root, 'tmp', '模板演示站')
const output = path.join(checkout, 'dist')
// Vite 会清理 outDir；先逐层核对真实路径，禁止跟随符号链接或越出指定演示目录。
for (const directory of [path.join(root, 'tmp'), checkout, output]) {
  if (existsSync(directory) && (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory())) throw new Error('演示输出路径不是普通目录')
  mkdirSync(directory, { recursive: true })
  if (realpathSync(directory) !== directory) throw new Error('演示输出路径存在重定向')
}
const manifestPath = path.join(checkout, '.openai', 'hosting.json')
const manifestDirectory = path.dirname(manifestPath)
if (existsSync(manifestDirectory) && (lstatSync(manifestDirectory).isSymbolicLink() || !lstatSync(manifestDirectory).isDirectory())) throw new Error('站点配置目录不是普通目录')
mkdirSync(manifestDirectory, { recursive: true })
if (realpathSync(manifestDirectory) !== manifestDirectory) throw new Error('站点配置目录存在重定向')
if (existsSync(manifestPath) && (lstatSync(manifestPath).isSymbolicLink() || !lstatSync(manifestPath).isFile())) throw new Error('站点配置不是普通文件')
if (existsSync(manifestPath) && JSON.parse(readFileSync(manifestPath, 'utf8')).project_id !== config.站点编号) throw new Error('拒绝覆盖其他站点')
writeFileSync(manifestPath, `${JSON.stringify({ project_id: config.站点编号, static: { directory: 'dist', not_found_handling: '404-page' } }, null, 2)}\n`)
const build = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', output, '--emptyOutDir'], {
  cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, SITE_ORIGIN: origin },
})
if (build.status !== 0) throw new Error('匿名演示构建失败')
copyFileSync(path.join(output, 'not-found.html'), path.join(output, '404.html'))
console.log(JSON.stringify({ project_id: config.站点编号, origin, checkout, output, audience: 'unchanged', uploaded: false }))
