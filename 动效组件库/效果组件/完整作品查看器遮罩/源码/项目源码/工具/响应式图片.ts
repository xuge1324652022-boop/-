import variants from '../数据/图片实际尺寸.json'

interface ImageSources { src: string; thumb: string; large: string }
const dimensions: Readonly<Record<string, { width: number; height: number }>> = variants

/** 宽度描述符必须是文件真实宽度；竖版素材的400档通常只有267像素宽。 */
export function visualImageSources(item: ImageSources): string {
  const widths = new Map<number, string>()
  for (const source of [item.thumb, item.src, item.large]) {
    const size = dimensions[source.split('?')[0]!]
    if (!size) throw new Error(`响应式图片未登记：${source}`)
    if (!widths.has(size.width)) widths.set(size.width, source)
  }
  return [...widths].sort(([a], [b]) => a - b).map(([width, source]) => `${source} ${width}w`).join(', ')
}

/** 查看器受舞台宽高共同限制，竖图不能按整个视口宽度估算。 */
export function viewerImageSizes(item: { width: number; height: number }): string {
  const ratio = item.width / item.height
  return `(max-width: 760px) min(calc(100vw - 48px), ${Math.round(72 * ratio)}vh), min(86vw, ${Math.round(76 * ratio)}vh)`
}
