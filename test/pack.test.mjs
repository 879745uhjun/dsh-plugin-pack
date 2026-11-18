import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createPack, readPack, sha256, verifyPack } from '../lib/pack.mjs'

/** A throwaway profile with two small plugins and one config file. */
async function makeProfile() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pack-create-'))
  const home = join(root, '.dsh')
  const profileDir = join(home, 'profiles', 'desktop')
  await mkdir(join(profileDir, 'node_modules'), { recursive: true })
  const plugin = async (name, version, extra) => {
    const dir = join(profileDir, 'node_modules', name)
    await mkdir(join(dir, 'locale'), { recursive: true })
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name, version, engines: { dsh: '>=0.2.2 <0.3.0' }, exports: { './client': './client.js' }, ...extra }),
    )
    await writeFile(join(dir, 'client.js'), "ctx.slots.register({ name: 'shell.overlay' })\n")
    await writeFile(join(dir, 'locale', 'zh.json'), '{"a":"甲"}\n')
    await writeFile(join(dir, 'README.md'), '# ' + name + '\n')
  }
  await plugin('dsh-alpha', '1.0.0')
  await plugin('dsh-beta', '0.3.1')
  await writeFile(join(home, 'alpha.json'), '{"stars":5}\n')
  await writeFile(
    join(profileDir, 'package.json'),
    JSON.stringify({
      name: 'p',
      dependencies: { 'dsh-alpha': 'link:D:/a', 'dsh-beta': '0.3.1' },
      dsh: { profile: { bundles: ['dsh-alpha', 'dsh-beta'] } },
    }),
  )
  return { home, profileDir }
}

test('createPack writes a manifest, plugin trees, config and checksums', async () => {
  const { home, profileDir } = await makeProfile()
  const out = join(await mkdtemp(join(tmpdir(), 'dsh-pack-out-')), 'mini.dshpack')
  const result = await createPack({ profileDir, home, name: 'mini', version: '1.0.0', targetDsh: '0.2.4', out })
  assert.equal(result.manifest.format, 'dshpack/2')
  assert.equal(result.manifest.plugins.length, 2)
  assert.equal(result.manifest.plugins[0].config, 'config/alpha.json')

  const pack = await readPack(out)
  assert.ok(pack.files.has('plugins/dsh-alpha/client.js'))
  assert.ok(pack.files.has('plugins/dsh-alpha/locale/zh.json'))
  assert.ok(pack.files.has('config/alpha.json'))
  assert.ok(pack.files.has('checksums.json'))
  assert.equal(verifyPack(pack).ok, true)
})

test('createPack records the aligned latest versions', async () => {
  const { home, profileDir } = await makeProfile()
  const out = join(await mkdtemp(join(tmpdir(), 'dsh-pack-out-')), 'aligned.dshpack')
  const result = await createPack({
    profileDir,
    home,
    name: 'aligned',
    align: true,
    latest: { 'dsh-alpha': '1.4.0' },
    out,
  })
  assert.equal(result.manifest.align.enabled, true)
  assert.equal(result.manifest.align.source, 'github-tags')
  assert.equal(result.manifest.align.latest['dsh-alpha'], '1.4.0')
})

test('createPack honours a selection', async () => {
  const { home, profileDir } = await makeProfile()
  const out = join(await mkdtemp(join(tmpdir(), 'dsh-pack-out-')), 'one.dshpack')
  const result = await createPack({ profileDir, home, name: 'one', select: ['dsh-beta'], out })
  assert.deepEqual(result.manifest.plugins.map((p) => p.name), ['dsh-beta'])
  const pack = await readPack(out)
  assert.ok(!pack.files.has('plugins/dsh-alpha/package.json'))
})

test('verifyPack reports a tampered entry', async () => {
  const { home, profileDir } = await makeProfile()
  const out = join(await mkdtemp(join(tmpdir(), 'dsh-pack-out-')), 't.dshpack')
  await createPack({ profileDir, home, name: 't', out })
  const pack = await readPack(out)
  pack.files.set('plugins/dsh-alpha/README.md', Buffer.from('# hacked\n'))
  const report = verifyPack(pack)
  assert.equal(report.ok, false)
  assert.deepEqual(report.mismatch, ['changed plugins/dsh-alpha/README.md'])
})

test('sha256 is stable and prefixed', () => {
  assert.equal(sha256(Buffer.from('abc')).startsWith('sha256-'), true)
  assert.equal(sha256(Buffer.from('abc')), sha256(Buffer.from('abc')))
})
