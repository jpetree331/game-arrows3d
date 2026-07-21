// Level generator — plain Node importing src/lib directly (the framework-free
// seam paying off). Requires Node 22+ type stripping:
//   npm run gen -- <NNN> <starCount> [seed]     → writes src/levels/NNN.json
//   npm run gen -- verify <starCount> [seed]    → 5 boards, stats only, no write
// e.g. npm run gen -- 002 16 20260720

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TUNING } from '../src/config/tuning.ts'
import { findSolution } from '../src/lib/solver.ts'

const [, , nnn = '002', countArg = '16', seedArg] = process.argv
const N = Number(countArg)
const baseSeed = seedArg ? Number(seedArg) : (Date.now() & 0xffffffff) >>> 0

// mulberry32 — tiny seeded PRNG so boards are reproducible from the log line
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const maxPos = TUNING.LEVEL_POS_FRACTION * TUNING.BOUNDS_R
const minSpacing = TUNING.GEN_MIN_SPACING_FACTOR * TUNING.STAR_R
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function randUnit(rand) {
  const z = rand() * 2 - 1
  const phi = rand() * Math.PI * 2
  const r = Math.sqrt(1 - z * z)
  return [r * Math.cos(phi), r * Math.sin(phi), z]
}

function randPos(rand) {
  // uniform in sphere of radius maxPos via rejection
  for (;;) {
    const p = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1].map((v) => v * maxPos)
    if (Math.hypot(...p) <= maxPos) return p
  }
}

function tryBoard(rand) {
  const stars = []
  for (let i = 0; i < N; i++) {
    let placed = false
    for (let attempt = 0; attempt < 200; attempt++) {
      const pos = randPos(rand)
      if (stars.every((s) => dist(s.pos, pos) >= minSpacing)) {
        stars.push({ id: `s${String(i + 1).padStart(2, '0')}`, pos, dir: randUnit(rand) })
        placed = true
        break
      }
    }
    if (!placed) return null // couldn't satisfy spacing; counts as a rejected board
  }
  return stars
}

/** Search up to GEN_MAX_BOARDS random boards for a solvable one. */
function generate(seed) {
  const rand = mulberry32(seed)
  let rejected = 0
  for (let board = 1; board <= TUNING.GEN_MAX_BOARDS; board++) {
    const stars = tryBoard(rand)
    const solution = stars ? findSolution({ stars, trails: [] }) : null
    if (!solution) {
      rejected++
      continue
    }
    return { stars, solution, tried: board, rejected }
  }
  return null
}

if (nnn === 'verify') {
  let ok = 0
  for (let i = 0; i < 5; i++) {
    const seed = (baseSeed + i) >>> 0
    const result = generate(seed)
    if (result) {
      ok++
      console.log(
        `board ${i + 1}: OK  seed=${seed} tried=${result.tried} rejected=${result.rejected} solution=${result.solution.join(' ')}`,
      )
    } else {
      console.log(`board ${i + 1}: FAILED seed=${seed} (no solvable board in ${TUNING.GEN_MAX_BOARDS})`)
    }
  }
  console.log(`${ok}/5 solvable at N=${N}`)
  process.exit(ok === 5 ? 0 : 1)
}

const result = generate(baseSeed)
if (!result) {
  console.error(`FAILED: no solvable board in ${TUNING.GEN_MAX_BOARDS} tries (N=${N} seed=${baseSeed})`)
  process.exit(1)
}
const round = (v) => Math.round(v * 10000) / 10000
const level = {
  name: `Cluster ${nnn}`,
  stars: result.stars.map((s) => ({ id: s.id, pos: s.pos.map(round), dir: s.dir.map(round) })),
  _solution: result.solution,
  _meta: { seed: baseSeed, boardsTried: result.tried, rejected: result.rejected, generated: new Date().toISOString() },
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels', `${nnn}.json`)
writeFileSync(out, JSON.stringify(level, null, 2) + '\n')
console.log(`OK ${nnn}.json  N=${N} seed=${baseSeed} boards tried=${result.tried} rejected=${result.rejected}`)
console.log(`solution: ${result.solution.join(' ')}`)
