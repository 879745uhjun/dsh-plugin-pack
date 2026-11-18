/**
 * dsh-plugin-pack — Host half.
 *
 * Serves the plugin-pack page: scans the active profile, runs the compatibility
 * engine, builds .dshpack archives under <home>/plugin-packs, and installs them
 * after a preflight.
 *
 *  - GET  /plugin-pack/state    profile + plugins + diagnostics + built packs
 *  - POST /plugin-pack/create   build one pack from a selection
 *  - POST /plugin-pack/inspect  read a built pack back
 *  - POST /plugin-pack/install  preflight or install one built pack
 *
 * @module dsh-plugin-pack
 */
import { execFile } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { diagnose, requiredDsh, summarize } from './lib/compat.mjs'
import { installPack } from './lib/install.mjs'
import { createPack, readPack, verifyPack } from './lib/pack.mjs'
import { listProfiles, resolveDshHome, scanProfile } from './lib/scan.mjs'
import { compareVersions } from './lib/semver.mjs'

const run = promisify(execFile)

/** Cordis plugin name. */
export const name = 'dsh-plugin-pack'

/** Required Host services; the web route additionally waits for webServer. */
export const inject = ['tools']

/** Same-origin routes used by the browser half. */
const ROUTE_STATE = '/plugin-pack/state'
const ROUTE_CREATE = '/plugin-pack/create'
const ROUTE_INSPECT = '/plugin-pack/inspect'
const ROUTE_INSTALL = '/plugin-pack/install'
const ROUTE_LATEST = '/plugin-pack/latest'

/** Request-body ceiling for the browser routes. */
const MAX_BODY_BYTES = 256 * 1024

/** Directory (under the DSH home) that holds built packs. */
const PACK_DIR = 'plugin-packs'

/** One warning sink that reports each distinct failure once. */
function createLogger() {
  const seen = new Set()
  return (message, error) => {
    const key = message + ': ' + (error?.code ?? error?.message ?? String(error ?? ''))
    if (seen.has(key)) return
    seen.add(key)
    console.warn('[plugin-pack] ' + message, error ?? '')
  }
}

/** Answer one JSON response with no-store caching. */
function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  response.end(body)
}

