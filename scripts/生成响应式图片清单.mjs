/** 从已交付 WebP 读取真实像素宽度，避免将“最长边400”误写成400w。 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'src/data/imageVariants.json')
const check = process.argv.includes('--check')

function dimensions(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('不是 WebP')
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4)
    const length = bytes.readUInt32LE(offset + 4)
    const data = offset + 8
    if (data + length > bytes.length) throw new Error('WebP 分块不完整')
    if (kind === 'VP8X' && length >= 10) return { width: bytes.readUIntLE(data + 4, 3) + 1, height: bytes.readUIntLE(data + 7, 3) + 1 }
    if (kind === 'VP8 ' && length >= 10) return { width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff }
    if (kind === 'VP8L' && length >= 5 && bytes[data] === 0x2f) {
      const bits = bytes.readUInt32LE(data + 1)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    offset = data + length + (length & 1)
  }
  throw new Error('WebP 缺少画面尺寸')
}

const entries = []
for (const directory of ['portfolio', 'internship-clean', 'about']) {
  for (const file of readdirSync(path.join(root, 'public', directory)).sort()) {
    if (!(directory === 'about' ? /^portrait-(400|900|1448)\.webp$/u.test(file) : /-(400|1600|2560)\.webp$/u.test(file))) continue
    const bytes = readFileSync(path.join(root, 'public', directory, file))
    const size = dimensions(bytes)
    if (size.width <= 0 || size.height <= 0) throw new Error(`图片尺寸无效：${file}`)
    entries.push([`/${directory}/${file}`, size])
  }
}
const content = `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`
if (check) {
  if (readFileSync(target, 'utf8').replace(/\r\n/gu, '\n') !== content) throw new Error('图片清单已过期，请运行 node scripts/生成响应式图片清单.mjs')
} else writeFileSync(target, content)
console.log(`PASS：${entries.length} 张响应式图片的真实像素尺寸${check ? '校验' : '登记'}完成`)
