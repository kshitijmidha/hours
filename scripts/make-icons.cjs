/* Generates Stilltime's app icon (.ico/.png) and tray icon without any dependencies. */
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const zlib = require('node:zlib')

const OUT_DIR = join(__dirname, '..', 'build')
const SS = 4 // supersampling factor

const PULSE = [
  [0.18, 0.52], [0.34, 0.52], [0.43, 0.33], [0.53, 0.70], [0.62, 0.43], [0.70, 0.52], [0.82, 0.52],
]
const TOP = [0x5c, 0xa7, 0xff]
const BOTTOM = [0x76, 0x59, 0xe8]

function insideRoundedRect(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius)
  const cy = Math.min(Math.max(y, radius), size - radius)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function distanceToPulse(x, y) {
  let best = Infinity
  for (let index = 0; index < PULSE.length - 1; index++) {
    const ax = PULSE[index][0]
    const ay = PULSE[index][1]
    const bx = PULSE[index + 1][0]
    const by = PULSE[index + 1][1]
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / lengthSq))
    const px = ax + t * dx
    const py = ay + t * dy
    const dist = Math.hypot(x - px, y - py)
    if (dist < best) best = dist
  }
  return best
}

function renderIcon(size) {
  const radius = size * 0.225
  const strokeRadius = size * 0.045
  const pixels = new Uint8ClampedArray(size * size * 4)
  const sub = 1 / SS
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) * sub
          const py = y + (sy + 0.5) * sub
          if (!insideRoundedRect(px, py, size, radius)) continue
          const k = py / size
          let cr = TOP[0] + (BOTTOM[0] - TOP[0]) * k
          let cg = TOP[1] + (BOTTOM[1] - TOP[1]) * k
          let cb = TOP[2] + (BOTTOM[2] - TOP[2]) * k
          if (distanceToPulse(px / size, py / size) * size <= strokeRadius) {
            cr = 255
            cg = 255
            cb = 255
          }
          r += cr
          g += cg
          b += cb
          a += 255
        }
      }
      const samples = SS * SS
      const index = (y * size + x) * 4
      const alpha = a / samples
      const coverage = alpha / 255
      if (coverage === 0) continue
      pixels[index] = Math.round(r / samples / coverage)
      pixels[index + 1] = Math.round(g / samples / coverage)
      pixels[index + 2] = Math.round(b / samples / coverage)
      pixels[index + 3] = Math.round(alpha)
    }
  }
  return Buffer.from(pixels.buffer)
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const header = Buffer.alloc(4)
  header.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([header, body, crc])
}

function encodePng(rgba, size) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const entries = []
  const blobs = []
  let offset = 6 + images.length * 16
  for (const image of images) {
    const size = image.size
    const rowSize = size * 4
    const maskRowSize = Math.ceil(size / 32) * 4
    const info = Buffer.alloc(40)
    info.writeUInt32LE(40, 0)
    info.writeInt32LE(size, 4)
    info.writeInt32LE(size * 2, 8)
    info.writeUInt16LE(1, 12)
    info.writeUInt16LE(32, 14)
    info.writeUInt32LE(0, 16)
    info.writeUInt32LE(rowSize * size, 20)
    const body = Buffer.alloc(rowSize * size)
    const mask = Buffer.alloc(maskRowSize * size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const source = ((size - 1 - y) * size + x) * 4
        const target = (y * size + x) * 4
        body[target] = image.rgba[source + 2]
        body[target + 1] = image.rgba[source + 1]
        body[target + 2] = image.rgba[source]
        body[target + 3] = image.rgba[source + 3]
        if (image.rgba[source + 3] < 128) {
          mask[y * maskRowSize + (x >> 3)] |= 0x80 >> (x & 7)
        }
      }
    }
    const blob = Buffer.concat([info, body, mask])
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(blob.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    blobs.push(blob)
    offset += blob.length
  }
  return Buffer.concat([header, ...entries, ...blobs])
}

mkdirSync(OUT_DIR, { recursive: true })

const iconSizes = [16, 24, 32, 48, 64, 128, 256]
const rendered = iconSizes.map((size) => ({ size, rgba: renderIcon(size) }))

writeFileSync(join(OUT_DIR, 'icon.ico'), encodeIco(rendered))
const big = rendered.find((image) => image.size === 256)
writeFileSync(join(OUT_DIR, 'icon.png'), encodePng(big.rgba, 256))
const tray = rendered.find((image) => image.size === 32)
writeFileSync(join(OUT_DIR, 'tray.png'), encodePng(tray.rgba, 32))

console.log(`Stilltime icons written to ${OUT_DIR}`)
