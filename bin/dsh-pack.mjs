#!/usr/bin/env node
/**
 * dsh-pack — command line for building and installing plugin packs.
 *
 * @module dsh-plugin-pack/bin/dsh-pack
 */
import { listProfiles, resolveDshHome, scanProfile } from '../lib/scan.mjs'

const USAGE = [
  'dsh-pack <command> [options]',
  '',
  'Commands:',
  '  scan                     list the plugins a profile loads',
  '  create <name> --out <f>  build a .dshpack from the profile',
  '  inspect <pack>           print a pack manifest and its diagnostics',
  '  verify <pack>            check every checksum of a pack',
  '  install <pack>           preflight, back up, then install',
  '',
  'Options:',
  '  --profile <dir>   profile directory (default: the single profile under the DSH home)',
  '  --home <dir>      DSH home (default: %USERPROFILE%/.dsh)',
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

/** Print the plugin table for one profile. */
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

const { command, flags } = parseArgs(process.argv.slice(2))

try {
  if (!command || command === 'help' || flags.help) {
    console.log(USAGE)
  } else if (command === 'scan') {
    console.log(await commandScan(flags))
  } else if (['create', 'inspect', 'verify', 'install'].includes(command)) {
    console.log('not implemented yet: ' + command)
    process.exitCode = 2
  } else {
    console.error('unknown command: ' + command)
    console.error(USAGE)
    process.exitCode = 2
  }
} catch (error) {
  console.error('error: ' + error.message)
  process.exitCode = 1
}
