import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { configFileFor, describePlugin, extractSlots, repoSlug, scanProfile } from '../lib/scan.mjs'

/** Build a throwaway DSH home with one profile and two plugins. */
async function makeHome() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pack-scan-'))
  const home = join(root, '.dsh')
  const profileDir = join(home, 'profiles', 'desktop')
  const pluginDir = join(profileDir, 'node_modules', 'dsh-session-stars')
  await mkdir(join(profileDir, 'node_modules', '@deepseek-ai', 'dsh-base'), { recursive: true })
  await mkdir(pluginDir, { recursive: true })
  await writeFile(join(home, 'session-stars.json'), '{}')
  await writeFile(
    join(profileDir, 'package.json'),
    JSON.stringify({
      name: 'dsh-profile-desktop',
      dependencies: { 'dsh-session-stars': 'link:D:/work/dsh-session-stars' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'dsh-session-stars'] } },
    }),
  )
  await writeFile(
    join(pluginDir, 'package.json'),
    JSON.stringify({
      name: 'dsh-session-stars',
      version: '1.2.0',
      engines: { dsh: '>=0.2.2 <0.2.3' },
      exports: { './client': './client.js' },
      repository: { type: 'git', url: 'git+https://github.com/owner/dsh-session-stars.git' },
    }),
  )
  await writeFile(
    join(pluginDir, 'client.js'),
    "ctx.slots.inject('sidebar.session.row.trailing', () => ctx.slots.register({ name: 'sidebar.session.row.trailing' }))\n" +
      "ctx.slots.register({ name: 'shell.overlay', takeover: false })\n",
  )
  return { home, profileDir, pluginDir }
}

test('extractSlots reads registration sites and ignores prose', () => {
  const source =
    "ctx.slots.inject('sidebar.session.row.trailing', () => ctx.slots.register({ name: 'sidebar.session.row.trailing' }))\n" +
    "// sidebar.session.row.hover is only mentioned in a comment\n" +
    "ctx.slots.register({ name: 'shell.overlay' })\n"
  assert.deepEqual(extractSlots(source), ['shell.overlay', 'sidebar.session.row.trailing'])
})

test('extractSlots ignores property access on unrelated objects', () => {
  const source = "job.status.running = true\nconst phase = job.status.done\nconst file = 'settings.tsx'\n"
  assert.deepEqual(extractSlots(source), [])
})

test('repoSlug normalises git+https urls', () => {
  assert.equal(repoSlug({ repository: { url: 'git+https://github.com/owner/name.git' } }), 'owner/name')
  assert.equal(repoSlug({}), null)
})

test('configFileFor matches the plugin short name', () => {
  assert.equal(configFileFor('dsh-session-stars', ['settings.json', 'session-stars.json']), 'session-stars.json')
  assert.equal(configFileFor('dsh-token-usage', ['token-usage-cache.json']), 'token-usage-cache.json')
})

test('scanProfile reads bundles, versions, slots and config', async () => {
  const { home, profileDir } = await makeHome()
  const result = await scanProfile({ profileDir, home })
  assert.equal(result.plugins.length, 2)
  assert.equal(result.plugins[0].kind, 'builtin')
  const stars = result.plugins[1]
  assert.equal(stars.name, 'dsh-session-stars')
  assert.equal(stars.version, '1.2.0')
  assert.equal(stars.kind, 'linked')
  assert.equal(stars.enginesDsh, '>=0.2.2 <0.2.3')
  assert.equal(stars.repo, 'owner/dsh-session-stars')
  assert.equal(stars.config, 'session-stars.json')
  assert.deepEqual(stars.slots, ['shell.overlay', 'sidebar.session.row.trailing'])
  assert.equal(await realpath(stars.dir), await realpath(join(profileDir, 'node_modules', 'dsh-session-stars')))
})

test('describePlugin reports zero slots for a host-only plugin', async () => {
  const { pluginDir } = await makeHome()
  await writeFile(join(pluginDir, 'package.json'), JSON.stringify({ name: 'host-only', version: '0.0.1' }))
  const plugin = await describePlugin(pluginDir, {})
  assert.deepEqual(plugin.slots, [])
  assert.equal(plugin.enginesDsh, null)
})
