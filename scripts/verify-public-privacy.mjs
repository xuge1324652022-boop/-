/** 隔离 Git 夹具检查真实隐私门禁；不访问网络，不读取本机认证。 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  checkPublicPrivacy,
  forbiddenPublicPath,
  publicText,
  textPrivacyCategories,
} from './检查公开隐私.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = join(root, 'tmp', 'privacy-gate-tests')
await mkdir(temporary, { recursive: true })
const work = await mkdtemp(join(temporary, 'case-'))
const profile = await readFile(join(root, 'src/data/aboutProfile.ts'))
const visualSource = await readFile(join(root, 'src/data/visualPortfolio.ts'), 'utf8')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sample = Buffer.from('generated fixture media')
const fakeEmail = ['fixture', 'example.invalid'].join('@')
let count = 0
let cases = 0
const visualFiles = [
  ['sample-photo', 26],
  ['sample-poster', 10],
].flatMap(([prefix, total]) =>
  Array.from({ length: total }, (_, index) => String(index + 1).padStart(2, '0')).flatMap(
    (number) =>
      [400, 1600, 2560].map((size) => `public/portfolio/${prefix}-${number}-${size}.webp`),
  ),
)

async function put(project, file, bytes) {
  const absolute = join(project, ...file.split('/'))
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, bytes)
}

function git(project, ...args) {
  return execFileSync('git', ['-C', project, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

async function fixture({ withVisuals = false } = {}) {
  const project = join(work, String(++count))
  await mkdir(project)
  const rows = []
  for (let index = 0; index < 101; index++) {
    const file = `public/fixture-${index}.jpg`
    await put(project, file, sample)
    rows.push({ path: file, sha256: sha256(sample) })
  }
  if (withVisuals) {
    await put(project, 'src/data/visualPortfolio.ts', visualSource)
    for (const file of visualFiles) {
      await put(project, file, sample)
      rows.push({ path: file, sha256: sha256(sample) })
    }
  }
  await put(project, 'public/模板素材清单.json', JSON.stringify({ files: rows }))
  await put(project, '发布配置/公开第三方素材.json', JSON.stringify({ files: [] }))
  await put(project, 'src/data/aboutProfile.ts', profile)
  await put(project, 'README.md', 'Fictional template fixture')
  git(project, 'init', '--quiet')
  git(project, 'config', 'core.autocrlf', 'false')
  git(project, 'add', '--all')
  return project
}

function inspect(project) {
  const previous = process.cwd()
  try {
    process.chdir(project)
    return checkPublicPrivacy()
  } finally {
    process.chdir(previous)
  }
}

async function check(title, task) {
  await task()
  cases++
  console.log(`PASS ${title}`)
}

try {
  await check('a clean staged template passes the actual project scan', async () => {
    assert.equal(inspect(await fixture()).passed, true)
  })
  await check('the actual visual module and all 108 numbered assets pass together', async () => {
    assert.equal(inspect(await fixture({ withVisuals: true })).passed, true)
  })
  await check('replacing image bytes cannot retain a non-template visual title', async () => {
    for (const [before, after] of [
      ["'图像示例 01'", "'虚构场景练习'"],
      ["'Image sample 01'", "'Imaginary study'"],
    ]) {
      const project = await fixture({ withVisuals: true })
      const source = visualSource.replace(before, after)
      assert.notEqual(source, visualSource)
      await put(project, 'src/data/visualPortfolio.ts', source)
      git(project, 'add', 'src/data/visualPortfolio.ts')
      assert(
        inspect(project).problems.some(([category]) => category === 'non-template-visual-title'),
      )
    }
  })
  await check('both alt text languages must identify synthetic sample imagery', async () => {
    for (const source of [
      visualSource.replace(/'横向合成几何示例 01，[^']*'/u, "'虚构几何构图'"),
      visualSource.replace(
        /'Landscape synthetic geometric sample 01,[^']*'/u,
        "'An illustration of a fictional scene'",
      ),
    ]) {
      const project = await fixture({ withVisuals: true })
      assert.notEqual(source, visualSource)
      await put(project, 'src/data/visualPortfolio.ts', source)
      git(project, 'add', 'src/data/visualPortfolio.ts')
      assert(inspect(project).problems.some(([category]) => category === 'non-template-visual-alt'))
    }
  })
  await check(
    'a legacy-style identifier and mismatched paths fail the actual module gate',
    async () => {
      const project = await fixture({ withVisuals: true })
      const source = visualSource
        .replaceAll('sample-photo-01', 'fictional-scene-01')
        .replace(
          'src: `/portfolio/${id}-1600.webp`',
          'src: `/portfolio/unregistered-${id}-1600.webp`',
        )
      assert.notEqual(source, visualSource)
      await put(project, 'src/data/visualPortfolio.ts', source)
      git(project, 'add', 'src/data/visualPortfolio.ts')
      const result = inspect(project)
      for (const expected of ['non-template-visual-id', 'non-template-visual-path'])
        assert(result.problems.some(([category]) => category === expected))
      assert(!JSON.stringify(result.problems).includes('fictional-scene-01'))
    },
  )
  await check(
    'unregistered portfolio files cannot ship alongside approved numbered images',
    async () => {
      const project = await fixture({ withVisuals: true })
      await put(project, 'public/portfolio/unregistered-demo-1600.webp', sample)
      assert(
        inspect(project).problems.some(
          ([category]) => category === 'unexpected-template-visual-asset',
        ),
      )
    },
  )
  await check('the numbered visual assets must also exist in the approval manifest', async () => {
    const project = await fixture({ withVisuals: true })
    const file = join(project, 'public/模板素材清单.json')
    const manifest = JSON.parse(await readFile(file, 'utf8'))
    manifest.files = manifest.files.filter((row) => row.path !== visualFiles[0])
    await writeFile(file, JSON.stringify(manifest))
    git(project, 'add', 'public/模板素材清单.json')
    assert(
      inspect(project).problems.some(
        ([category]) => category === 'unapproved-template-visual-asset',
      ),
    )
  })
  await check('a missing numbered image fails even after its approval row is removed', async () => {
    const project = await fixture({ withVisuals: true })
    await unlink(join(project, visualFiles[0]))
    const file = join(project, 'public/模板素材清单.json')
    const manifest = JSON.parse(await readFile(file, 'utf8'))
    manifest.files = manifest.files.filter((row) => row.path !== visualFiles[0])
    await writeFile(file, JSON.stringify(manifest))
    git(project, 'add', '--all')
    assert(
      inspect(project).problems.some(([category]) => category === 'missing-template-visual-asset'),
    )
  })
  await check('an untracked SVG is scanned for non-example contact details', async () => {
    const project = await fixture()
    await put(project, 'new.svg', `<svg><text>${fakeEmail}</text></svg>`)
    assert(
      inspect(project).problems.some(
        ([category, file]) => category === 'non-example-email' && file === 'new.svg',
      ),
    )
  })
  await check('CSV and shell files cannot bypass extension-independent text scanning', async () => {
    const project = await fixture()
    for (const file of ['data.csv', 'helper.ps1']) await put(project, file, fakeEmail)
    const result = inspect(project)
    for (const file of ['data.csv', 'helper.ps1'])
      assert(
        result.problems.some(
          ([category, path]) => category === 'non-example-email' && path === file,
        ),
      )
  })
  await check('an unknown binary format is refused by default', async () => {
    const project = await fixture()
    await put(project, 'unreviewed.blob', Buffer.from([0, 255, 1, 254]))
    assert(inspect(project).problems.some(([category]) => category === 'unapproved-binary'))
  })
  await check('worktree bytes differing from the index fail the gate', async () => {
    const project = await fixture()
    await put(project, 'README.md', 'Changed but not staged')
    assert(inspect(project).problems.some(([category]) => category === 'index-worktree-mismatch'))
  })
  await check('clean worktree text cannot conceal private bytes already staged', async () => {
    const project = await fixture()
    await put(project, 'README.md', fakeEmail)
    git(project, 'add', 'README.md')
    await put(project, 'README.md', 'Harmless current text')
    assert(inspect(project).problems.some(([category]) => category === 'index-worktree-mismatch'))
  })
  await check('a hidden credential filename is refused even with innocent contents', async () => {
    const project = await fixture()
    await put(project, '.env', 'DEMO=value')
    assert(inspect(project).problems.some(([category]) => category === 'credential-path'))
  })
  await check(
    'gitignored files under public are still scanned before Vite can copy them',
    async () => {
      const project = await fixture()
      await put(project, '.gitignore', 'public/hidden.blob\n')
      git(project, 'add', '.gitignore')
      await put(project, 'public/hidden.blob', Buffer.from([0, 255, 2]))
      assert(
        inspect(project).problems.some(
          ([category, file]) => category === 'unapproved-binary' && file === 'public/hidden.blob',
        ),
      )
    },
  )
  await check(
    'symbolic link entries in the Git index are not treated as regular files',
    async () => {
      const project = await fixture()
      const object = git(project, 'rev-parse', ':README.md').trim()
      git(project, 'update-index', '--add', '--cacheinfo', `120000,${object},linked`)
      assert(inspect(project).problems.some(([category]) => category === 'non-regular-index-entry'))
    },
  )
  await check('an asset directory junction is rejected without following it', async () => {
    const project = await fixture()
    await put(project, 'safe-target/ordinary.txt', 'Fictional fixture')
    const linked = join(project, 'public', 'linked')
    await symlink(join(project, 'safe-target'), linked, 'junction')
    try {
      assert(inspect(project).problems.some(([category]) => category === 'non-regular-file'))
    } finally {
      await unlink(linked)
    }
  })
  await check('binary files with ASCII contents still require explicit approval', async () => {
    assert.equal(publicText(Buffer.from('fixture'), 'resume.pdf'), null)
    assert.equal(publicText(Buffer.from([0xff, 0xfe]), 'unknown.data'), null)
  })
  await check('private directory and credential path rules also cover nested names', async () => {
    assert.equal(forbiddenPublicPath('本机私有资料/file.txt'), 'private-directory')
    assert.equal(forbiddenPublicPath('deploy/.npmrc'), 'credential-path')
    assert.equal(forbiddenPublicPath('.env.example'), null)
  })
  await check(
    'inline media and fingerprints return categories without echoing values',
    async () => {
      const media = ['data:application/pdf;base64,', 'A'.repeat(120)].join('')
      assert(textPrivacyCategories(media).includes('embedded-unreviewed-media'))
      assert.deepEqual(textPrivacyCategories('Fixture Profile', ['fixture profile']), [
        'local-private-fingerprint',
      ])
      assert.deepEqual(textPrivacyCategories(fakeEmail), ['non-example-email'])
    },
  )
  console.log(JSON.stringify({ passed: true, cases, networkRequests: 0 }))
} finally {
  assert.equal(dirname(work), temporary)
  const stat = await lstat(work)
  assert(stat.isDirectory() && !stat.isSymbolicLink())
  await rm(work, { recursive: true, force: true })
}
