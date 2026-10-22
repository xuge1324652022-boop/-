/** 仅用本地 ASSETS mock 验证媒体 Worker，不访问云端。 */
import assert from 'node:assert/strict'
import worker from '../deploy/media-range.mjs'

const payload = Uint8Array.from({ length: 100 }, (_, index) => index)
const modified = 'Mon, 19 Oct 2026 00:00:00 GMT'
function mock({ size = 100, status = 200, chunk = 3, etag = '"version-1"' } = {}) {
  const state = { reads: 0, cancelled: false, request: null }
  const env = {
    MEDIA_SIZES: JSON.stringify({ '/color/test clip.mp4': size, '/resume.pdf': size, '/empty.mp4': 0 }),
    ASSETS: {
      async fetch(request) {
        state.request = request
        let offset = 0
        const body = request.method === 'HEAD' ? null : new ReadableStream({
          pull(controller) {
            state.reads++
            if (offset >= payload.length) { controller.close(); return }
            controller.enqueue(payload.slice(offset, offset += chunk))
          },
          cancel() { state.cancelled = true },
        }, { highWaterMark: 0 })
        return new Response(body, { status, headers: {
          'Content-Type': request.url.endsWith('.pdf') ? 'application/pdf' : 'video/mp4',
          'Content-Length': String(size), 'ETag': etag, 'Last-Modified': modified,
          'Cache-Control': 'public, max-age=3600', 'Content-Encoding': 'identity',
        } })
      },
    },
  }
  return { env, state }
}
const req = (headers = {}, method = 'GET', path = '/color/test%20clip.mp4') => new Request(`https://example.test${path}`, { method, headers })
async function bytes(response) {
  const result = []
  for await (const chunk of response.body) result.push(...chunk)
  return result
}

