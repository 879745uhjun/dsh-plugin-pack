#!/usr/bin/env node
/**
 * Move this plugin to its scoped package name inside one DSH profile.
 *
 * A scoped name changes four things: the dependency key, the bundles entry, the
 * loader patch entry, and the node_modules junction. Everything is backed up.
 *
 * @module dsh-plugin-pack/tools/migrate-to-scope
 */
import { cp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const OLD = 'dsh-plugin-pack'
const NEW = '@879745uhjun/dsh-plugin-pack'
const args = process.argv.slice(2)
const flag = (key, fallback) => {
  const index = args.indexOf('--' + key)
  return index >= 0 ? args[index + 1] : fallback
}

const profileDir = resolve(flag('profile', join(process.env.USERPROFILE ?? '.', '.dsh', 'profiles', 'desktop')))
const home = resolve(flag('home', join(profileDir, '..', '..')))
const pkgFile = join(profileDir, 'package.json')
const patchFile = join(profileDir, 'cordis.patch.yml')

const pkg = JSON.parse(await readFile(pkgFile, 'utf8'))
const deps = pkg.dependencies ?? {}
const spec = deps[OLD] ?? null
if (spec === null) {
  console.log('nothing to migrate: ' + OLD + ' is not a dependency')
  process.exit(0)
}
const target = String(spec).replace(/^link:/, '')

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
const backup = join(home, 'backups', 'scope-' + stamp)
await mkdir(backup, { recursive: true })
await cp(pkgFile, join(backup, 'package.json'))
if (existsSync(patchFile)) await cp(patchFile, join(backup, 'cordis.patch.yml'))

delete deps[OLD]
deps[NEW] = spec
pkg.dependencies = deps
const bundles = (pkg.dsh?.profile?.bundles ?? []).map((item) => (item === OLD ? NEW : item))
if (!bundles.includes(NEW)) bundles.push(NEW)
pkg.dsh = pkg.dsh ?? {}
pkg.dsh.profile = pkg.dsh.profile ?? {}
pkg.dsh.profile.bundles = bundles
await writeFile(pkgFile, JSON.stringify(pkg, null, 2) + '\n')

if (existsSync(patchFile)) {
  const text = await readFile(patchFile, 'utf8')
  const next = text.replace(
    new RegExp('(- id: ' + OLD + '\\s*\\n\\s+name: )"?' + OLD + '"?', 'g'),
    '$1"' + NEW + '"',
  )
  await writeFile(patchFile, next)
}

await rm(join(profileDir, 'node_modules', OLD), { recursive: true, force: true })
const scopedDir = join(profileDir, 'node_modules', '@879745uhjun')
await mkdir(scopedDir, { recursive: true })
await rm(join(scopedDir, 'dsh-plugin-pack'), { recursive: true, force: true })
await symlink(target, join(scopedDir, 'dsh-plugin-pack'), 'junction')

console.log('migrated ' + OLD + ' -> ' + NEW)
console.log('target   ' + target)
console.log('backup   ' + backup)
