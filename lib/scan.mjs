/**
 * Profile scanner — finds every plugin a DSH profile loads, where it really
 * lives, which version it declares, which UI slots it registers, and which
 * config file it owns under the DSH home.
 *
 * @module dsh-plugin-pack/lib/scan
 */
import { existsSync } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** Default DSH home; every profile, storage and plugin config lives here. */
export const DEFAULT_HOME = join(homedir(), '.dsh')

/** Slot ids only count when they appear at a registration site. */
const SLOT_CALLS = [
  /slots\.(?:inject|register)\(\s*['"]([^'"]+)['"]/g,
  /(?:name|slot)\s*:\s*['"]((?:sidebar|shell|conversation|composer|settings|workspace|status|chat)\.[a-z0-9][a-z0-9.-]*)['"]/g,
]

/** True when every dot-separated segment looks like a slot segment. */
function isSlotId(id) {
  if (/[.](json|js|mjs|cjs|jsx|ts|tsx|css|svg|md|txt|ya?ml)$/i.test(id)) return false
  return id.split('.').every((part) => /^[a-z][a-z0-9-]*$/.test(part))
}

/** Resolve the DSH home from an explicit path, the environment, or the default. */
export function resolveDshHome(explicit) {
  return resolve(explicit ?? process.env.DSH_HOME ?? DEFAULT_HOME)
}

/** Read one JSON file, naming the file when it fails. */
export async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    throw new Error('cannot read ' + file + ': ' + error.message)
  }
}

/** Every profile directory under the DSH home that has a package.json. */
export async function listProfiles(home) {
  const root = join(home, 'profiles')
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const profiles = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(root, entry.name)
    if (!existsSync(join(dir, 'package.json'))) continue
    profiles.push({ name: entry.name, dir })
  }
  return profiles
}

/** Total byte size of a directory tree; symlinks are not followed. */
export async function dirSize(dir) {
  let total = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) total += await dirSize(path)
    else if (entry.isFile()) {
      try {
        total += (await stat(path)).size
      } catch {
        // a vanished file does not break a scan
      }
    }
  }
  return total
}

/** Resolve a plugin name to its real directory inside the profile. */
export async function resolvePluginDir(profileDir, name) {
  const candidate = join(profileDir, 'node_modules', name)
  try {
    return await realpath(candidate)
  } catch {
    return candidate
  }
}

/** Collect the slot ids one client bundle registers, sorted and deduplicated. */
export function extractSlots(source) {
  const seen = new Set()
  for (const pattern of SLOT_CALLS) {
    for (const match of source.matchAll(pattern)) {
      const id = match[1]
      if (isSlotId(id)) seen.add(id)
    }
  }
  return [...seen].sort()
}

/** Slot ids this client bundle claims with takeover: true. */
export function extractTakeovers(source) {
  const claimed = new Set()
  for (const call of source.matchAll(/register\s*\(\s*\{/g)) {
    const start = call.index + call[0].length
    const chunk = source.slice(start, start + 600)
    const name = /name\s*:\s*['"]([^'"]+)['"]/.exec(chunk)?.[1]
    if (!name || !isSlotId(name)) continue
    const takeoverAt = chunk.search(/takeover\s*:\s*true/)
    if (takeoverAt < 0) continue
    const nextName = chunk.slice(1).search(/name\s*:/)
    if (nextName < 0 || takeoverAt <= nextName + 1) claimed.add(name)
  }
  return [...claimed]
}

/** Flatten one locale object into dotted keys. */
export function flattenKeys(value, prefix = '') {
  const keys = []
  for (const [key, child] of Object.entries(value ?? {})) {
    const dotted = prefix ? prefix + '.' + key : key
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) keys.push(...flattenKeys(child, dotted))
    else keys.push(dotted)
  }
  return keys
}

/** Every locale JSON a plugin ships, as file name to sorted key list. */
export async function readLocales(dir) {
  const locales = {}
  let files
  try {
    files = await readdir(join(dir, 'locale'))
  } catch {
    return locales
  }
  for (const file of files.sort()) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = JSON.parse(await readFile(join(dir, 'locale', file), 'utf8'))
      locales[file] = flattenKeys(raw).sort()
    } catch {
      // a malformed locale file simply contributes no keys
    }
  }
  return locales
}

