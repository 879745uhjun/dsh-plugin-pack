#!/usr/bin/env node
/**
 * Rehearse an install against a clone of a real profile.
 *
 * Copies package.json and cordis.patch.yml, then rebuilds node_modules with
 * junctions to the same plugin directories, so the installer exercises its real
 * code path (junctions, bundles, patch edits, backup) without touching the
 * profile the user is running.
 *
 * @module dsh-plugin-pack/tools/rehearse-install
 */
import { cp, mkdir, readdir, readFile, symlink, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { installPack } from '../lib/install.mjs'

const args = process.argv.slice(2)
const arg = (key, fallback) => {
  const index = args.indexOf('--' + key)
  return index >= 0 ? args[index + 1] : fallback
}

const source = resolve(arg('source', join(process.env.USERPROFILE ?? '.', '.dsh', 'profiles', 'desktop')))
const pack = resolve(arg('pack', 'out/dsh-toolkit-1.0.0.dshpack'))
const root = await mkdir ? await import('node:fs/promises').then((fs) => fs.mkdtemp(join(tmpdir(), 'dsh-pack-rehearse-'))) : null
const profile = join(root, 'desktop')
await mkdir(profile, { recursive: true })

await cp(join(source, 'package.json'), join(profile, 'package.json'))
if (existsSync(join(source, 'cordis.patch.yml'))) await cp(join(source, 'cordis.patch.yml'), join(profile, 'cordis.patch.yml'))

const pkg = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
const nodeModules = join(profile, 'node_modules')
await mkdir(nodeModules, { recursive: true })
let linked = 0
for (const name of Object.keys(pkg.dependencies ?? {})) {
  const from = join(source, 'node_modules', name)
  if (!existsSync(from)) continue
  try {
    await symlink(from, join(nodeModules, name), 'junction')
    linked += 1
  } catch {
    // a package that cannot be linked simply stays missing in the clone
  }
}

console.log('clone     ' + profile)
console.log('linked    ' + linked + ' dependencies')
const result = await installPack({ packFile: pack, profileDir: profile, home: join(root, '.dsh') })
const after = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
const patchText = existsSync(join(profile, 'cordis.patch.yml')) ? await readFile(join(profile, 'cordis.patch.yml'), 'utf8') : ''

console.log('pending   ' + result.pending.length + ' of ' + result.actions.length)
for (const action of result.actions) console.log('  ' + action.action.padEnd(8) + action.name.padEnd(26) + (action.installedVersion ?? '-') + ' -> ' + action.version)
console.log('plugins/  ' + (await readdir(join(profile, 'plugins')).catch(() => [])).join(', '))
console.log('bundles   ' + after.dsh.profile.bundles.length + ' entries, last: ' + after.dsh.profile.bundles.slice(-3).join(','))
console.log('deps      ' + Object.keys(after.dependencies).length + ' entries')
console.log('patch ids ' + (patchText.match(/^- id: .+$/gm) ?? []).length)
console.log('backup    ' + result.backupDir)
console.log('second run should be a no-op:')
const again = await installPack({ packFile: pack, profileDir: profile, home: join(root, '.dsh') })
console.log('  pending ' + again.pending.length)
