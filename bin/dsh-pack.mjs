#!/usr/bin/env node
/**
 * dsh-pack — command line for building and installing plugin packs.
 *
 * @module dsh-plugin-pack/bin/dsh-pack
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { diagnose, requiredDsh, summarize } from '../lib/compat.mjs'
import { installPack } from '../lib/install.mjs'
import { createPack, readPack, verifyPack } from '../lib/pack.mjs'
import { currentTag, latestLocalTag, upgradeToLatestTag } from '../lib/align.mjs'
import { listBackups, pruneBackups, restoreBackup } from '../lib/restore.mjs'
import { listProfiles, resolveDshHome, scanProfile } from '../lib/scan.mjs'
import { compareVersions } from '../lib/semver.mjs'

const run = promisify(execFile)

const USAGE = [
  'dsh-pack <command> [options]',
  '',
  'Commands:',
  '  scan                     list the plugins a profile loads',
  '  create <name>            build a .dshpack from the profile',
  '  inspect <pack>           print a pack manifest and its diagnostics',
  '  verify <pack>            check every checksum of a pack',
  '  install <pack>           preflight, back up, then install',
  '  backups                  list install backups under the DSH home',
  '  restore <stamp|latest>   undo one install from its backup',
  '  prune [--keep N]         keep only the newest install backups',
  '  align [--upgrade]        show each plugin tag vs its newest tag',
  '',
  'Options:',
  '  --profile <dir>   profile directory (default: the single profile under the DSH home)',
  '  --home <dir>      DSH home (default: %USERPROFILE%/.dsh)',
  '  --select a,b      only pack these plugin names',
  '  --out <file>      output path (default: ./<name>-<version>.dshpack)',
  '  --version <v>     pack version (default: 1.0.0)',
  '  --dsh <v>         target DSH version (default: the highest engines lower bound)',
  '  --align           align each plugin to its newest GitHub tag',
  '  --pnpm <file>     pnpm entry point (default: bundled runtime, then PATH)',
  '  --json            machine-readable output',
].join('\n')

/** Parse argv into command, positional arguments and flags. */
export function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) flags[key] = true
      else {
        flags[key] = next
        i += 1
      }
    } else positional.push(token)
  }
  const [command, ...rest] = positional
  return { command, positional: rest, flags }
}

/** Pick the profile to work on: explicit flag, or the only one present. */
export async function pickProfile(flags) {
  if (typeof flags.profile === 'string') return { name: 'explicit', dir: flags.profile }
  const home = resolveDshHome(typeof flags.home === 'string' ? flags.home : undefined)
  const profiles = await listProfiles(home)
  if (profiles.length === 0) throw new Error('no profile found under ' + home)
  if (profiles.length > 1) throw new Error('several profiles found; pass --profile <dir>')
  return profiles[0]
}

/** Human byte size. */
function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

/** Version of the newest tag in one GitHub repository, or null when offline. */
async function latestTag(repo) {
  const { stdout } = await run('git', ['ls-remote', '--tags', '--refs', 'https://github.com/' + repo + '.git'], {
    timeout: 15000,
    windowsHide: true,
  })
  let best = null
  for (const line of stdout.split('\n')) {
    const match = /refs\/tags\/(.+)$/.exec(line.trim())
    if (!match) continue
    const version = match[1].replace(/^v/, '')
    if (!/^\d+\.\d+\.\d+/.test(version)) continue
    if (!best || compareVersions(version, best) > 0) best = version
  }
  return best
}

/** Print diagnostics as one block per finding. */
function formatDiagnostics(diagnostics) {
  if (diagnostics.length === 0) return '  (无)'
  const lines = []
  for (const item of diagnostics) {
    lines.push('  ' + item.code + '  ' + item.level.padEnd(7) + item.rule.padEnd(15) + item.location)
    lines.push('         期望  ' + item.expected)
    lines.push('         实际  ' + item.actual)
  }
  return lines.join('\n')
}

