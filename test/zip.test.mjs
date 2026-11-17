import assert from 'node:assert/strict'
import { test } from 'node:test'
import { zipRead, zipWrite, crc32 } from '../lib/zip.mjs'

test('round-trips text, Chinese and binary entries', () => {
  const binary = Buffer.from([0, 1, 2, 250, 251, 252, 0, 255])
  const entries = [
    { name: 'manifest.json', data: Buffer.from('{"name":"dsh-toolkit"}') },
    { name: 'plugins/dsh-session-stars/README.md', data: '# 星级收藏\n中文内容\n'.repeat(20) },
    { name: 'bin/blob.dat', data: binary },
  ]
  const archive = zipWrite(entries)
  const back = zipRead(archive)
  assert.equal(back.size, 3)
  assert.equal(back.get('manifest.json').toString('utf8'), '{"name":"dsh-toolkit"}')
  assert.match(back.get('plugins/dsh-session-stars/README.md').toString('utf8'), /中文内容/)
  assert.deepEqual([...back.get('bin/blob.dat')], [...binary])
})

test('crc32 matches the known value for 123456789', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926)
})

test('reads back entries in write order', () => {
  const archive = zipWrite([
    { name: 'a.txt', data: 'a' },
    { name: 'b.txt', data: 'b' },
    { name: 'c.txt', data: 'c' },
  ])
  assert.deepEqual([...zipRead(archive).keys()], ['a.txt', 'b.txt', 'c.txt'])
})
