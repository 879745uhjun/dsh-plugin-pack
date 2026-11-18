/**
 * Just enough semver for plugin ranges: compare, and match the comparator
 * forms DSH plugins actually declare (">=a <b", "^a.b.c", "~a.b.c", exact).
 *
 * @module dsh-plugin-pack/lib/semver
 */

/** Parse one version string into its parts; returns null when unparseable. */
export function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(value ?? '').trim())
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? '' }
}

/** Compare two versions: negative when a < b, zero when equal, positive when a > b. */
export function compareVersions(a, b) {
  const left = typeof a === 'string' ? parseVersion(a) : a
  const right = typeof b === 'string' ? parseVersion(b) : b
  if (!left || !right) throw new Error('invalid version: ' + a + ' / ' + b)
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key]
  }
  if (left.pre === right.pre) return 0
  if (!left.pre) return 1
  if (!right.pre) return -1
  return left.pre < right.pre ? -1 : 1
}

/** True when a version satisfies one comparator such as ">=0.2.2" or "^0.2.2". */
function matchComparator(version, comparator) {
  const match = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(comparator)
  if (!match) throw new Error('invalid comparator: ' + comparator)
  const op = match[1] ?? '='
  const target = parseVersion(match[2])
  if (!target) throw new Error('invalid version in comparator: ' + comparator)
  const cmp = compareVersions(version, target)
  if (op === '>=') return cmp >= 0
  if (op === '<=') return cmp <= 0
  if (op === '>') return cmp > 0
  if (op === '<') return cmp < 0
  if (op === '=') return cmp === 0
  if (op === '^') {
    const upper = target.major > 0
      ? { major: target.major + 1, minor: 0, patch: 0, pre: '' }
      : { major: 0, minor: target.minor + 1, patch: 0, pre: '' }
    return cmp >= 0 && compareVersions(version, upper) < 0
  }
  const upper = { major: target.major, minor: target.minor + 1, patch: 0, pre: '' }
  return cmp >= 0 && compareVersions(version, upper) < 0
}

/** True when a version satisfies a whitespace-separated comparator set. */
export function satisfies(version, range) {
  const text = String(range ?? '').trim()
  if (!text || text === '*') return true
  return text.split(/\s+/).every((comparator) => matchComparator(version, comparator))
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

/** Highest version in a list, or null when the list is empty. */
export function maxVersion(versions) {
  let best = null
  for (const value of versions) {
    if (!parseVersion(value)) continue
    if (!best || compareVersions(value, best) > 0) best = value
  }
  return best
}