/** Locale namespaces a client bundle registers (two plugins sharing one collide). */
export function extractNamespaces(source) {
  const found = new Set()
  for (const match of source.matchAll(/locale\.register\(\s*['"]([^'"]+)['"]/g)) found.add(match[1])
  const declared = /(?:const|let|var)\s+NS\s*=\s*['"]([^'"]+)['"]/.exec(source)?.[1]
  if (declared && /locale\.register\(\s*NS\b/.test(source)) found.add(declared)
  return [...found].sort()
}

/** The client entry file declared by one plugin manifest, when it has one. */
function clientEntry(pkg) {
  const exported = pkg.exports?.['./client']
  if (typeof exported === 'string') return exported
  if (typeof exported === 'object' && typeof exported?.default === 'string') return exported.default
  return pkg.dsh?.client ? './client.js' : null
}

/** Normalise a repository field to owner/name. */
export function repoSlug(pkg) {
  const url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  if (!url) return null
  const match = /github\.com[/:]([^/]+)\/([^/#.]+)/.exec(url)
  return match ? match[1] + '/' + match[2] : null
}

/**
 * Describe one plugin directory.
 * @param dir - real plugin directory.
 * @param options - home for config lookup, declared for the profile dependency spec.
 */
export async function describePlugin(dir, options) {
  const pkg = await readJson(join(dir, 'package.json'))
  const entry = clientEntry(pkg)
  let slots = []
  let takeoverSlots = []
  let namespaces = []
  if (entry) {
    const clientPath = join(dir, entry)
    if (existsSync(clientPath)) {
      const source = await readFile(clientPath, 'utf8')
      slots = extractSlots(source)
      takeoverSlots = extractTakeovers(source)
      namespaces = extractNamespaces(source)
    }
  }
  const size = await dirSize(dir)
  const locales = await readLocales(dir)
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description ?? '',
    enginesDsh: pkg.engines?.dsh ?? null,
    dependencies: pkg.dependencies ?? {},
    repo: repoSlug(pkg),
    slots,
    takeoverSlots,
    locales,
    namespaces,
    takeover: takeoverSlots.length > 0,
    size,
    dir,
    declared: options?.declared ?? null,
    config: options?.config ?? null,
  }
}

/** Root-level JSON files under the DSH home; plugin configs live here. */
export async function homeConfigFiles(home) {
  try {
    const entries = await readdir(home, { withFileTypes: true })
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name)
  } catch {
    return []
  }
}

/** Guess the config file a plugin owns: its name, or the name without a dsh- prefix. */
export function configFileFor(name, files) {
  const alnum = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const candidates = [name, name.replace(/^dsh-session-/, ''), name.replace(/^dsh-/, '')]
  for (const candidate of candidates) {
    const hit = files.find((file) => alnum(file.replace(/\.json$/, '')) === alnum(candidate))
    if (hit) return hit
  }
  for (const candidate of candidates) {
    const hit = files.find((file) => alnum(file).includes(alnum(candidate)))
    if (hit) return hit
  }
  return null
}

/**
 * Scan one profile: its manifest, bundle order, and every plugin it loads.
 * @param options - profileDir (required) and home (for config lookup).
 */
export async function scanProfile(options) {
  const profileDir = resolve(options.profileDir)
  const home = resolveDshHome(options.home)
  const pkg = await readJson(join(profileDir, 'package.json'))
  const dependencies = pkg.dependencies ?? {}
  const bundles = pkg.dsh?.profile?.bundles ?? []
  const configs = await homeConfigFiles(home)

  const plugins = []
  for (const name of bundles) {
    const declared = dependencies[name] ?? null
    if (!declared || name.startsWith('@deepseek-ai/')) {
      plugins.push({ name, kind: 'builtin', declared })
      continue
    }
    const dir = await resolvePluginDir(profileDir, name)
    if (!existsSync(join(dir, 'package.json'))) {
      plugins.push({ name, kind: 'missing', declared })
      continue
    }
    const plugin = await describePlugin(dir, { declared, config: configFileFor(name, configs) })
    plugin.kind = String(declared).startsWith('link:') ? 'linked' : 'registry'
    plugins.push(plugin)
  }

  return {
    home,
    profile: { dir: profileDir, name: pkg.name ?? 'profile', bundles, dependencies },
    plugins,
  }
}
