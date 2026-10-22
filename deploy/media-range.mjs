/** 给已知大小的静态媒体补齐单区间 Range；不缓存或缓冲完整视频。 */
function parseRange(value, size) {
  if (!value) return null
  const separator = value.indexOf('=')
  if (separator < 0) return /^bytes(?:\s|$)/i.test(value.trim()) ? false : null
  if (value.slice(0, separator).trim().toLowerCase() !== 'bytes') return null
  const range = value.slice(separator + 1).trim()
  if (range.includes(',')) return null // 多区间允许退回完整响应。
  const match = /^(\d*)-(\d*)$/.exec(range)
  if (!match || (!match[1] && !match[2]) || size === 0) return false
  const length = BigInt(size)
  if (!match[1]) {
    const suffix = BigInt(match[2])
    if (suffix === 0n) return false
    return { start: Number(suffix >= length ? 0n : length - suffix), end: size - 1 }
  }
  const start = BigInt(match[1])
  const end = match[2] ? BigInt(match[2]) : length - 1n
  if (start >= length || end < start) return false
  return { start: Number(start), end: Number(end >= length ? length - 1n : end) }
}

function ifRangeMatches(value, headers) {
  if (!value) return true
  value = value.trim()
  if (value.startsWith('"')) {
    const etag = headers.get('ETag')
    return Boolean(etag && !etag.startsWith('W/') && value === etag)
  }
  if (value.startsWith('W/')) return false
  const modified = Date.parse(headers.get('Last-Modified') || '')
  const condition = Date.parse(value)
  return Number.isFinite(modified) && Number.isFinite(condition) && modified === condition
}

function sliceStream(body, start, length) {
  const reader = body.getReader()
  let skip = start
  let remaining = length
  let finished = false
  async function finish(reason) {
    if (finished) return
    finished = true
    try { await reader.cancel(reason) }
    finally { reader.releaseLock() }
  }
  return new ReadableStream({
    async pull(controller) {
      try {
        while (!finished && remaining > 0) {
          const { value, done } = await reader.read()
          if (finished) return
          if (done) throw new Error('媒体流提前结束，实际长度与清单不一致')
          if (skip >= value.byteLength) { skip -= value.byteLength; continue }
          const offset = skip
          skip = 0
          const count = Math.min(value.byteLength - offset, remaining)
          if (count) controller.enqueue(value.subarray(offset, offset + count))
          remaining -= count
          if (remaining === 0) {
            controller.close()
            await finish('所需区间已读取完成')
          }
          return
        }
      } catch (error) {
        controller.error(error)
        await finish(error).catch(() => {})
      }
    },
    cancel: finish,
  }, { highWaterMark: 0 })
}

function knownLength(body, length) {
  // Workers 只会为已知长度的流可靠生成 Content-Length；Node 测试保留普通流。
  return typeof FixedLengthStream === 'function' ? body.pipeThrough(new FixedLengthStream(length)) : body
}

/** asset-first 未命中才走这里；错误网址保持原地址并返回真正的 404 HTML。 */
async function fetchStaticPage(request, env, path) {
  const response = await env.ASSETS.fetch(request)
  if (response.status !== 404 || /(?:^|\/)\.[^/]/u.test(path)) return response
  const wantsHtml = (request.headers.get('Accept') || '').includes('text/html') || !/\.[^/]+$/u.test(path)
  if (!wantsHtml) return response
  const fallbackUrl = new URL('/not-found.html', request.url)
  const fallback = await env.ASSETS.fetch(new Request(fallbackUrl, { method: request.method }))
  if (fallback.status !== 200) return response
  await response.body?.cancel()
  const headers = new Headers(fallback.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Robots-Tag', 'noindex')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(request.method === 'HEAD' ? null : fallback.body, { status: 404, headers })
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request)
    let path
    try { path = decodeURIComponent(new URL(request.url).pathname) }
    catch { return env.ASSETS.fetch(request) }
    const sizes = JSON.parse(env.MEDIA_SIZES || '{}')
    const size = Object.hasOwn(sizes, path) ? sizes[path] : undefined
    if (!Number.isSafeInteger(size) || size < 0) return fetchStaticPage(request, env, path)
    const upstreamHeaders = new Headers(request.headers)
    upstreamHeaders.delete('Range')
    upstreamHeaders.delete('If-Range')
    upstreamHeaders.set('Accept-Encoding', 'identity')
    const upstream = await env.ASSETS.fetch(new Request(request, { headers: upstreamHeaders }))
    if (upstream.status !== 200) return upstream
    const headers = new Headers(upstream.headers)
    // 区间针对原始媒体字节；不能保留全文件压缩或传输编码的旧声明。
    headers.delete('Content-Encoding')
    headers.delete('Transfer-Encoding')
    headers.delete('Content-Range')
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Content-Length', String(size))
    if (request.method === 'HEAD') {
      await upstream.body?.cancel()
      return new Response(null, { status: 200, headers })
    }
    const range = ifRangeMatches(request.headers.get('If-Range'), headers) ? parseRange(request.headers.get('Range'), size) : null
    if (range === false) {
      await upstream.body?.cancel()
      headers.set('Content-Range', `bytes */${size}`)
      headers.set('Content-Length', '0')
      return new Response(null, { status: 416, headers })
    }
    if (!range) return new Response(upstream.body ? knownLength(upstream.body, size) : null, { status: 200, headers, encodeBody: 'manual' })
    const length = range.end - range.start + 1
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
    headers.set('Content-Length', String(length))
    if (!upstream.body) throw new Error('媒体响应缺少可读取的流')
    return new Response(knownLength(sliceStream(upstream.body, range.start, length), length), { status: 206, headers, encodeBody: 'manual' })
  },
}
