/**
 * Minimal ZIP reader/writer — no third-party dependency.
 *
 * Writes DOS-compatible archives (UTF-8 names, deflate or store) and reads the
 * central directory back. Sizes stay under 4 GiB, so ZIP64 is not implemented.
 *
 * @module dsh-plugin-pack/lib/zip
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib'

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32 of a buffer, as ZIP requires. */
export function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** MS-DOS date/time pair for one JS date. */
function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/**
 * Build one ZIP archive.
 * @param entries - name/data/date records; data is a Buffer or a string (UTF-8).
 * @returns the archive bytes.
 */
export function zipWrite(entries) {
  const chunks = []
  const central = []
  let offset = 0
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8')
    const name = Buffer.from(entry.name, 'utf8')
    const stamp = dosDateTime(entry.date ?? new Date())
    const deflated = deflateRawSync(data, { level: 9 })
    const stored = deflated.length >= data.length
    const body = stored ? data : deflated
    const method = stored ? 0 : 8
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL_SIG, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(stamp.time, 10)
    local.writeUInt16LE(stamp.day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, name, body)

    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(CENTRAL_SIG, 0)
    dir.writeUInt16LE(0x031e, 4)
    dir.writeUInt16LE(20, 6)
    dir.writeUInt16LE(0x0800, 8)
    dir.writeUInt16LE(method, 10)
    dir.writeUInt16LE(stamp.time, 12)
    dir.writeUInt16LE(stamp.day, 14)
    dir.writeUInt32LE(crc, 16)
    dir.writeUInt32LE(body.length, 20)
    dir.writeUInt32LE(data.length, 24)
    dir.writeUInt16LE(name.length, 28)
    dir.writeUInt16LE(0, 30)
    dir.writeUInt16LE(0, 32)
    dir.writeUInt16LE(0, 34)
    dir.writeUInt16LE(0, 36)
    dir.writeUInt32LE(0, 38)
    dir.writeUInt32LE(offset, 42)
    central.push(dir, name)

    offset += local.length + name.length + body.length
  }

  const centralBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(EOCD_SIG, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...chunks, centralBuf, eocd])
}

/**
 * Read every file of one ZIP archive.
 * @param buf - archive bytes.
 * @returns a Map of entry name to decompressed bytes, in central-directory order.
 */
export function zipRead(buf) {
  let eocd = -1
  const floor = Math.max(0, buf.length - 65557)
  for (let i = buf.length - 22; i >= floor; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('zip: end-of-central-directory record not found')

  const count = buf.readUInt16LE(eocd + 10)
  const cdSize = buf.readUInt32LE(eocd + 12)
  const cdOffset = buf.readUInt32LE(eocd + 16)
  if (cdOffset + cdSize > buf.length) throw new Error('zip: central directory out of range')

  const files = new Map()
  let p = cdOffset
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(p) !== CENTRAL_SIG) throw new Error('zip: bad central header at entry ' + i)
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)

    if (buf.readUInt32LE(localOffset) !== LOCAL_SIG) throw new Error('zip: bad local header for ' + name)
    const localNameLen = buf.readUInt16LE(localOffset + 26)
    const localExtraLen = buf.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const raw = buf.subarray(dataStart, dataStart + compSize)
    files.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw))
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}