/** dsh-pack scan */
async function commandScan(flags) {
  const profile = await pickProfile(flags)
  const result = await scanProfile({ profileDir: profile.dir, home: flags.home })
  if (flags.json) return JSON.stringify(result, null, 2)
  const thirdParty = result.plugins.filter((plugin) => plugin.kind !== 'builtin')
  const lines = [
    'profile  ' + result.profile.dir,
    'bundles  ' + result.profile.bundles.length + ' total, ' + thirdParty.length + ' third-party',
    '',
    ['plugin'.padEnd(26), 'version'.padEnd(9), 'kind'.padEnd(9), 'size'.padStart(9), '  engine'.padEnd(26), 'slots'].join(' '),
  ]
  for (const plugin of thirdParty) {
    lines.push(
      [
        String(plugin.name).padEnd(26),
        String(plugin.version ?? '?').padEnd(9),
        String(plugin.kind).padEnd(9),
        mb(plugin.size ?? 0).padStart(9),
        String(plugin.enginesDsh ? '  dsh ' + plugin.enginesDsh : '  -').padEnd(26),
        plugin.slots?.length ? plugin.slots.join(', ') : '-',
      ].join(' '),
    )
  }
  return lines.join('\n')
}

/** dsh-pack create <name> */
async function commandCreate(positional, flags) {
  const name = positional[0]
  if (!name) throw new Error('create needs a pack name')
  const profile = await pickProfile(flags)
  const scan = await scanProfile({ profileDir: profile.dir, home: flags.home })
  const all = scan.plugins.filter((plugin) => plugin.version && plugin.kind !== 'builtin')
  const wanted = typeof flags.select === 'string' ? flags.select.split(',').map((item) => item.trim()) : null
  const selected = wanted ? all.filter((plugin) => wanted.includes(plugin.name)) : all
  if (selected.length === 0) throw new Error('no plugin matched the selection')
  const missing = wanted ? wanted.filter((item) => !all.some((plugin) => plugin.name === item)) : []

  const targetDsh = typeof flags.dsh === 'string' ? flags.dsh : requiredDsh(selected)
  const version = typeof flags.version === 'string' ? flags.version : '1.0.0'
  const out = typeof flags.out === 'string' ? flags.out : name + '-' + version + '.dshpack'

  const result = await createPack({
    profileDir: profile.dir,
    home: flags.home,
    name,
    version,
    select: selected.map((plugin) => plugin.name),
    targetDsh,
    align: Boolean(flags.align),
    resolveLatest: flags.align ? latestTag : undefined,
    author: '879745uhjun',
    out,
  })

  const diagnostics = diagnose({
    plugins: selected.map((plugin) => ({ ...plugin, enginesDsh: plugin.enginesDsh, dependencies: plugin.dependencies })),
    targetDsh,
  })
  const summary = summarize(diagnostics)
  if (flags.json) return JSON.stringify({ pack: result.out, bytes: result.bytes, files: result.files, manifest: result.manifest, diagnostics, summary }, null, 2)

  return [
    'pack      ' + result.out,
    'size      ' + mb(result.bytes) + '  (' + result.files + ' files)',
    'plugins   ' + result.manifest.plugins.length + '  ·  target DSH ' + (targetDsh ?? '-'),
    'missing   ' + (missing.length ? missing.join(', ') : '-'),
    '',
    'diagnostics  ' + summary.counts.BLOCKER + ' blocker / ' + summary.counts.WARN + ' warn / ' + summary.counts.INFO + ' info',
    formatDiagnostics(diagnostics),
  ].join('\n')
}

/** Turn a manifest plugin record back into the shape diagnose() expects. */
function fromManifest(entry) {
  return {
    name: entry.name,
    version: entry.version,
    enginesDsh: entry.engines?.dsh ?? null,
    dependencies: entry.dependencies ?? {},
    slots: entry.slots ?? [],
    takeover: Boolean(entry.takeover),
    takeoverSlots: entry.takeoverSlots ?? [],
    repo: entry.repo ?? null,
  }
}

