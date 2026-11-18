#!/usr/bin/env node
/**
 * Link this plugin source tree into a DSH profile for development.
 *
 *  - node_modules/<name>  becomes a junction to the source tree
 *  - package.json         gains the dependency and the bundle entry
 *  - cordis.patch.yml     gains the loader entry
 *
 * Every touched file is backed up under <home>/backups first. Pass --unlink to
 * undo all three changes.
 *
 * @module dsh-plugin-pack/tools/link-self
 */
import { cp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const NAME = 'dsh-plugin-pack'
const args = process.argv.slice(2)
const flag = (key) => {
  const index = args.indexOf('--' + key)
  return index >= 0 ? args[index + 1] ?? true : null
}

const profileDir = resolve(flag('profile') ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.dsh', 'profiles', 'desktop'))
const home = resolve(flag('home') ?? join(profileDir, '..', '..'))
const source = resolve(flag('source') ?? fileURLToPath(new URL('..', import.meta.url)))
const unlink = args.includes('--unlink')

const pkgFile = join(profileDir, 'package.json')
const patchFile = join(profileDir, 'cordis.patch.yml')
const target = join(profileDir, 'node_modules', NAME)

if (!existsSync(pkgFile)) {
  console.error('no package.json at ' + pkgFile)
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
const backupDir = join(home, 'backups', 'link-' + stamp)
await mkdir(backupDir, { recursive: true })
await cp(pkgFile, join(backupDir, 'package.json'))
if (existsSync(patchFile)) await cp(patchFile, join(backupDir, 'cordis.patch.yml'))

const pkg = JSON.parse(await readFile(pkgFile, 'utf8'))
pkg.dependencies = pkg.dependencies ?? {}
pkg.dsh = pkg.dsh ?? {}
pkg.dsh.profile = pkg.dsh.profile ?? {}
const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : []

if (unlink) {
  delete pkg.dependencies[NAME]
  pkg.dsh.profile.bundles = bundles.filter((item) => item !== NAME)
  await writeFile(pkgFile, JSON.stringify(pkg, null, 2) + '\n')
  await rm(target, { recursive: true, force: true })
  if (existsSync(patchFile)) {
    const text = await readFile(patchFile, 'utf8')
    const next = text.replace(new RegExp('- id: ' + NAME + '\\n  name: ' + NAME + '\\n?', 'g'), '')
    await writeFile(patchFile, next)
  }
  console.log('unlinked ' + NAME)
  process.exit(0)
}

pkg.dependencies[NAME] = 'link:' + source.split('\\').join('/')
if (!bundles.includes(NAME)) bundles.push(NAME)
pkg.dsh.profile.bundles = bundles
await writeFile(pkgFile, JSON.stringify(pkg, null, 2) + '\n')

await rm(target, { recursive: true, force: true })
await mkdir(join(profileDir, 'node_modules'), { recursive: true })
await symlink(source, target, 'junction')

const patchText = existsSync(patchFile) ? await readFile(patchFile, 'utf8') : '# patch layer\n'
if (!new RegExp('^- id: ' + NAME + '$', 'm').test(patchText)) {
  await writeFile(patchFile, patchText.replace(/\s*$/, '') + '\n- id: ' + NAME + '\n  name: ' + NAME + '\n')
}

console.log('linked  ' + NAME)
console.log('source  ' + source)
console.log('target  ' + target)
console.log('backup  ' + backupDir)
console.log('bundles ' + bundles.length + ' entries, ' + NAME + ' last')
