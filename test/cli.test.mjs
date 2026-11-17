import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { test } from 'node:test'

const run = promisify(execFile)
const CLI = fileURLToPath(new URL('../bin/dsh-pack.mjs', import.meta.url))

/** Run the CLI and return stdout. */
async function cli(args) {
  const { stdout } = await run(process.execPath, [CLI, ...args], { windowsHide: true })
  return stdout
}

/** One source profile with a plugin, one empty target profile. */
async function makeWorld() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pack-cli-'))
  const home = join(root, '.dsh')
  const source = join(home, 'profiles', 'source')
  const target = join(home, 'profiles', 'target')
  const pluginDir = join(source, 'node_modules', 'dsh-demo')
  await mkdir(pluginDir, { recursive: true })
  await mkdir(target, { recursive: true })
  await writeFile(join(pluginDir, 'package.json'), JSON.stringify({ name: 'dsh-demo', version: '1.0.0', engines: { dsh: '>=0.2.2 <0.3.0' } }))
  await writeFile(join(pluginDir, 'index.js'), 'export const name = "dsh-demo"\n')
  await writeFile(
    join(source, 'package.json'),
    JSON.stringify({ name: 'source', dependencies: { 'dsh-demo': 'link:D:/demo' }, dsh: { profile: { bundles: ['dsh-demo'] } } }),
  )
  await writeFile(join(target, 'package.json'), JSON.stringify({ name: 'target', dependencies: {}, dsh: { profile: { bundles: [] } } }))
  return { home, source, target, pack: join(root, 'demo.dshpack') }
}

test('create then install through the CLI', async () => {
  const { home, source, target, pack } = await makeWorld()
  const created = await cli(['create', 'demo', '--select', 'dsh-demo', '--out', pack, '--profile', source, '--home', home])
  assert.match(created, /pack\s+.*demo\.dshpack/)

  const verified = await cli(['verify', pack])
  assert.match(verified, /^OK/)

  const installed = await cli(['install', pack, '--profile', target, '--home', home, '--yes'])
  assert.match(installed, /add\s+dsh-demo/)

  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies['dsh-demo'], 'file:./plugins/dsh-demo')
  assert.deepEqual(pkg.dsh.profile.bundles, ['dsh-demo'])
  assert.ok(existsSync(join(target, 'node_modules', 'dsh-demo', 'index.js')))
  assert.ok(existsSync(join(home, 'backups')))
})

test('a dry run prints the plan and writes nothing', async () => {
  const { home, source, target, pack } = await makeWorld()
  await cli(['create', 'demo', '--select', 'dsh-demo', '--out', pack, '--profile', source, '--home', home])
  const out = await cli(['install', pack, '--profile', target, '--home', home])
  assert.match(out, /dry run/)
  assert.ok(!existsSync(join(target, 'plugins', 'dsh-demo')))
})
