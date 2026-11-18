/**
 * Pack installer — preflights a pack against a profile, backs the touched files
 * up, materialises each plugin, then rewrites package.json and the patch layer.
 * Any failure restores the backup and removes what it created.
 *
 * @module dsh-plugin-pack/lib/install
 */
import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import { readPack, verifyPack } from './pack.mjs'
import { compareVersions } from './semver.mjs'

const execFileAsync = promisify(execFile)

/** pnpm entry point shipped with the desktop runtime, derived from node's path. */
function bundledPnpm(execPath) {
  try {
    const runtime = join(dirname(execPath), '..')
    const candidate = join(runtime, 'primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.cjs')
    return existsSync(candidate) ? candidate : null
  } catch {
    return null
  }
}

/** Ways to run pnpm, most explicit first: env override, then the bundled copy. */
export function pnpmCandidates() {
  const candidates = []
  if (process.env.DSH_PNPM && existsSync(process.env.DSH_PNPM)) {
    candidates.push({ command: process.execPath, args: [process.env.DSH_PNPM] })
  }
  const bundled = bundledPnpm(process.execPath)
  if (bundled) candidates.push({ command: process.execPath, args: [bundled] })
  return candidates
}

/**
 * Refresh pnpm-lock.yaml so package.json and the lock agree again.
 *
 * The installer edits package.json by hand; without this step a later
 * `pnpm install --frozen-lockfile` would fail, and a plain `pnpm install`
 * would prune the junctions the installer created. Resolution only touches the
 * lock: node_modules keeps the directories this installer wrote.
 *
 * @param profileDir - the profile whose lock should be refreshed.
 * @param options - runner (injectable for tests) and timeout.
 */
export async function syncLockfile(profileDir, options = {}) {
  const runner = options.runner ?? execFileAsync
  const candidates = options.candidates ?? pnpmCandidates()
  if (candidates.length === 0) return { ok: false, error: 'pnpm not found (set DSH_PNPM)' }
  const args = ['install', '--lockfile-only', '--ignore-scripts', '--prefer-offline']
  let lastError = null
  for (const candidate of candidates) {
    try {
      await runner(candidate.command, [...candidate.args, ...args], {
        cwd: profileDir,
        timeout: options.timeout ?? 120000,
        windowsHide: true,
        env: { ...process.env, CI: '1' },
      })
      return { ok: true, args }
    } catch (error) {
      lastError = error
    }
  }
  return { ok: false, error: lastError?.message ?? 'pnpm failed', args }
}

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
    else if (installed.version === entry.version) action = overwrite.has(entry.name) ? 'replace' : 'skip'
    else if (compareVersions(entry.version, installed.version) < 0) action = 'downgrade'
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
  // A pack that no longer matches its own checksums is not installed by default:
  // a truncated download or a hand-edited archive must fail loudly, not half-way.
  const verification = verifyPack(pack)
  if (!verification.ok && options.allowUnverified !== true) {
    throw new Error('包校验失败，已拒绝安装：' + verification.mismatch.slice(0, 5).join('；'))
  }
  const profileDir = options.profileDir
  const home = options.home ?? join(profileDir, '..', '..')
  const plan = await planInstall({ pack, profileDir, skip: options.skip, overwrite: options.overwrite })
  const overwrite = new Set(options.overwrite ?? [])
  // A pack built yesterday may be older than what runs today: never downgrade
  // silently. Such an action stays visible as 'downgrade' until the caller names
  // it in overwrite.
  const pending = plan.actions.filter(
    (action) => action.action !== 'skip' && (action.action !== 'downgrade' || overwrite.has(action.name)),
  )
  const held = plan.actions.filter((action) => action.action === 'downgrade' && !overwrite.has(action.name))
  if (options.dryRun) return { actions: plan.actions, pending, held, backupDir: null, changed: [], lock: null, verification }

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
      const rel = name.slice('config/'.length)
      const dest = join(home, rel)
      // A pack may carry a plugin config the user already has; keep the old file
      // so a rollback (or the user) can get it back.
      if (existsSync(dest)) {
        await mkdir(join(backupDir, 'config'), { recursive: true })
        await cp(dest, join(backupDir, 'config', rel))
      }
      await writeFile(dest, data)
      configs.push(dest)
    }
    for (const action of pending) await ensurePatchEntry(profileDir, action.name)

    // Keep package.json and pnpm-lock.yaml in step; a lock mismatch would make
    // the next frozen install fail or prune what we just wrote.
    const lock = await syncLockfile(profileDir, { runner: options.runner })

    return { actions: plan.actions, pending, held, backupDir, changed: created, configs, lock, verification }
  } catch (error) {
    for (const path of created) await rm(path, { recursive: true, force: true }).catch(() => {})
    for (const dest of configs) {
      const saved = join(backupDir, 'config', relative(home, dest))
      if (existsSync(saved)) await cp(saved, dest).catch(() => {})
      else await rm(dest, { force: true }).catch(() => {})
    }
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