/** Read a bounded UTF-8 request body. */
function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('request body is too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

/** Refuse a cross-site POST; same-origin callers and plain clients pass. */
function isAcceptableOrigin(request) {
  const origin = request.headers.origin
  if (origin === undefined) return true
  if (origin === 'null') return false
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

/** Resolve the DSH home for this Host context. */
function resolveHome(ctx) {
  try {
    const homePath = ctx.get('dshHomePath')
    if (typeof homePath === 'string') return homePath
    if (typeof homePath === 'function') {
      const value = homePath('plugin-pack')
      if (typeof value === 'string' && value.length > 0) return join(value, '..')
    }
  } catch {
    // fall through to the default below
  }
  return resolveDshHome()
}

/** Every built pack under the DSH home, newest first. */
export async function listPacks(home) {
  const dir = join(home, PACK_DIR)
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const packs = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.dshpack')) continue
    const file = join(dir, entry.name)
    try {
      const info = await stat(file)
      // readPack takes a path and reads the archive itself; passing the Buffer made
      // readFile(buffer) reject, and the skipped await turned that into an
      // unhandled rejection that killed the host.
      const pack = await readPack(file)
      packs.push({
        file,
        name: pack.manifest.name,
        version: pack.manifest.version,
        plugins: pack.manifest.plugins.length,
        bytes: info.size,
        mtime: info.mtimeMs,
        verified: verifyPack(pack).ok,
      })
    } catch (error) {
      // One unreadable pack must never break the page: keep the row, carry the
      // file name and the errno code, and let the user see which file is bad.
      packs.push({
        file,
        name: basename(file),
        version: '?',
        plugins: 0,
        bytes: 0,
        mtime: 0,
        verified: false,
        error: (error.code ? error.code + ': ' : '') + error.message,
      })
    }
  }
  packs.sort((a, b) => b.mtime - a.mtime)
  return packs
}

/** Highest semver in a list of version strings, or null. */
export function highestVersion(values) {
  let best = null
  for (const raw of values ?? []) {
    const version = String(raw).trim().replace(/^v/, '')
    if (!/^\d+\.\d+\.\d+/.test(version)) continue
    if (!best || compareVersions(version, best) > 0) best = version
  }
  return best
}

/** Highest semver tag in git ls-remote --tags --refs output, or null. */
export function highestTag(stdout) {
  const versions = String(stdout ?? '')
    .split('\n')
    .map((line) => /refs\/tags\/(.+)$/.exec(line.trim())?.[1])
    .filter(Boolean)
  return highestVersion(versions)
}

/** Newest tag of the local checkout, which works offline. */
async function localTag(dir) {
  if (!dir) return null
  try {
    const { stdout } = await run('git', ['-C', dir, 'tag', '--list'], { timeout: 4000, windowsHide: true })
    return highestVersion(stdout.split('\n'))
  } catch {
    return null
  }
}

/** Newest GitHub tag of one repository; throws when git fails. */
async function latestTag(repo) {
  const { stdout } = await run('git', ['ls-remote', '--tags', '--refs', 'https://github.com/' + repo + '.git'], {
    timeout: 8000,
    windowsHide: true,
  })
  return highestTag(stdout)
}

/** Turn a manifest plugin entry back into the shape diagnose() expects. */
function toRecord(entry) {
  return {
    name: entry.name,
    version: entry.version,
    enginesDsh: entry.engines?.dsh ?? entry.enginesDsh ?? null,
    dependencies: entry.dependencies ?? {},
    slots: entry.slots ?? [],
    takeoverSlots: entry.takeoverSlots ?? [],
    repo: entry.repo ?? null,
  }
}

/** Scan the active profile and describe everything the page shows. */
export async function collectState(ctx) {
  const home = resolveHome(ctx)
  const profiles = await listProfiles(home)
  if (profiles.length === 0) throw new Error('no DSH profile found under ' + join(home, 'profiles'))
  const profile = profiles.find((item) => item.name === 'desktop') ?? profiles[0]
  const scan = await scanProfile({ profileDir: profile.dir, home })
  const plugins = scan.plugins
    // The pack tool lists plugins, it is not pack content: keep it out of its own page.
    .filter((plugin) => plugin.kind !== 'builtin' && plugin.name !== 'dsh-plugin-pack')
    .map((plugin) => ({
      name: plugin.name,
      dir: plugin.dir ?? null,
      version: plugin.version ?? null,
      kind: plugin.kind,
      size: plugin.size ?? 0,
      enginesDsh: plugin.enginesDsh ?? null,
      dependencies: plugin.dependencies ?? {},
      slots: plugin.slots ?? [],
      takeoverSlots: plugin.takeoverSlots ?? [],
      repo: plugin.repo ?? null,
      config: plugin.config ?? null,
    }))
  const targetDsh = requiredDsh(plugins)
  const diagnostics = diagnose({ plugins, targetDsh })
  return {
    home,
    profile: { dir: profile.dir, name: profile.name },
    targetDsh,
    plugins,
    diagnostics,
    summary: summarize(diagnostics),
    packs: await listPacks(home),
  }
}

/** GET /plugin-pack/state */
function createStateHandler(ctx, log) {
  return async function handleState(request, response) {
    try {
      if (request.method !== 'GET') {
        response.writeHead(405, { 'content-type': 'application/json; charset=utf-8' })
        response.end(JSON.stringify({ ok: false, error: 'method not allowed' }))
        return
      }
      sendJson(response, 200, { ok: true, ...(await collectState(ctx)) })
    } catch (error) {
      log('state failed', error)
      sendJson(response, 500, { ok: false, error: error.message })
    }
  }
}

/** POST /plugin-pack/create */
function createBuildHandler(ctx, log) {
  return async function handleCreate(request, response) {
    try {
      if (!isAcceptableOrigin(request)) {
        sendJson(response, 403, { ok: false, error: 'cross-origin request refused' })
        return
      }
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const payload = JSON.parse(await readBody(request, MAX_BODY_BYTES))
      const state = await collectState(ctx)
      const select = Array.isArray(payload.select) && payload.select.length > 0 ? payload.select : null
      const version = typeof payload.version === 'string' && payload.version ? payload.version : '1.0.0'
      const packName = typeof payload.name === 'string' && payload.name ? payload.name : 'dsh-toolkit'
      const out = join(state.home, PACK_DIR, packName + '-' + version + '.dshpack')
      const result = await createPack({
        profileDir: state.profile.dir,
        home: state.home,
        name: packName,
        version,
        select,
        targetDsh: state.targetDsh,
        author: payload.author ?? null,
        align: Boolean(payload.align),
        latest: payload.latest && typeof payload.latest === 'object' ? payload.latest : undefined,
        out,
      })
      const diagnostics = diagnose({
        plugins: result.manifest.plugins.map((entry) => ({
          ...entry,
          enginesDsh: entry.engines?.dsh ?? null,
          takeoverSlots: entry.takeoverSlots ?? [],
        })),
        targetDsh: result.manifest.engines?.dsh ?? null,
      })
      sendJson(response, 200, {
        ok: true,
        file: out,
        bytes: result.bytes,
        files: result.files,
        plugins: result.manifest.plugins.length,
        diagnostics,
        summary: summarize(diagnostics),
      })
    } catch (error) {
      log('create failed', error)
      sendJson(response, 500, { ok: false, error: error.message })
    }
  }
}

/** POST /plugin-pack/inspect */
function createInspectHandler(log) {
  return async function handleInspect(request, response) {
    try {
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const payload = JSON.parse(await readBody(request, MAX_BODY_BYTES))
      if (typeof payload.file !== 'string') throw new Error('file is required')
      const pack = readPack(await readFile(payload.file))
      const diagnostics = diagnose({
        plugins: pack.manifest.plugins.map((entry) => ({
          ...entry,
          enginesDsh: entry.engines?.dsh ?? null,
          takeoverSlots: entry.takeoverSlots ?? [],
        })),
        targetDsh: pack.manifest.engines?.dsh ?? null,
      })
      sendJson(response, 200, { ok: true, manifest: pack.manifest, verified: verifyPack(pack), diagnostics, summary: summarize(diagnostics) })
    } catch (error) {
      log('inspect failed', error)
      sendJson(response, 500, { ok: false, error: error.message })
    }
  }
}

/** POST /plugin-pack/latest — GitHub tag of every selected plugin that has a repo. */
function createLatestHandler(ctx, log) {
  return async function handleLatest(request, response) {
    try {
      if (!isAcceptableOrigin(request)) {
        sendJson(response, 403, { ok: false, error: 'cross-origin request refused' })
        return
      }
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const payload = JSON.parse(await readBody(request, MAX_BODY_BYTES))
      const state = await collectState(ctx)
      const wanted = new Set(Array.isArray(payload.select) && payload.select.length ? payload.select : state.plugins.map((plugin) => plugin.name))
      const targets = state.plugins.filter((plugin) => wanted.has(plugin.name) && plugin.repo)
      const latest = {}
      const errors = []
      await Promise.all(targets.map(async (plugin) => {
        // The checkout that produced the pack is the truest source: its tags work
        // offline. Only fall back to the network when it has none.
        const local = await localTag(plugin.dir)
        if (local) {
          latest[plugin.name] = local
          return
        }
        try {
          const version = await latestTag(plugin.repo)
          if (version) latest[plugin.name] = version
          else errors.push(plugin.name + ': 没有可用 tag')
        } catch (error) {
          errors.push(plugin.name + ': ' + (error.code ?? error.message ?? 'git failed'))
        }
      }))
      sendJson(response, 200, { ok: true, latest, errors, checked: targets.length })
    } catch (error) {
      log('latest failed', error)
      sendJson(response, 500, { ok: false, error: error.message })
    }
  }
}

/** POST /plugin-pack/install */
export function createInstallHandler(ctx, log) {
  return async function handleInstall(request, response) {
    try {
      if (!isAcceptableOrigin(request)) {
        sendJson(response, 403, { ok: false, error: 'cross-origin request refused' })
        return
      }
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const payload = JSON.parse(await readBody(request, MAX_BODY_BYTES))
      if (typeof payload.file !== 'string') throw new Error('file is required')
      if (payload.abort === true) {
        sendJson(response, 200, { ok: true, aborted: true, actions: [], pending: 0, conflicts: [] })
        return
      }
      const state = await collectState(ctx)
      const incoming = await readPack(await readFile(payload.file))
      const packNames = new Set(incoming.manifest.plugins.map((entry) => entry.name))
      const merged = [
        ...state.plugins.map(toRecord),
        ...incoming.manifest.plugins.map(toRecord).filter((entry) => !state.plugins.some((plugin) => plugin.name === entry.name)),
      ]
      const conflicts = diagnose({ plugins: merged, targetDsh: state.targetDsh })
        .filter((item) => item.rule === 'slot.unique')
        .filter((item) => (item.plugins ?? []).some((name) => packNames.has(name)) && (item.plugins ?? []).some((name) => !packNames.has(name)))
        .map((item) => ({ code: item.code, level: item.level, rule: item.rule, location: item.location, expected: item.expected, actual: item.actual, plugins: item.plugins }))
      const result = await installPack({
        packFile: payload.file,
        profileDir: state.profile.dir,
        home: state.home,
        skip: Array.isArray(payload.skip) ? payload.skip : [],
        overwrite: Array.isArray(payload.overwrite) ? payload.overwrite : [],
        dryRun: payload.dryRun !== false,
      })
      sendJson(response, 200, {
        ok: true,
        dryRun: payload.dryRun !== false,
        actions: result.actions,
        pending: result.pending.length,
        backupDir: result.backupDir,
        conflicts,
      })
    } catch (error) {
      log('install failed', error)
      sendJson(response, 500, { ok: false, error: error.message })
    }
  }
}

/**
 * Register the browser routes.
 * @param ctx - Host context carrying the web server.
 */
export function apply(ctx) {
  const log = createLogger()
  ctx.inject(['webServer'], (scope) => {
    scope.effect(() => {
      const off = [
        scope.webServer.register({ kind: 'exact', path: ROUTE_STATE, handler: createStateHandler(ctx, log) }),
        scope.webServer.register({ kind: 'exact', path: ROUTE_CREATE, handler: createBuildHandler(ctx, log) }),
        scope.webServer.register({ kind: 'exact', path: ROUTE_INSPECT, handler: createInspectHandler(log) }),
        scope.webServer.register({ kind: 'exact', path: ROUTE_INSTALL, handler: createInstallHandler(ctx, log) }),
        scope.webServer.register({ kind: 'exact', path: ROUTE_LATEST, handler: createLatestHandler(ctx, log) }),
      ]
      return () => {
        for (const remove of off) remove()
      }
    }, 'plugin-pack: browser routes')
  })
}
