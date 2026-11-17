/**
 * Pack installer — preflights a pack against a profile, backs the touched files
 * up, materialises each plugin, then rewrites package.json and the patch layer.
 * Any failure restores the backup and removes what it created.
 *
 * @module dsh-plugin-pack/lib/install
 */
import { cp, mkdir, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { readPack } from './pack.mjs'

/** Read one package.json, or null when it is missing or unreadable. */
async function readPackageJson(dir) {
  try {
    return JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

/** Timestamped backup directory name. */
function backupStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    '-' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  )
}

/**
 * Decide what happens to every plugin in one pack.
 * @param options - pack, profileDir, skip (names), overwrite (names).
 * @returns the parsed profile manifest and one action per plugin.
 */
export async function planInstall(options) {
  const pack = options.pack
  const profileDir = options.profileDir
  const pkg = await readPackageJson(profileDir)
  if (!pkg) throw new Error('no package.json in ' + profileDir)
  const skip = new Set(options.skip ?? [])
  const overwrite = new Set(options.overwrite ?? [])
  const actions = []
  for (const entry of pack.manifest.plugins) {
    const dir = join(profileDir, 'node_modules', entry.name)
    const installed = await readPackageJson(dir)
    let action
    if (skip.has(entry.name)) action = 'skip'
    else if (!installed) action = 'add'
    else if (installed.version === entry.version && !overwrite.has(entry.name)) action = 'skip'
    else action = 'replace'
    actions.push({
      name: entry.name,
      version: entry.version,
      installedVersion: installed?.version ?? null,
      action,
      config: entry.config ?? null,
    })
  }
  return { pkg, actions }
}

/** Materialise one plugin directory from the archive. */
async function writePlugin(pack, entry, profileDir) {
  const root = join(profileDir, 'plugins', entry.name)
  const stage = root + '.staging'
  await rm(stage, { recursive: true, force: true })
  await mkdir(stage, { recursive: true })
  const prefix = 'plugins/' + entry.name + '/'
  let files = 0
  for (const [name, data] of pack.files) {
    if (!name.startsWith(prefix)) continue
    const dest = join(stage, name.slice(prefix.length))
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, data)
    files += 1
  }
  await rm(root, { recursive: true, force: true })
  await rename(stage, root)

  const target = join(profileDir, 'node_modules', entry.name)
  await rm(target, { recursive: true, force: true })
  try {
    await symlink(root, target, 'junction')
  } catch {
    await cp(root, target, { recursive: true })
  }
  return { root, target, files }
}

/** Append one loader entry to the profile patch file when it is missing. */
async function ensurePatchEntry(profileDir, name) {
  const file = join(profileDir, 'cordis.patch.yml')
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch {
    text = '# Your patch layer for this dsh profile\n'
  }
  if (new RegExp('^- id: ' + name + '$', 'm').test(text)) return false
  const block = '\n- id: ' + name + '\n  name: ' + name + '\n'
  await writeFile(file, text.replace(/\s*$/, '') + block)
  return true
}

/**
 * Install one pack into one profile.
 * @param options - packFile, profileDir, home, skip, overwrite, dryRun.
 * @returns actions, the backup directory and what changed.
 */
export async function installPack(options) {
  const pack = await readPack(options.packFile)
  const profileDir = options.profileDir
  const home = options.home ?? join(profileDir, '..', '..')
  const plan = await planInstall({ pack, profileDir, skip: options.skip, overwrite: options.overwrite })
  const pending = plan.actions.filter((action) => action.action !== 'skip')
  if (options.dryRun) return { actions: plan.actions, pending, backupDir: null, changed: [] }

  const backupDir = join(home, 'backups', backupStamp())
  await mkdir(backupDir, { recursive: true })
  const pkgFile = join(profileDir, 'package.json')
  const patchFile = join(profileDir, 'cordis.patch.yml')
  await cp(pkgFile, join(backupDir, 'package.json'))
  if (existsSync(patchFile)) await cp(patchFile, join(backupDir, 'cordis.patch.yml'))
  await writeFile(join(backupDir, 'plan.json'), JSON.stringify({ pack: pack.manifest.name, version: pack.manifest.version, actions: plan.actions }, null, 2) + '\n')

  const created = []
  const configs = []
  try {
    for (const action of pending) {
      const written = await writePlugin(pack, action, profileDir)
      created.push(written.root, written.target)
    }
    const nextPkg = structuredClone(plan.pkg)
    nextPkg.dependencies = nextPkg.dependencies ?? {}
    for (const action of pending) nextPkg.dependencies[action.name] = 'file:./plugins/' + action.name
    nextPkg.dsh = nextPkg.dsh ?? {}
    nextPkg.dsh.profile = nextPkg.dsh.profile ?? {}
    const bundles = nextPkg.dsh.profile.bundles ?? []
    for (const action of pending) if (!bundles.includes(action.name)) bundles.push(action.name)
    nextPkg.dsh.profile.bundles = bundles
    await writeFile(pkgFile, JSON.stringify(nextPkg, null, 2) + '\n')

    for (const [name, data] of pack.files) {
      if (!name.startsWith('config/')) continue
      const dest = join(home, name.slice('config/'.length))
      await writeFile(dest, data)
      configs.push(dest)
    }
    for (const action of pending) await ensurePatchEntry(profileDir, action.name)

    return { actions: plan.actions, pending, backupDir, changed: created, configs }
  } catch (error) {
    for (const path of created) await rm(path, { recursive: true, force: true }).catch(() => {})
    await cp(join(backupDir, 'package.json'), pkgFile).catch(() => {})
    if (existsSync(join(backupDir, 'cordis.patch.yml'))) await cp(join(backupDir, 'cordis.patch.yml'), patchFile).catch(() => {})
    throw new Error('install failed and was rolled back: ' + error.message)
  }
}

/** True when a path is a directory. */
export async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}