/** dsh-pack inspect <pack> */
async function commandInspect(positional, flags) {
  const file = positional[0]
  if (!file) throw new Error('inspect needs a pack path')
  const pack = await readPack(file)
  const plugins = pack.manifest.plugins.map(fromManifest)
  const targetDsh = pack.manifest.engines?.dsh ?? null
  const diagnostics = diagnose({ plugins, targetDsh })
  const summary = summarize(diagnostics)
  const verified = verifyPack(pack)
  if (flags.json) return JSON.stringify({ manifest: pack.manifest, diagnostics, summary, verified }, null, 2)
  const lines = [
    'pack      ' + pack.manifest.name + ' ' + pack.manifest.version + '   (' + pack.manifest.format + ')',
    'created   ' + pack.manifest.createdAt,
    'target    DSH ' + (targetDsh ?? '-') + '   align ' + (pack.manifest.align?.enabled ? 'on' : 'off'),
    'files     ' + pack.files.size + '   checksums ' + (verified.ok ? 'OK' : 'BROKEN'),
    '',
    ['plugin'.padEnd(26), 'version'.padEnd(9), 'engine'.padEnd(26), 'slots'].join(' '),
  ]
  for (const plugin of plugins) {
    lines.push(
      [
        plugin.name.padEnd(26),
        plugin.version.padEnd(9),
        String(plugin.enginesDsh ?? '-').padEnd(26),
        plugin.slots.length ? plugin.slots.join(', ') : '-',
      ].join(' '),
    )
  }
  lines.push('', 'diagnostics  ' + summary.counts.BLOCKER + ' blocker / ' + summary.counts.WARN + ' warn / ' + summary.counts.INFO + ' info')
  lines.push(formatDiagnostics(diagnostics))
  return lines.join('\n')
}

/** dsh-pack verify <pack> */
async function commandVerify(positional, flags) {
  const file = positional[0]
  if (!file) throw new Error('verify needs a pack path')
  const pack = await readPack(file)
  const report = verifyPack(pack)
  if (flags.json) return JSON.stringify(report, null, 2)
  if (report.ok) return 'OK  ' + report.checked + ' files, ' + pack.manifest.plugins.length + ' plugins'
  return 'FAIL\n' + report.mismatch.map((line) => '  ' + line).join('\n')
}

/** Split a comma flag into names. */
function names(value) {
  return typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
}

/** dsh-pack install <pack> */
async function commandInstall(positional, flags) {
  const file = positional[0]
  if (!file) throw new Error('install needs a pack path')
  const profile = await pickProfile(flags)
  const home = resolveDshHome(typeof flags.home === 'string' ? flags.home : undefined)
  const result = await installPack({
    packFile: file,
    profileDir: profile.dir,
    home,
    skip: names(flags.skip),
    overwrite: names(flags.overwrite),
    dryRun: !flags.yes,
  })
  const lines = [
    'profile  ' + profile.dir,
    'backup   ' + (result.backupDir ?? '(dry run)'),
    '',
    ['action'.padEnd(9), 'plugin'.padEnd(26), 'pack'.padEnd(9), 'installed'].join(' '),
  ]
  for (const action of result.actions) {
    lines.push(
      [
        action.action.padEnd(9),
        action.name.padEnd(26),
        String(action.version).padEnd(9),
        action.installedVersion ?? '-',
      ].join(' '),
    )
  }
  lines.push('', result.pending.length + ' plugin(s) to write' + (flags.yes ? '' : ' · dry run, pass --yes to install'))
  if (result.lock) lines.push(result.lock.ok ? 'lock    pnpm-lock.yaml refreshed' : 'lock    not refreshed: ' + result.lock.error)
  if (result.verification) lines.push('verify  ' + (result.verification.ok ? 'checksums OK' : 'MISMATCH (override used)'))
  return lines.join('\n')
}

/** dsh-pack backups */
async function commandBackups(flags) {
  const home = resolveDshHome(typeof flags.home === 'string' ? flags.home : undefined)
  const backups = (await listBackups(home)).filter((item) => item.plan)
  if (backups.length === 0) return 'no install backup yet'
  return backups
    .map((item) => [
      item.stamp.padEnd(20),
      String(item.plan.pack).padEnd(16),
      String(item.plan.version).padEnd(8),
      (item.plan.actions ?? []).filter((action) => action.action !== 'skip').length + ' plugin(s)',
    ].join(' '))
    .join('\n')
}

