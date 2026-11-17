/**
 * Compatibility engine — turns a scanned plugin set into C-xx diagnostics with
 * a stable shape: level, rule, location, expected, actual.
 *
 * @module dsh-plugin-pack/lib/compat
 */
import { compareVersions, parseVersion, satisfies } from './semver.mjs'

/** Slots shaped as a single seat (one button bar); list slots such as
 * row.trailing legitimately host many plugins, so they are not listed here. */
const SINGLE_SEAT = /\.(action|leading)$/

/** Rank used when sorting diagnostics. */
const LEVEL_ORDER = { BLOCKER: 0, WARN: 1, INFO: 2, PASS: 3 }

/** Latin for one slot id, used in the location field. */
function slotLocation(slot) {
  return 'slot:' + slot
}

/**
 * Every diagnostic for one candidate pack.
 * @param options - plugins (scanned records), targetDsh, latest (name -> version), align.
 * @returns diagnostics sorted by level, each with a stable C-xx code.
 */
export function diagnose(options) {
  const plugins = (options.plugins ?? []).filter((plugin) => plugin && plugin.version)
  const targetDsh = options.targetDsh ?? null
  const latest = options.latest ?? new Map()
  const found = []

  // 1. slot occupancy: takeover beats a shared single seat
  const owners = new Map()
  for (const plugin of plugins) {
    for (const slot of plugin.slots ?? []) {
      if (!owners.has(slot)) owners.set(slot, [])
      owners.get(slot).push(plugin)
    }
  }
  for (const [slot, list] of owners) {
    if (list.length < 2) continue
    const takeover = list.filter((plugin) => plugin.takeover)
    const single = SINGLE_SEAT.test(slot)
    if (!takeover.length && !single) continue
    found.push({
      level: takeover.length ? 'BLOCKER' : 'WARN',
      rule: 'slot.unique',
      location: slotLocation(slot),
      expected:
        'slot 只能有 1 个注册者' + (takeover.length ? '；声明 takeover 的插件必须显式禁用其他注册者' : ''),
      actual:
        list.map((plugin) => plugin.name + '@' + plugin.version + (plugin.takeover ? ' (takeover)' : '')).join(' + '),
      plugins: list.map((plugin) => plugin.name),
    })
  }

  // 2. engine ranges against the pack's declared minimum
  for (const plugin of plugins) {
    if (!plugin.enginesDsh || !targetDsh) continue
    if (satisfies(targetDsh, plugin.enginesDsh)) continue
    found.push({
      level: 'WARN',
      rule: 'engine.range',
      location: plugin.name + '@' + plugin.version + ' · package.json#engines.dsh',
      expected: '区间覆盖目标 DSH ' + targetDsh,
      actual: '要求 ' + plugin.enginesDsh,
      plugins: [plugin.name],
    })
  }

  // 3. inter-plugin dependency ranges
  const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]))
  for (const plugin of plugins) {
    for (const [name, range] of Object.entries(plugin.dependencies ?? {})) {
      const owner = byName.get(name)
      if (!owner) continue
      if (satisfies(owner.version, range)) continue
      found.push({
        level: 'BLOCKER',
        rule: 'dep.version',
        location: plugin.name + '@' + plugin.version + ' · package.json#dependencies.' + name,
        expected: name + ' 需满足 ' + range,
        actual: '包内提供 ' + name + '@' + owner.version,
        plugins: [plugin.name, name],
      })
    }
  }

  // 4. version alignment against the newest upstream tag
  for (const plugin of plugins) {
    const newest = plugin.repo ? latest.get(plugin.repo) : null
    if (!newest) continue
    if (compareVersions(newest, plugin.version) <= 0) continue
    found.push({
      level: 'INFO',
      rule: 'version.latest',
      location: plugin.name + '@' + plugin.version + ' · package.json#version',
      expected: '与 ' + plugin.repo + ' 最新 tag v' + newest + ' 一致',
      actual: '本地 ' + plugin.version + '，落后 ' + (parseVersion(newest) && parseVersion(plugin.version) ? '若干' : '') + '个版本',
      plugins: [plugin.name],
    })
  }

  found.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
  return found.map((item, index) => ({ code: 'C-' + String(index + 1).padStart(2, '0'), ...item }))
}

/**
 * One verdict for a whole pack.
 * @param diagnostics - result of diagnose().
 * @returns counts, level and whether generating is allowed.
 */
export function summarize(diagnostics) {
  const counts = { BLOCKER: 0, WARN: 0, INFO: 0, PASS: 0 }
  for (const item of diagnostics) counts[item.level] += 1
  const level = counts.BLOCKER ? 'BLOCKER' : counts.WARN ? 'WARN' : counts.INFO ? 'INFO' : 'PASS'
  return { counts, level, canGenerate: true, blocking: counts.BLOCKER }
}

/**
 * Minimum DSH version a pack needs: the highest lower bound its plugins declare.
 * @param plugins - scanned plugin records.
 * @returns a version string, or null when nothing constrains the pack.
 */
export function requiredDsh(plugins) {
  let floor = null
  for (const plugin of plugins) {
    const range = plugin.enginesDsh
    if (!range) continue
    const match = /(?:>=|\^|~)?\s*v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(range)
    if (!match) continue
    if (!floor || compareVersions(match[1], floor) > 0) floor = match[1]
  }
  return floor
}
