// Generates src/data/photos.json from the webp files in src/assets/photos.
//
// Reads real pixel dimensions straight out of the WebP headers (no deps), then
// attaches deterministic photography metadata so the prototype has something to
// filter and caption with. Metadata is seeded off the filename, so re-running
// this never reshuffles the gallery.
//
// The files live under src/assets (not public) so Astro's image pipeline can
// emit resized variants; this manifest only carries metadata, and pages join it
// against the globbed image modules by `id`.
//
// Usage: pnpm manifest

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const photosDir = join(root, 'src', 'assets', 'photos')
const outFile = join(root, 'src', 'data', 'photos.json')

// ---------------------------------------------------------------------------
// WebP header parsing
// ---------------------------------------------------------------------------

/**
 * Extract intrinsic dimensions from a WebP buffer.
 * Handles all three chunk flavours: VP8 (lossy), VP8L (lossless), VP8X (extended).
 * @param {import('node:buffer').Buffer} buf Raw file contents.
 * @returns {{ width: number, height: number }} Intrinsic pixel dimensions.
 */
function readWebpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('not a WebP file')
  }

  const chunk = buf.toString('ascii', 12, 16)

  // Extended format: canvas size lives in the VP8X chunk as two 24-bit LE ints.
  if (chunk === 'VP8X') {
    return {
      width: (buf.readUIntLE(24, 3) & 0xFFFFFF) + 1,
      height: (buf.readUIntLE(27, 3) & 0xFFFFFF) + 1,
    }
  }

  // Lossless: 0x2f signature, then 14 bits width-1 and 14 bits height-1.
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2F) {
      throw new Error('bad VP8L signature')
    }
    const bits = buf.readUInt32LE(21)
    return {
      width: (bits & 0x3FFF) + 1,
      height: ((bits >> 14) & 0x3FFF) + 1,
    }
  }

  // Lossy: 3-byte frame tag, 0x9d 0x01 0x2a start code, then two 16-bit sizes.
  if (chunk === 'VP8 ') {
    if (buf[23] !== 0x9D || buf[24] !== 0x01 || buf[25] !== 0x2A) {
      throw new Error('bad VP8 start code')
    }
    return {
      width: buf.readUInt16LE(26) & 0x3FFF,
      height: buf.readUInt16LE(28) & 0x3FFF,
    }
  }

  throw new Error(`unknown WebP chunk: ${chunk}`)
}

// ---------------------------------------------------------------------------
// Deterministic metadata
// ---------------------------------------------------------------------------

/**
 * FNV-1a — small, fast, and stable across Node versions, which matters because
 * the whole point is that regenerating produces an identical manifest.
 * @param {string} str
 */
function hash(str) {
  let h = 0x811C9DC5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** Seeded PRNG (mulberry32) so each photo gets a stable stream of values. */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)]

const SERIES = [
  'coastline',
  'highlands',
  'nocturne',
  'terrain',
  'wetlands',
  'orchard',
  'thaw',
  'fieldwork',
]

const LOCATIONS = [
  ['REYKJAVÍK', 'ICELAND'],
  ['HOKKAIDO', 'JAPAN'],
  ['PATAGONIA', 'ARGENTINA'],
  ['DOLOMITES', 'ITALY'],
  ['LOFOTEN', 'NORWAY'],
  ['YUNNAN', 'CHINA'],
  ['ISLE OF SKYE', 'SCOTLAND'],
  ['BIG SUR', 'UNITED STATES'],
  ['TASMANIA', 'AUSTRALIA'],
  ['ATACAMA', 'CHILE'],
]

const BODIES = ['Leica M11', 'Sony A7R V', 'Fujifilm GFX 100S', 'Nikon Z8', 'Canon R5']
const LENSES = ['35mm f/1.4', '50mm f/2', '24mm f/1.8', '85mm f/1.4', '21mm f/3.4', '90mm f/2.8']
const APERTURES = ['f/1.4', 'f/2', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/11']
const SHUTTERS = ['1/2000s', '1/1000s', '1/500s', '1/250s', '1/125s', '1/60s', '1/15s', '2s']
const ISOS = [64, 100, 200, 400, 800, 1600, 3200]

// Anchor date for the capture timeline. Photos are spread backwards from here,
// which gives the ribbon a real chronological axis to label.
const ANCHOR = Date.UTC(2026, 6, 15, 18, 0, 0)

// ---------------------------------------------------------------------------

const files = readdirSync(photosDir)
  .filter(f => f.toLowerCase().endsWith('.webp'))
  // "10.webp" must sort after "9.webp", so compare numerically.
  .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))

if (files.length === 0) {
  console.error(`No .webp files found in ${photosDir}`)
  process.exit(1)
}

const photos = files.map((file, index) => {
  const { width, height } = readWebpSize(readFileSync(join(photosDir, file)))
  const rand = rng(hash(file))

  const [city, country] = pick(rand, LOCATIONS)

  // Walk backwards in time by 3–9 hours per frame so the sequence reads as a
  // continuous shoot rather than random timestamps.
  const minutesBack = index * (180 + Math.floor(rand() * 360))
  const capturedAt = new Date(ANCHOR - minutesBack * 60_000)

  // Most frames carry one series tag; roughly a third carry a second.
  const primary = pick(rand, SERIES)
  const tags = [primary]
  if (rand() < 0.35) {
    const secondary = pick(rand, SERIES)
    if (secondary !== primary) {
      tags.push(secondary)
    }
  }

  return {
    id: file.replace(/\.webp$/i, ''),
    file,
    width,
    height,
    aspect: Number((width / height).toFixed(4)),
    orientation: width >= height ? 'landscape' : 'portrait',
    capturedAt: capturedAt.toISOString(),
    location: { city, country },
    exif: {
      body: pick(rand, BODIES),
      lens: pick(rand, LENSES),
      aperture: pick(rand, APERTURES),
      shutter: pick(rand, SHUTTERS),
      iso: pick(rand, ISOS),
    },
    tags,
  }
})

// Newest first — the ribbon reads from "latest" at one end backwards in time.
photos.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))

writeFileSync(outFile, `${JSON.stringify(photos, null, 2)}\n`)

const tagCounts = new Map()
for (const p of photos) {
  for (const t of p.tags) {
    tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  }
}

console.warn(`Wrote ${photos.length} photos to ${outFile}`)
console.warn(`Tags: ${[...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}(${n})`).join(' ')}`)