/** dsh-pack restore <stamp|latest> */
async function commandRestore(positional, flags) {
  const profile = await pickProfile(flags)
  const home = resolveDshHome(typeof flags.home === 'string' ? flags.home : undefined)
  const wanted = positional[0]
  if (!wanted) throw new Error('restore needs a backup stamp or "latest"')
  const backups = (await listBackups(home)).filter((item) => item.plan)
  const chosen = wanted === 'latest' ? backups[0] : backups.find((item) => item.stamp === wanted)
  if (!chosen) throw new Error('no backup named ' + wanted)
  const result = await restoreBackup({ backupDir: chosen.dir, profileDir: profile.dir, home })
  return [
    'restored  ' + chosen.stamp + '  (' + result.pack + ' ' + result.version + ')',
    'put back  ' + (result.restored.join(', ') || '-'),
    'removed   ' + (result.removed.join(', ') || '-'),
    'configs   ' + (result.configs.join(', ') || '-'),
    'restart DSH to pick the restored plugins up',
  ].join('\n')
}

/** dsh-pack prune [--keep N] */
async function commandPrune(flags) {
  const home = resolveDshHome(typeof flags.home === 'string' ? flags.home : undefined)
  const keep = Number(flags.keep ?? 10)
  const result = await pruneBackups(home, { keep, dryRun: Boolean(flags['dry-run']) })
  if (result.removed.length === 0) return 'nothing to prune (kept ' + result.kept + ')'
  return result.removed.map((item) => (flags['dry-run'] ? 'would remove ' : 'removed ') + item.stamp).join('\n')
}

/** dsh-pack align [--upgrade] [--fetch] [--only a,b] */
async function commandAlign(flags) {
  const profile = await pickProfile(flags)
  const theScan = await scanProfile({ profileDir: profile.dir, home: flags.home })
  const only = typeof flags.only === 'string' ? new Set(flags.only.split(',').map((item) => item.trim())) : null
  const lines = []
  for (const plugin of theScan.plugins) {
    if (!plugin.dir || (only && !only.has(plugin.name))) continue
    let from = null
    try {
      from = await currentTag(plugin.dir)
    } catch {
      continue
    }
    if (from === null && !flags.upgrade) {
      lines.push(plugin.name.padEnd(26) + 'untagged checkout')
      continue
    }
    let to = null
    try {
      to = await latestLocalTag(plugin.dir, Boolean(flags.fetch))
    } catch {
      to = null
    }
    if (!to) {
      lines.push(plugin.name.padEnd(26) + 'no tags')
      continue
    }
    if (flags.upgrade && from !== to) {
      const moved = await upgradeToLatestTag(plugin.dir, { fetch: Boolean(flags.fetch) })
      if (!moved.ok) {
        lines.push(plugin.name.padEnd(26) + 'skipped: ' + moved.skipped)
        continue
      }
      lines.push(plugin.name.padEnd(26) + (moved.from ?? 'untagged') + ' -> ' + moved.to + (moved.changed ? '  (moved)' : ''))
      continue
    }
    lines.push(plugin.name.padEnd(26) + (from ?? 'untagged') + (from === to ? '  up to date' : '  -> ' + to))
  }
  return lines.join('\n') || 'no tagged plugin found'
}

const { command, positional, flags } = parseArgs(process.argv.slice(2))

// --pnpm lets a plain CLI run reuse the desktop runtime's pnpm.cjs for lock sync.
if (typeof flags.pnpm === 'string' && flags.pnpm.length > 0) process.env.DSH_PNPM = flags.pnpm

try {
  if (!command || command === 'help' || flags.help) {
    console.log(USAGE)
  } else if (command === 'scan') {
    console.log(await commandScan(flags))
  } else if (command === 'create') {
    console.log(await commandCreate(positional, flags))
  } else if (command === 'inspect') {
    console.log(await commandInspect(positional, flags))
  } else if (command === 'verify') {
    console.log(await commandVerify(positional, flags))
  } else if (command === 'install') {
    console.log(await commandInstall(positional, flags))
  } else if (command === 'backups') {
    console.log(await commandBackups(flags))
  } else if (command === 'restore') {
    console.log(await commandRestore(positional, flags))
  } else if (command === 'prune') {
    console.log(await commandPrune(flags))
  } else if (command === 'align') {
    console.log(await commandAlign(flags))
  } else {
    console.error('unknown command: ' + command)
    console.error(USAGE)
    process.exitCode = 2
  }
} catch (error) {
  console.error('error: ' + error.message)
  process.exitCode = 1
}