for (const [range, expected] of [
  ['bytes=0-7', [0, 7]], ['bytes=11-18', [11, 18]], ['bytes=97-', [97, 99]],
  ['bytes=-5', [95, 99]], ['bytes=95-999999999999999999999', [95, 99]],
  ['bytes=-999999999999999999999', [0, 99]], ['bytes=0-0', [0, 0]],
]) {
  const { env, state } = mock()
  const response = await worker.fetch(req({ Range: range, 'Accept-Encoding': 'gzip' }), env)
  assert.equal(response.status, 206, range)
  assert.equal(response.headers.get('Content-Range'), `bytes ${expected[0]}-${expected[1]}/100`)
  assert.equal(response.headers.get('Content-Length'), String(expected[1] - expected[0] + 1))
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes')
  assert.equal(response.headers.get('Content-Type'), 'video/mp4')
  assert.equal(response.headers.get('ETag'), '"version-1"')
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600')
  assert.equal(response.headers.get('Content-Encoding'), null)
  assert.equal(state.request.headers.get('Range'), null)
  assert.equal(state.request.headers.get('If-Range'), null)
  assert.equal(state.request.headers.get('Accept-Encoding'), 'identity')
  assert.deepEqual(await bytes(response), [...payload.slice(expected[0], expected[1] + 1)])
  assert(state.cancelled, '区间完成后应取消上游剩余内容')
}
for (const range of ['bytes=100-', 'bytes=12-3', 'bytes=-0', 'bytes=-', 'bytes=abc', 'bytes=999999999999999999999-', 'bytes=', 'bytes']) {
  const { env, state } = mock()
  const response = await worker.fetch(req({ Range: range }), env)
  assert.equal(response.status, 416, range)
  assert.equal(response.headers.get('Content-Range'), 'bytes */100')
  assert.equal(response.headers.get('Content-Length'), '0')
  assert.equal(await response.text(), '')
  assert.equal(state.reads, 0)
  assert(state.cancelled)
}
for (const range of [undefined, 'items=0-2', 'bytes=0-1,5-7']) {
  const { env } = mock()
  const response = await worker.fetch(req(range ? { Range: range } : {}), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Content-Length'), '100')
  assert.deepEqual(await bytes(response), [...payload])
}
for (const [condition, status] of [
  ['"version-1"', 206], ['"other"', 200], ['W/"version-1"', 200],
  [modified, 206], ['Sun, 18 Oct 2026 00:00:00 GMT', 200],
  ['Tue, 20 Oct 2026 00:00:00 GMT', 200], ['invalid-date', 200],
]) {
  const { env, state } = mock()
  const response = await worker.fetch(req({ Range: 'bytes=1-2', 'If-Range': condition }), env)
  assert.equal(response.status, status, condition)
  assert.equal(state.request.headers.get('If-Range'), null)
  assert.equal((await bytes(response)).length, status === 206 ? 2 : 100)
}
{
  const { env } = mock({ etag: 'W/"version-1"' })
  const response = await worker.fetch(req({ Range: 'bytes=0-3', 'If-Range': '"version-1"' }), env)
  assert.equal(response.status, 200)
  await response.body.cancel()
}
{
  const { env, state } = mock()
  const response = await worker.fetch(req({ Range: 'bytes=1-2' }, 'HEAD'), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Content-Length'), '100')
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes')
  assert.equal(response.body, null)
  assert.equal(state.reads, 0)
}
{
  const { env, state } = mock()
  const response = await worker.fetch(req({ Range: 'bytes=1-90' }), env)
  assert.equal(state.reads, 0, '返回响应不能预先读完整内容')
  const reader = response.body.getReader()
  const first = await reader.read()
  assert.deepEqual([...first.value], [1, 2])
  assert.equal(state.reads, 1)
  await reader.cancel('测试客户端中途退出')
  assert(state.cancelled)
  assert.equal(state.reads, 1)
}
for (const method of ['GET', 'POST']) {
  const { env, state } = mock({ status: 404 })
  const request = req({ Range: 'bytes=1-2' }, method, '/unknown.mp4')
  const response = await worker.fetch(request, env)
  assert.equal(response.status, 404)
  assert.equal(state.request, request, '未知路径或方法原样委托')
  await response.body.cancel()
}
{
  const { env, state } = mock()
  const request = req({ Range: 'bytes=1-2' }, 'POST')
  const response = await worker.fetch(request, env)
  assert.equal(state.request, request)
  assert.equal(response.headers.get('Accept-Ranges'), null)
  await response.body.cancel()
}
{
  const { env } = mock({ status: 403 })
  const response = await worker.fetch(req({ Range: 'bytes=1-2' }), env)
  assert.equal(response.status, 403)
  assert.equal(response.headers.get('Accept-Ranges'), null)
  await response.body.cancel()
}
{
  const { env } = mock()
  const response = await worker.fetch(req({ Range: 'bytes=0-7' }, 'GET', '/resume.pdf'), env)
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('Content-Type'), 'application/pdf')
  assert.deepEqual(await bytes(response), [...payload.slice(0, 8)])
  assert.equal((await worker.fetch(req({ Range: 'bytes=0-' }, 'GET', '/empty.mp4'), env)).status, 416)
}
{
  const { env } = mock({ size: 200 })
  const response = await worker.fetch(req({ Range: 'bytes=95-150' }), env)
  await assert.rejects(() => bytes(response), /提前结束/)
}
// Node 不提供 FixedLengthStream；用计数 TransformStream 验证 Worker 专用分支。
globalThis.FixedLengthStream = class extends TransformStream {
  constructor(length) {
    let written = 0
    super({ transform(chunk, controller) { written += chunk.byteLength; controller.enqueue(chunk) }, flush() { assert.equal(written, length) } })
  }
}
{
  const { env } = mock()
  const response = await worker.fetch(req({ Range: 'bytes=5-12' }), env)
  assert.deepEqual(await bytes(response), [...payload.slice(5, 13)])
}
{
  const { env, state } = mock()
  const response = await worker.fetch(req({ Range: 'bytes=0-99' }), env)
  const reader = response.body.getReader()
  await reader.read()
  await reader.cancel('测试 FixedLengthStream 管道取消')
  await new Promise(resolve => setImmediate(resolve))
  assert(state.cancelled)
  assert(state.reads < 10, '管道取消后不能继续读取完整视频')
}
delete globalThis.FixedLengthStream
console.log('PASS: GET/HEAD、单区间/后缀/416、If-Range、真实委托、逐块截断/取消、PDF、FixedLengthStream')
