import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { installPack, planInstall, syncLockfile } from '../lib/install.mjs'
import { zipRead, zipWrite } from '../lib/zip.mjs'
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

test('an older pack never downgrades the profile silently', async () => {
  const { home, target, packFile } = await makeWorld()
  const file = join(target, 'node_modules', 'dsh-alpha', 'package.json')
  const pkg = JSON.parse(await readFile(file, 'utf8'))
  pkg.version = '2.0.0'
  await writeFile(file, JSON.stringify(pkg))

  const plan = await planInstall({ pack: await readPack(packFile), profileDir: target })
  assert.equal(plan.actions.find((action) => action.name === 'dsh-alpha').action, 'downgrade')

  const held = await installPack({ packFile, profileDir: target, home })
  assert.deepEqual(held.held.map((action) => action.name), ['dsh-alpha'])
  const after = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(after.version, '2.0.0', 'the newer local version survives')

  const forced = await installPack({ packFile, profileDir: target, home, overwrite: ['dsh-alpha'] })
  assert.ok(forced.pending.some((action) => action.name === 'dsh-alpha'))
  const downgraded = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(downgraded.version, '1.0.0', 'an explicit overwrite does write the older version')
})

test('syncLockfile runs pnpm with lockfile-only flags', async () => {
  const calls = []
  const runner = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd })
  }
  const result = await syncLockfile('/tmp/profile', {
    runner,
    candidates: [{ command: 'node', args: ['pnpm.cjs'] }],
  })
  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
  assert.ok(calls[0].args.includes('--lockfile-only'))
  assert.ok(calls[0].args.includes('install'))
  assert.equal(calls[0].cwd, '/tmp/profile')
})

test('syncLockfile reports a missing pnpm instead of throwing', async () => {
  const result = await syncLockfile('/tmp/profile', { candidates: [] })
  assert.equal(result.ok, false)
  assert.match(result.error, /pnpm/)
})

test('syncLockfile surfaces the runner error', async () => {
  const runner = async () => {
    throw new Error('registry unreachable')
  }
  const result = await syncLockfile('/tmp/profile', { runner, candidates: [{ command: 'node', args: ['pnpm.cjs'] }] })
  assert.equal(result.ok, false)
  assert.match(result.error, /registry unreachable/)
})

test('a pack whose checksums no longer match is refused', async () => {
  const { home, target, packFile } = await makeWorld()
  const files = zipRead(await readFile(packFile))
  files.set('plugins/dsh-alpha/package.json', Buffer.from(JSON.stringify({ name: 'dsh-alpha', version: '9.9.9' })))
  const tampered = join(packFile, '..', 'tampered.dshpack')
  await writeFile(tampered, zipWrite([...files].map(([name, data]) => ({ name, data }))))

  await assert.rejects(
    () => installPack({ packFile: tampered, profileDir: target, home }),
    /校验失败/,
  )
  assert.ok(!existsSync(join(target, 'plugins', 'dsh-beta')), 'nothing is written on a failed check')

  const forced = await installPack({ packFile: tampered, profileDir: target, home, allowUnverified: true })
  assert.equal(forced.verification.ok, false)
  assert.ok(forced.pending.length > 0, 'an explicit override still installs')
})

test('an overwritten plugin config is backed up first', async () => {
  const { home, source, target, packFile } = await makeWorld()
  // give the source plugin a config the pack will carry
  await writeFile(join(home, 'alpha.json'), JSON.stringify({ v: 1 }))
  const packed = join(packFile, '..', 'with-config.dshpack')
  await createPack({ profileDir: source, home, name: 'cfg', version: '1.0.0', out: packed })
  // the target already has its own copy of that config
  await writeFile(join(home, 'alpha.json'), JSON.stringify({ v: 'local' }))

  const result = await installPack({ packFile: packed, profileDir: target, home })
  const saved = await readFile(join(result.backupDir, 'config', 'alpha.json'), 'utf8')
  assert.equal(JSON.parse(saved).v, 'local', 'the previous config is preserved in the backup')
  assert.equal(JSON.parse(await readFile(join(home, 'alpha.json'), 'utf8')).v, 1, 'the pack config is applied')
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
