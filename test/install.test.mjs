import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { installPack, planInstall } from '../lib/install.mjs'
import { createPack, readPack } from '../lib/pack.mjs'

/** A profile with one installed plugin, plus a pack built from a richer source profile. */
async function makeWorld() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pack-install-'))
  const home = join(root, '.dsh')
  const source = join(home, 'profiles', 'source')
  const target = join(home, 'profiles', 'target')
  const plugin = async (profileDir, name, version) => {
    const dir = join(profileDir, 'node_modules', name)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version, engines: { dsh: '>=0.2.2 <0.3.0' } }))
    await writeFile(join(dir, 'index.js'), 'export const name = ' + JSON.stringify(name) + '\n')
  }
  await plugin(source, 'dsh-alpha', '1.0.0')
  await plugin(source, 'dsh-beta', '0.3.1')
  await writeFile(
    join(source, 'package.json'),
    JSON.stringify({
      name: 'source',
      dependencies: { 'dsh-alpha': 'link:D:/a', 'dsh-beta': 'link:D:/b' },
      dsh: { profile: { bundles: ['dsh-alpha', 'dsh-beta'] } },
    }),
  )
  await mkdir(target, { recursive: true })
  await plugin(target, 'dsh-alpha', '1.0.0')
  await writeFile(
    join(target, 'package.json'),
    JSON.stringify({ name: 'target', dependencies: { 'dsh-alpha': 'link:D:/a' }, dsh: { profile: { bundles: ['dsh-alpha'] } } }),
  )
  await writeFile(join(target, 'cordis.patch.yml'), '- id: dsh-alpha\n  name: dsh-alpha\n')
  const packFile = join(root, 'test.dshpack')
  await createPack({ profileDir: source, home, name: 'test', version: '1.0.0', targetDsh: '0.2.4', out: packFile })
  return { home, source, target, packFile }
}

test('planInstall marks add, skip and replace', async () => {
  const { target, packFile } = await makeWorld()
  const pack = await readPack(packFile)
  const plan = await planInstall({ pack, profileDir: target })
  const byName = Object.fromEntries(plan.actions.map((action) => [action.name, action]))
  assert.equal(byName['dsh-alpha'].action, 'skip')
  assert.equal(byName['dsh-beta'].action, 'add')
})

test('installPack materialises plugins and rewrites the profile manifest', async () => {
  const { home, target, packFile } = await makeWorld()
  const result = await installPack({ packFile, profileDir: target, home })
  assert.equal(result.pending.length, 1)
  assert.ok(existsSync(join(target, 'plugins', 'dsh-beta', 'package.json')))
  assert.ok(existsSync(join(target, 'node_modules', 'dsh-beta', 'package.json')))

  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies['dsh-beta'], 'file:./plugins/dsh-beta')
  assert.deepEqual(pkg.dsh.profile.bundles, ['dsh-alpha', 'dsh-beta'])

  const patch = await readFile(join(target, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /- id: dsh-beta/)

  assert.ok(existsSync(join(result.backupDir, 'package.json')))
  assert.ok(existsSync(join(result.backupDir, 'plan.json')))
})

test('a second install is a no-op', async () => {
  const { home, target, packFile } = await makeWorld()
  await installPack({ packFile, profileDir: target, home })
  const again = await installPack({ packFile, profileDir: target, home })
  assert.equal(again.pending.length, 0)
})

test('dryRun changes nothing', async () => {
  const { home, target, packFile } = await makeWorld()
  const before = await readFile(join(target, 'package.json'), 'utf8')
  const result = await installPack({ packFile, profileDir: target, home, dryRun: true })
  assert.equal(result.pending.length, 1)
  assert.equal(await readFile(join(target, 'package.json'), 'utf8'), before)
  assert.ok(!existsSync(join(target, 'plugins', 'dsh-beta')))
})

test('skip keeps a plugin out even when it is missing', async () => {
  const { home, target, packFile } = await makeWorld()
  const result = await installPack({ packFile, profileDir: target, home, skip: ['dsh-beta'] })
  assert.equal(result.pending.length, 0)
  assert.ok(!existsSync(join(target, 'plugins', 'dsh-beta')))
})
