import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { installPack } from '../lib/install.mjs'
import { createPack } from '../lib/pack.mjs'
import { listBackups, restoreBackup } from '../lib/restore.mjs'

/**
 * A source profile with two plugins and a target profile that already runs an
 * older alpha through a junction, the way link: installs look in practice.
 */
async function makeWorld() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pack-restore-'))
  const home = join(root, '.dsh')
  const source = join(home, 'profiles', 'source')
  const target = join(home, 'profiles', 'target')
  const external = join(root, 'external')

  const writePlugin = async (dir, name, version) => {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version }))
    await writeFile(join(dir, 'index.js'), 'export const name = ' + JSON.stringify(name) + '\n')
  }

  await writePlugin(join(source, 'node_modules', 'dsh-alpha'), 'dsh-alpha', '1.0.0')
  await writePlugin(join(source, 'node_modules', 'dsh-beta'), 'dsh-beta', '0.3.1')
  await writeFile(
    join(source, 'package.json'),
    JSON.stringify({ name: 'source', dependencies: { 'dsh-alpha': 'link:D:/a', 'dsh-beta': 'link:D:/b' }, dsh: { profile: { bundles: ['dsh-alpha', 'dsh-beta'] } } }),
  )

  await mkdir(target, { recursive: true })
  await mkdir(join(target, 'node_modules'), { recursive: true })
  await writePlugin(join(external, 'dsh-alpha'), 'dsh-alpha', '0.9.0')
  const { symlink } = await import('node:fs/promises')
  await symlink(join(external, 'dsh-alpha'), join(target, 'node_modules', 'dsh-alpha'), 'junction')
  await writeFile(
    join(target, 'package.json'),
    JSON.stringify({ name: 'target', dependencies: { 'dsh-alpha': 'link:C:/external' }, dsh: { profile: { bundles: ['dsh-alpha'] } } }),
  )
  await writeFile(join(target, 'cordis.patch.yml'), '- id: dsh-alpha\n  name: dsh-alpha\n')

  const packFile = join(root, 'pack.dshpack')
  await createPack({ profileDir: source, home, name: 'restore-test', version: '1.0.0', out: packFile })
  return { home, source, target, external, packFile }
}

test('restoring an install brings the previous version back', async () => {
  const { home, target, packFile } = await makeWorld()
  const before = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))
  const installed = await installPack({ packFile, profileDir: target, home })
  assert.ok(installed.pending.length >= 1)

  const afterInstall = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))
  assert.notDeepEqual(afterInstall.dsh.profile.bundles, before.dsh.profile.bundles)
  assert.equal(JSON.parse(await readFile(join(target, 'plugins', 'dsh-alpha', 'package.json'), 'utf8')).version, '1.0.0')

  const backups = await listBackups(home)
  assert.equal(backups.length, 1)
  const restored = await restoreBackup({ backupDir: backups[0].dir, profileDir: target, home })
  assert.ok(restored.restored.includes('dsh-alpha'))
  assert.equal(JSON.parse(await readFile(join(target, 'node_modules', 'dsh-alpha', 'package.json'), 'utf8')).version, '0.9.0')
  assert.deepEqual(JSON.parse(await readFile(join(target, 'package.json'), 'utf8')).dsh.profile.bundles, before.dsh.profile.bundles)
})

test('restoring removes a plugin the install added', async () => {
  const { home, target, packFile } = await makeWorld()
  await installPack({ packFile, profileDir: target, home })
  const backups = await listBackups(home)
  const restored = await restoreBackup({ backupDir: backups[0].dir, profileDir: target, home })
  assert.ok(restored.removed.includes('dsh-beta'))
  assert.ok(!existsSync(join(target, 'plugins', 'dsh-beta')))
  assert.ok(!existsSync(join(target, 'node_modules', 'dsh-beta')))
})

test('restoring puts an overwritten config back', async () => {
  const { home, target, packFile } = await makeWorld()
  await writeFile(join(home, 'alpha.json'), JSON.stringify({ v: 'from-pack' }))
  const packed = join(packFile, '..', 'cfg.dshpack')
  await createPack({ profileDir: join(home, 'profiles', 'source'), home, name: 'cfg', version: '1.0.0', out: packed })
  await writeFile(join(home, 'alpha.json'), JSON.stringify({ v: 'local' }))

  await installPack({ packFile: packed, profileDir: target, home })
  assert.equal(JSON.parse(await readFile(join(home, 'alpha.json'), 'utf8')).v, 'from-pack')
  const backups = await listBackups(home)
  await restoreBackup({ backupDir: backups[0].dir, profileDir: target, home })
  assert.equal(JSON.parse(await readFile(join(home, 'alpha.json'), 'utf8')).v, 'local')
})
