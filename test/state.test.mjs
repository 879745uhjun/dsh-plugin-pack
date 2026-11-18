import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { listPacks } from '../index.js'
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

test('readPack rejects a buffer that is not an archive', async () => {
  await assert.rejects(() => readPack(Buffer.from('nope')), /end-of-central-directory|zip/i)
})
