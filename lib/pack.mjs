/**
 * Pack builder and reader — turns a scanned profile into one .dshpack archive
 * (manifest + plugin trees + configs + checksums) and reads it back.
 *
 * @module dsh-plugin-pack/lib/pack
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { scanProfile } from './scan.mjs'
import { zipRead, zipWrite } from './zip.mjs'

/** Archive format tag written into every manifest. */
export const FORMAT = 'dshpack/2'

/** Directories never copied into a pack. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', '.cache', 'coverage'])

/** Files never copied into a pack. */
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db'])

/** sha256 of one buffer, as sha256-<hex>. */
export function sha256(buf) {
  return 'sha256-' + createHash('sha256').update(buf).digest('hex')
}

/** Every file under one directory, as POSIX-style relative paths. */
export async function collectFiles(root, base) {
  const out = []
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return out
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      out.push(...(await collectFiles(path, base)))
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue
      if (entry.name.endsWith('.log')) continue
      out.push(relative(base, path).split(sep).join('/'))
    }
  }
  return out
}

/** Manifest skeleton for one pack. */
export function buildManifest(options) {
  const plugins = options.plugins.map((plugin) => ({
    name: plugin.name,
    version: plugin.version,
    engines: plugin.enginesDsh ? { dsh: plugin.enginesDsh } : {},
    dependencies: plugin.dependencies ?? {},
    slots: plugin.slots ?? [],
    takeover: Boolean(plugin.takeover),
    repo: plugin.repo ?? null,
    tag: plugin.tag ?? null,
    config: plugin.config ? 'config/' + plugin.config : null,
  }))
  return {
    format: FORMAT,
    name: options.name,
    version: options.version ?? '1.0.0',
    createdAt: new Date().toISOString(),
    author: options.author ?? null,
    engines: { dsh: options.enginesDsh ?? null },
    align: { enabled: Boolean(options.align), source: 'github-tags' },
    plugins,
  }
}

/** Checksum table for every entry except checksums.json itself. */
export function checksumTable(entries) {
  const table = {}
  for (const [name, data] of [...entries].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (name === 'checksums.json') continue
    table[name] = sha256(data)
  }
  return table
}

/** Digest over one checksum table, so the table itself cannot be edited. */
export function tableDigest(table) {
  return sha256(Buffer.from(JSON.stringify(table), 'utf8'))
}

/**
 * Build one pack.
 * @param options - profileDir, home, name, select (names), version, author,
 *                  targetDsh, align, out, resolveLatest.
 * @returns the manifest, the output path and the byte size.
 */
export async function createPack(options) {
  const scan = await scanProfile({ profileDir: options.profileDir, home: options.home })
  const wanted = options.select?.length ? new Set(options.select) : null
  const selected = scan.plugins.filter(
    (plugin) => plugin.version && plugin.kind !== 'builtin' && (!wanted || wanted.has(plugin.name)),
  )
  if (selected.length === 0) throw new Error('no plugin matched the selection')

  if (options.align && options.resolveLatest) {
    for (const plugin of selected) {
      if (!plugin.repo) continue
      try {
        const latest = await options.resolveLatest(plugin.repo)
        if (latest) plugin.tag = 'v' + latest
      } catch {
        // offline or missing repo: alignment stays informational
      }
    }
  }

  const entries = new Map()
  for (const plugin of selected) {
    const files = await collectFiles(plugin.dir, plugin.dir)
    for (const rel of files) {
      entries.set('plugins/' + plugin.name + '/' + rel, await readFile(join(plugin.dir, rel)))
    }
  }
  for (const plugin of selected) {
    if (!plugin.config) continue
    const source = join(scan.home, plugin.config)
    if (!existsSync(source)) continue
    entries.set('config/' + plugin.config, await readFile(source))
  }

  const target = options.targetDsh ?? null
  const manifest = buildManifest({
    name: options.name,
    version: options.version,
    author: options.author,
    enginesDsh: target,
    align: options.align,
    plugins: selected,
  })
  entries.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8'))

  const table = checksumTable(entries)
  entries.set('checksums.json', Buffer.from(JSON.stringify({ pack: tableDigest(table), files: table }, null, 2) + '\n', 'utf8'))

  const archive = zipWrite([...entries].map(([name, data]) => ({ name, data })))
  const out = options.out
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, archive)
  return { out, bytes: archive.length, files: entries.size, manifest }
}

/** Read one pack: its manifest, checksum table and every entry. */
export async function readPack(file) {
  const files = zipRead(await readFile(file))
  const manifestRaw = files.get('manifest.json')
  if (!manifestRaw) throw new Error('not a dshpack: manifest.json is missing')
  const manifest = JSON.parse(manifestRaw.toString('utf8'))
  if (manifest.format !== FORMAT) throw new Error('unsupported pack format: ' + manifest.format)
  const checksumsRaw = files.get('checksums.json')
  const checksums = checksumsRaw ? JSON.parse(checksumsRaw.toString('utf8')) : null
  return { manifest, checksums, files }
}

/**
 * Re-hash every entry of one pack and compare it with the recorded table.
 * @returns ok, the list of mismatches and how many files were checked.
 */
export function verifyPack(pack) {
  const table = pack.checksums?.files
  if (!table) return { ok: false, checked: 0, mismatch: ['checksums.json is missing'], packDigestOk: false }
  const mismatch = []
  let checked = 0
  for (const [name, expect] of Object.entries(table)) {
    const data = pack.files.get(name)
    checked += 1
    if (!data) {
      mismatch.push('missing ' + name)
      continue
    }
    if (sha256(data) !== expect) mismatch.push('changed ' + name)
  }
  const packDigestOk = tableDigest(table) === pack.checksums?.pack
  if (!packDigestOk) mismatch.push('checksums.json was edited')
  return { ok: mismatch.length === 0, checked, mismatch, packDigestOk }
}
