/** 实际单范围函数 + 本机 HTTP 请求验收；临时资源、句柄和服务器均在 finally 清理。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncBuiltinESMExports } from 'node:module'
import { parseByteRange, sendMediaFile } from './media-http.mjs'

const fixture = Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 256))
const checks = [
  [undefined, 4096, { kind: 'full' }],
  ['bytes=0-0', 4096, { kind: 'partial', start: 0, end: 0 }],
  ['bytes=200-', 4096, { kind: 'partial', start: 200, end: 4095 }],
  ['bytes=-1024', 4096, { kind: 'partial', start: 3072, end: 4095 }],
  ['bytes=-999999999999999999999999', 4096, { kind: 'partial', start: 0, end: 4095 }],
  ['bytes=4000-999999999999999999999', 4096, { kind: 'partial', start: 4000, end: 4095 }],
  ['bytes=0-1,3-4', 4096, { kind: 'full' }],
  ['bytes=-0', 4096, { kind: 'unsatisfiable' }],
  ['bytes=4096-', 4096, { kind: 'unsatisfiable' }],
  ['bytes=999999999999999999999-', 4096, { kind: 'unsatisfiable' }],
  ['bytes=40-20', 4096, { kind: 'unsatisfiable' }],
  ['bytes=-', 4096, { kind: 'unsatisfiable' }],
  ['bytes=a-b', 4096, { kind: 'unsatisfiable' }],
  ['garbage bytes=0-1', 4096, { kind: 'unsatisfiable' }],
  ['bytes=0-1 trailing', 4096, { kind: 'unsatisfiable' }],
  ['items=0-1', 4096, { kind: 'unsatisfiable' }],
  [undefined, 0, { kind: 'full' }],
  ['bytes=0-', 0, { kind: 'unsatisfiable' }],
]
for (const [header, size, expected] of checks) assert.deepEqual(parseByteRange(header, size), expected, header)

const directory = fs.mkdtempSync(join(tmpdir(), 'portfolio-media-range-'))
const file = join(directory, 'fixture.mp4'), empty = join(directory, 'empty.mp4'), large = join(directory, 'large.mp4')
fs.writeFileSync(file, fixture)
fs.writeFileSync(empty, Buffer.alloc(0))
fs.writeFileSync(large, Buffer.alloc(8 * 1024 * 1024, 19))
// 包裹真实 createReadStream 记录句柄；仍由操作系统读取，HEAD 必须不创建任何流。
const createReadStream = fs.createReadStream
const streams = []
fs.createReadStream = (...args) => {
  const stream = createReadStream(...args)
  streams.push(stream)
  return stream
}
syncBuiltinESMExports()
const server = http.createServer((req, res) => {
  const path = req.url === '/empty' ? empty : req.url === '/large' ? large : req.url === '/head-no-file' ? join(directory, 'missing.mp4') : file
  const size = req.url === '/empty' ? 0 : req.url === '/large' ? 8 * 1024 * 1024 : fixture.length
  sendMediaFile(req, res, path, { size, type: 'video/mp4' })
})
const timeout = (promise, message) => Promise.race([promise, new Promise((_, reject) => {
  const timer = setTimeout(() => reject(Error(message)), 2500)
  timer.unref()
})])
function request(port, range, method = 'GET', path = '/') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: range ? { Range: range } : {} }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
      res.once('error', reject)
    })
    req.once('error', reject)
    req.end()
  })
}
let httpCases = 0
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const { port } = server.address()
  for (const [range, status, start, end] of [
    [undefined, 200, 0, 4095], ['bytes=0-0', 206, 0, 0], ['bytes=200-', 206, 200, 4095],
    ['bytes=-1024', 206, 3072, 4095], ['bytes=4000-99999', 206, 4000, 4095],
    ['bytes=-99999', 206, 0, 4095], ['bytes=0-1,3-4', 200, 0, 4095],
  ]) {
    const res = await request(port, range)
    assert.equal(res.status, status, range)
    assert.equal(res.headers['content-length'], String(end - start + 1))
    assert.equal(res.headers['content-range'], status === 206 ? `bytes ${start}-${end}/4096` : undefined)
    assert.equal(res.headers['accept-ranges'], 'bytes')
    assert.deepEqual(res.body, fixture.subarray(start, end + 1))
    httpCases++
  }
  for (const range of ['bytes=4096-', 'bytes=200-20', 'bytes=-0', 'bytes=a-b']) {
    const res = await request(port, range)
    assert.equal(res.status, 416)
    assert.equal(res.headers['content-range'], 'bytes */4096')
    assert.equal(res.body.length, 0)
    httpCases++
  }
  for (const range of [undefined, 'bytes=-1024', 'bytes=99999-']) {
    const before = streams.length
    const res = await request(port, range, 'HEAD', '/head-no-file')
    assert.equal(res.status, 200)
    assert.equal(res.headers['content-length'], '4096')
    assert.equal(res.headers['content-range'], undefined)
    assert.equal(res.body.length, 0)
    assert.equal(streams.length, before, 'HEAD 不得创建文件读取流')
    httpCases++
  }
  const emptyFull = await request(port, undefined, 'GET', '/empty')
  assert.equal(emptyFull.status, 200); assert.equal(emptyFull.body.length, 0); httpCases++
  const emptyRange = await request(port, 'bytes=0-', 'GET', '/empty')
  assert.equal(emptyRange.status, 416); assert.equal(emptyRange.headers['content-range'], 'bytes */0'); httpCases++

  await new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/large' }, res => {
      res.once('data', () => { req.destroy(); resolve() })
    })
    req.once('error', reject)
  })
  const aborted = streams.at(-1)
  if (!aborted.closed) await timeout(new Promise(resolve => aborted.once('close', resolve)), '中断后文件流未关闭')
  assert.equal(aborted.destroyed, true)
  assert.equal(aborted.closed, true)
  // Windows 上移动回来也必须成功，确认源文件未被未释放的读取句柄占住。
  fs.renameSync(large, `${large}.moved`); fs.renameSync(`${large}.moved`, large)
  httpCases++
  console.log(JSON.stringify({ status: 'PASS', functionCases: checks.length, httpCases,
    checks: '真实 HTTP 字节内容、200/206/416 响应头、HEAD 零读取、空文件、客户端中断后的流关闭' }, null, 2))
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  for (const stream of streams) stream.destroy()
  fs.createReadStream = createReadStream
  syncBuiltinESMExports()
  for (const path of [file, empty, large, `${large}.moved`]) if (fs.existsSync(path)) fs.unlinkSync(path)
  fs.rmdirSync(directory)
}
