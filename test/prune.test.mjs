import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { listBackups, pruneBackups } from '../lib/restore.mjs'

/** Three install backups plus one unrelated link backup. */
async function makeBackups() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pack-prune-'))
  const home = join(root, '.dsh')
  const dirs = ['20260101-000000', '20260102-000000', '20260103-000000']
  for (const stamp of dirs) {
    const dir = join(home, 'backups', stamp)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'plan.json'), JSON.stringify({ pack: 'p', version: '1.0.0', actions: [] }))
  }
  await mkdir(join(home, 'backups', 'link-20260104'), { recursive: true })
  return { home, dirs }
}

test('pruneBackups keeps the newest N install backups', async () => {
  const { home, dirs } = await makeBackups()
  const result = await pruneBackups(home, { keep: 2 })
  assert.equal(result.kept, 2)
  assert.deepEqual(result.removed.map((item) => item.stamp), ['20260101-000000'])
  assert.ok(!existsSync(join(home, 'backups', dirs[0])))
  assert.ok(existsSync(join(home, 'backups', dirs[2])))
  assert.ok(existsSync(join(home, 'backups', 'link-20260104')), 'link-* backups are never pruned')
  assert.equal((await listBackups(home)).filter((item) => item.plan).length, 2)
})

test('pruneBackups dry run reports without deleting', async () => {
  const { home, dirs } = await makeBackups()
  const result = await pruneBackups(home, { keep: 1, dryRun: true })
  assert.equal(result.removed.length, 2)
  assert.ok(existsSync(join(home, 'backups', dirs[0])))
})

test('pruneBackups is a no-op when nothing needs dropping', async () => {
  const { home } = await makeBackups()
  const result = await pruneBackups(home, { keep: 10 })
  assert.deepEqual(result.removed, [])
  assert.equal(result.kept, 3)
})
