import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { test } from 'node:test'
import { currentTag, latestLocalTag, upgradeToLatestTag } from '../lib/align.mjs'

const run = promisify(execFile)
const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
}

/** Run git in one directory. */
async function git(dir, ...args) {
  await run('git', ['-C', dir, ...args], { env: ENV, windowsHide: true })
}

/** A bare remote plus a clone that is checked out at an older tag. */
async function makeRepo() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pack-align-'))
  const bare = join(root, 'remote.git')
  const work = join(root, 'work')
  await run('git', ['init', '--bare', '-q', bare], { env: ENV, windowsHide: true })
  await run('git', ['clone', '-q', bare, work], { env: ENV, windowsHide: true })

  await writeFile(join(work, 'package.json'), JSON.stringify({ name: 'demo', version: '1.0.0' }))
  await git(work, 'add', '-A')
  await git(work, 'commit', '-qm', 'v1')
  await git(work, 'tag', 'v1.0.0')
  await git(work, 'push', '-q', 'origin', 'HEAD:master', '--tags')

  await writeFile(join(work, 'package.json'), JSON.stringify({ name: 'demo', version: '1.1.0' }))
  await git(work, 'commit', '-qam', 'v2')
  await git(work, 'tag', 'v1.1.0')
  await git(work, 'push', '-q', 'origin', 'HEAD:master', '--tags')

  const clone = join(root, 'clone')
  await run('git', ['clone', '-q', bare, clone], { env: ENV, windowsHide: true })
  await git(clone, 'checkout', '-q', 'v1.0.0')
  return { root, clone, work }
}

test('upgradeToLatestTag moves a checkout to its newest tag', async () => {
  const { clone } = await makeRepo()
  assert.equal(await currentTag(clone), 'v1.0.0')
  assert.equal(await latestLocalTag(clone), 'v1.1.0')
  const moved = await upgradeToLatestTag(clone)
  assert.equal(moved.ok, true)
  assert.equal(moved.changed, true)
  assert.equal(moved.to, 'v1.1.0')
  assert.equal(await currentTag(clone), 'v1.1.0')
  const again = await upgradeToLatestTag(clone)
  assert.equal(again.changed, false)
})

test('upgradeToLatestTag refuses a dirty work tree', async () => {
  const { clone } = await makeRepo()
  await writeFile(join(clone, 'notes.txt'), 'local edit')
  const moved = await upgradeToLatestTag(clone)
  assert.equal(moved.ok, false)
  assert.match(moved.skipped, /dirty/)
  assert.equal(await currentTag(clone), 'v1.0.0')
})

test('upgradeToLatestTag reports a repository without tags', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pack-notags-'))
  await mkdir(root, { recursive: true })
  await run('git', ['init', '-q', root], { env: ENV, windowsHide: true })
  await writeFile(join(root, 'a.txt'), 'x')
  await git(root, 'add', '-A')
  await git(root, 'commit', '-qm', 'one')
  const moved = await upgradeToLatestTag(root)
  assert.equal(moved.ok, false)
  assert.match(moved.skipped, /no tags/)
})
