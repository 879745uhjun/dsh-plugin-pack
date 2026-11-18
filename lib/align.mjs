/**
 * Move a plugin checkout to its newest git tag.
 *
 * Alignment is opt-in and defensive: a dirty work tree or a repository without
 * tags is reported and left untouched, never reset.
 *
 * @module dsh-plugin-pack/lib/align
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { compareVersions } from './semver.mjs'

const exec = promisify(execFile)

/** Run one git command inside a directory. */
export async function gitIn(dir, args, options = {}) {
  const { stdout } = await exec('git', ['-C', dir, ...args], {
    timeout: options.timeout ?? 15000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  })
  return stdout.trim()
}

/** Exact tag of the current checkout, or null when HEAD is untagged. */
export async function currentTag(dir) {
  try {
    return await gitIn(dir, ['describe', '--tags', '--exact-match'])
  } catch {
    return null
  }
}

/** True when the work tree has uncommitted changes. */
export async function isDirty(dir) {
  return (await gitIn(dir, ['status', '--porcelain'])).length > 0
}

/** Highest tag name in a list, keeping its prefix: a checkout needs the real name. */
export function highestTagName(tags) {
  let best = null
  let bestVersion = null
  for (const tag of tags ?? []) {
    const version = String(tag).trim().replace(/^v/, '')
    if (!/^\d+\.\d+\.\d+/.test(version)) continue
    if (!bestVersion || compareVersions(version, bestVersion) > 0) {
      bestVersion = version
      best = String(tag).trim()
    }
  }
  return best
}

/** Newest tag known locally, fetching first when asked. */
export async function latestLocalTag(dir, fetch = false) {
  if (fetch) await gitIn(dir, ['fetch', '--tags', '--quiet'], { timeout: 60000 })
  const tags = (await gitIn(dir, ['tag', '--list'])).split('\n')
  return highestTagName(tags)
}

/**
 * Check out the newest tag of one repository.
 * @param dir - the plugin checkout.
 * @param options - fetch before looking, and a custom git runner for tests.
 * @returns what moved, or why it did not.
 */
export async function upgradeToLatestTag(dir, options = {}) {
  const git = options.git ?? ((args, settings) => gitIn(dir, args, settings))
  const dirty = (await git(['status', '--porcelain'])).length > 0
  if (dirty) return { ok: false, skipped: 'dirty work tree' }
  let from = null
  try {
    from = await git(['describe', '--tags', '--exact-match'])
  } catch {
    from = null
  }
  if (options.fetch === true) await git(['fetch', '--tags', '--quiet'], { timeout: 60000 })
  const tags = (await git(['tag', '--list'])).split('\n')
  const to = highestTagName(tags)
  if (!to) return { ok: false, skipped: 'no tags', from }
  if (from === to) return { ok: true, changed: false, from, to }
  await git(['checkout', '--quiet', to])
  return { ok: true, changed: true, from, to }
}
