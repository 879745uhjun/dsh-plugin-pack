/**
 * Restore one install: put back the plugin trees, the profile manifest, the
 * patch layer and any config the pack overwrote.
 *
 * @module dsh-plugin-pack/lib/restore
 */
import { cp, mkdir, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Every backup directory under the DSH home, newest first. */
export async function listBackups(home) {
  const root = join(home, 'backups')
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const backups = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(root, entry.name)
    let plan = null
    try {
      plan = JSON.parse(await readFile(join(dir, 'plan.json'), 'utf8'))
    } catch {
      // a directory without plan.json is a link-* or lock-* backup
    }
    backups.push({ stamp: entry.name, dir, plan })
  }
  backups.sort((left, right) => (left.stamp < right.stamp ? 1 : -1))
  return backups
}

/** Re-point node_modules/<name> at one directory. */
async function linkTo(profileDir, name, target) {
  const link = join(profileDir, 'node_modules', name)
  await rm(link, { recursive: true, force: true })
  try {
    await symlink(target, link, 'junction')
  } catch {
    await cp(target, link, { recursive: true })
  }
}

/**
 * Undo one install.
 * @param options - backupDir, profileDir, home.
 * @returns what was restored, removed and skipped.
 */
export async function restoreBackup(options) {
  const backupDir = options.backupDir
  const profileDir = options.profileDir
  const home = options.home
  const plan = JSON.parse(await readFile(join(backupDir, 'plan.json'), 'utf8'))
  const links = existsSync(join(backupDir, 'links.json'))
    ? JSON.parse(await readFile(join(backupDir, 'links.json'), 'utf8'))
    : {}

  const restored = []
  const removed = []
  const touched = (plan.actions ?? []).filter((action) => action.action !== 'skip')

  for (const action of touched) {
    const name = action.name
    const current = join(profileDir, 'plugins', name)
    const saved = join(backupDir, 'plugins', name)
    const previous = links[name] ?? null
    try {
      if (existsSync(saved)) {
        await rm(current, { recursive: true, force: true })
        await mkdir(join(profileDir, 'plugins'), { recursive: true })
        await rename(saved, current)
        await linkTo(profileDir, name, current)
        restored.push(name)
      } else if (previous) {
        await rm(current, { recursive: true, force: true })
        await linkTo(profileDir, name, previous)
        restored.push(name)
      } else {
        await rm(current, { recursive: true, force: true })
        await rm(join(profileDir, 'node_modules', name), { recursive: true, force: true })
        removed.push(name)
      }
    } catch (error) {
      throw new Error('restore failed for ' + name + ': ' + error.message)
    }
  }

  const pkgBackup = join(backupDir, 'package.json')
  if (existsSync(pkgBackup)) await cp(pkgBackup, join(profileDir, 'package.json'))
  const patchBackup = join(backupDir, 'cordis.patch.yml')
  if (existsSync(patchBackup)) await cp(patchBackup, join(profileDir, 'cordis.patch.yml'))

  const configs = []
  const configDir = join(backupDir, 'config')
  if (existsSync(configDir)) {
    for (const file of await readdir(configDir)) {
      await cp(join(configDir, file), join(home, file))
      configs.push(file)
    }
  }

  return { restored, removed, configs, pack: plan.pack, version: plan.version }
}
