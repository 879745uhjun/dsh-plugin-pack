import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createInstallHandler, highestTag, highestVersion, listPacks } from '../index.js'
import { createPack, readPack } from '../lib/pack.mjs'

/** A one-plugin profile that can be packed. */
async function makeSource() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pack-state-'))
  const home = join(root, '.dsh')
  const profileDir = join(home, 'profiles', 'desktop')
  const pluginDir = join(profileDir, 'node_modules', 'dsh-demo')
  await mkdir(pluginDir, { recursive: true })
  await writeFile(join(pluginDir, 'package.json'), JSON.stringify({ name: 'dsh-demo', version: '1.2.3' }))
  await writeFile(join(pluginDir, 'index.js'), 'export const name = "dsh-demo"\n')
  await writeFile(
    join(profileDir, 'package.json'),
    JSON.stringify({ name: 'p', dependencies: { 'dsh-demo': 'link:D:/demo' }, dsh: { profile: { bundles: ['dsh-demo'] } } }),
  )
  return { root, home, profileDir }
}

test('highestTag picks the newest semver tag and ignores noise', () => {
  const stdout = [
    'a1\trefs/tags/v1.2.0',
    'b2\trefs/tags/v1.10.0',
    'c3\trefs/tags/v1.9.9',
    'd4\trefs/tags/nightly',
    'e5\trefs/tags/v0.9.0',
  ].join('\n')
  assert.equal(highestTag(stdout), '1.10.0')
  assert.equal(highestTag(''), null)
  assert.equal(highestTag('nothing here'), null)
  assert.equal(highestVersion(['v2.0.0', '1.9.9', 'nightly']), '2.0.0')
})

test('host and lib never assign an unawaited async call', async () => {
  const files = ['index.js', 'lib/pack.mjs', 'lib/install.mjs', 'lib/scan.mjs']
  const pattern = /(?:const|let|var)\s+\w+\s*=\s*(readPack|createPack|installPack|scanProfile|readFile|readdir|stat|writeFile|mkdir|cp|rm|rename|symlink|listPacks)\(/
  const offenders = []
  for (const file of files) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8')
    source.split('\n').forEach((line, index) => {
      if (pattern.test(line) && !line.includes('await ')) offenders.push(file + ':' + (index + 1) + ' ' + line.trim())
    })
  }
  assert.deepEqual(offenders, [])
})

test('listPacks reads a real pack and survives a corrupt one', async () => {
  const { home, profileDir } = await makeSource()
  const dir = join(home, 'plugin-packs')
  await mkdir(dir, { recursive: true })
  await createPack({ profileDir, home, name: 'good', version: '2.0.0', out: join(dir, 'good-2.0.0.dshpack') })
  await writeFile(join(dir, 'broken.dshpack'), Buffer.from('not a zip at all'))

  const packs = await listPacks(home)
  assert.equal(packs.length, 2)
  const good = packs.find((pack) => pack.name === 'good')
  assert.equal(good.version, '2.0.0')
  assert.equal(good.plugins, 1)
  assert.equal(good.verified, true)
  const broken = packs.find((pack) => pack.file.endsWith('broken.dshpack'))
  assert.ok(broken.error, 'the corrupt pack reports an error instead of throwing')
  assert.equal(broken.verified, false)
})

test('listPacks returns an empty list when no pack directory exists', async () => {
  const { home } = await makeSource()
  assert.deepEqual(await listPacks(home), [])
})

test('readPack accepts a path or the archive bytes', async () => {
  const { home, profileDir } = await makeSource()
  const file = join(home, 'one.dshpack')
  await createPack({ profileDir, home, name: 'one', version: '1.0.0', out: file })
  const fromPath = await readPack(file)
  const fromBuffer = await readPack(await readFile(file))
  assert.equal(fromBuffer.manifest.name, fromPath.manifest.name)
  assert.equal(fromBuffer.files.size, fromPath.files.size)
})

/** Minimal request emitter for the route handlers. */
function fakeRequest(body) {
  const req = new EventEmitter()
  req.method = 'POST'
  req.headers = {}
  process.nextTick(() => {
    req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  return req
}

/** Minimal response collector for the route handlers. */
function fakeResponse() {
  const res = { status: 0, body: '' }
  res.writeHead = (status) => {
    res.status = status
  }
  res.end = (chunk) => {
    res.body += chunk ?? ''
  }
  return res
}

test('install preflight answers with actions for a real pack', async () => {
  const { home, profileDir } = await makeSource()
  const dir = join(home, 'plugin-packs')
  await mkdir(dir, { recursive: true })
  const file = join(dir, 'good-1.0.0.dshpack')
  await createPack({ profileDir, home, name: 'good', version: '1.0.0', out: file })

  const handler = createInstallHandler({ get: () => home }, () => {})
  const request = fakeRequest(JSON.stringify({ file, dryRun: true }))
  const response = fakeResponse()
  await handler(request, response)

  assert.equal(response.status, 200)
  const payload = JSON.parse(response.body)
  assert.equal(payload.ok, true)
  assert.equal(payload.actions.length, 1)
  assert.equal(payload.actions[0].name, 'dsh-demo')
  assert.ok(Array.isArray(payload.conflicts))
})

test('readPack rejects a buffer that is not an archive', async () => {
  await assert.rejects(() => readPack(Buffer.from('nope')), /end-of-central-directory|zip/i)
})
