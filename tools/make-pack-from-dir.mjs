#!/usr/bin/env node
/**
 * Build a .dshpack from a plugin directory that is not installed in any profile.
 * Used by the self-test and handy while developing a single plugin.
 *
 * @module dsh-plugin-pack/tools/make-pack-from-dir
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { buildManifest, checksumTable, collectFiles, tableDigest } from '../lib/pack.mjs'
import { describePlugin } from '../lib/scan.mjs'
import { zipWrite } from '../lib/zip.mjs'

const args = process.argv.slice(2)
const arg = (key, fallback) => {
  const index = args.indexOf('--' + key)
  return index >= 0 ? args[index + 1] : fallback
}

const dir = resolve(arg('dir', '.'))
const out = resolve(arg('out', join(dir, 'pack.dshpack')))
const name = arg('name', 'test-pack')
const version = arg('version', '1.0.0')

const plugin = await describePlugin(dir)
const entries = new Map()
for (const rel of await collectFiles(dir, dir)) {
  entries.set('plugins/' + plugin.name + '/' + rel, await readFile(join(dir, rel)))
}
const manifest = buildManifest({ name, version, enginesDsh: null, align: false, latest: {}, plugins: [plugin] })
manifest.build = { platform: process.platform + '-' + process.arch, node: process.version }
entries.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8'))
const table = checksumTable(entries)
entries.set('checksums.json', Buffer.from(JSON.stringify({ pack: tableDigest(table), files: table }, null, 2) + '\n', 'utf8'))

await mkdir(dirname(out), { recursive: true })
await writeFile(out, zipWrite([...entries].map(([entryName, data]) => ({ name: entryName, data }))))
console.log('packed ' + plugin.name + '@' + plugin.version + ' -> ' + out + '  (' + entries.size + ' files)')
