import { createReadStream } from 'node:fs'

/** 只实现单个 bytes 范围；多范围忽略为完整响应，避免伪造不完整的 multipart 206。 */
export function parseByteRange(header, size) {
  if (!header) return { kind: 'full' }
  const value = String(header).trim()
  if (/^bytes=/i.test(value) && value.includes(',')) return { kind: 'full' }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value)
  if (!match || (!match[1] && !match[2]) || size === 0) return { kind: 'unsatisfiable' }

  // BigInt 允许合法的大整数；超大 suffix 表示整个文件，而不是 Number 溢出。
  const length = BigInt(size)
  if (!match[1]) {
    const suffix = BigInt(match[2])
    if (suffix === 0n) return { kind: 'unsatisfiable' }
    return { kind: 'partial', start: Number(suffix >= length ? 0n : length - suffix), end: size - 1 }
  }
  const start = BigInt(match[1])
  const end = match[2] ? BigInt(match[2]) : length - 1n
  if (start >= length || end < start) return { kind: 'unsatisfiable' }
  return { kind: 'partial', start: Number(start), end: Number(end >= length ? length - 1n : end) }
}

/** dev/preview 共用的媒体响应；HEAD 不创建文件流，中断请求立即释放文件句柄。 */
export function sendMediaFile(req, res, file, { size, type }) {
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', type)
  // Range 只适用于 GET；HEAD 使用完整响应头，并且绝不读取文件。
  const range = req.method === 'HEAD' ? { kind: 'full' } : parseByteRange(req.headers.range, size)
  if (range.kind === 'unsatisfiable') {
    res.statusCode = 416
    res.setHeader('Content-Range', `bytes */${size}`)
    res.setHeader('Content-Length', 0)
    res.end()
    return
  }
  const partial = range.kind === 'partial'
  res.statusCode = partial ? 206 : 200
  res.setHeader('Content-Length', partial ? range.end - range.start + 1 : size)
  if (partial) res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
  if (req.method === 'HEAD') { res.end(); return }

  const stream = createReadStream(file, partial ? { start: range.start, end: range.end } : undefined)
  const release = () => stream.destroy()
  res.once('close', release)
  res.once('error', release)
  // 避免正常读完后仍保留关闭回调；失败或浏览器取消读取时同样成对清理。
  stream.once('close', () => {
    res.removeListener('close', release)
    res.removeListener('error', release)
  })
  stream.once('error', error => res.destroy(error))
  stream.pipe(res)
}
