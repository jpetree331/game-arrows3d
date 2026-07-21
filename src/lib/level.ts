// lib/level.ts — framework-free: no React, no three, no DOM imports.
// Defensive level sanitizer: corrupt JSON must never crash the app.

import { TUNING } from '../config/tuning.ts'
import type { Vec3 } from './vec.ts'
import { clampLen, norm } from './vec.ts'
import type { BoardState, Star } from './sim.ts'
import { makeId } from './id.ts'

export interface Level {
  name: string
  stars: Star[]
}

const isFiniteTriple = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

/**
 * Clamp positions into bounds, renormalize dirs, drop malformed stars,
 * dedupe/replace bad ids. Underscore-prefixed keys (e.g. "_solution") are
 * ignored by construction — only "name" and "stars" are read.
 */
export function sanitizeLevel(raw: unknown, boundsR: number = TUNING.BOUNDS_R): Level {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { name: '(corrupt level)', stars: [] }
  }
  const obj = raw as Record<string, unknown>
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'Unnamed'

  const maxPos = TUNING.LEVEL_POS_FRACTION * boundsR
  const seen = new Set<string>()
  const stars: Star[] = []

  if (Array.isArray(obj.stars)) {
    for (const entry of obj.stars) {
      if (typeof entry !== 'object' || entry === null) continue
      const e = entry as Record<string, unknown>
      if (!isFiniteTriple(e.pos) || !isFiniteTriple(e.dir)) continue
      const dir = norm(e.dir as Vec3)
      if (!dir) continue // zero-length direction is meaningless
      const pos = clampLen(e.pos as Vec3, maxPos)
      let id = typeof e.id === 'string' && e.id ? e.id : makeId('star')
      if (seen.has(id)) id = makeId('star')
      seen.add(id)
      stars.push({ id, pos, dir })
    }
  }

  return { name, stars }
}

export function toBoard(level: Level): BoardState {
  return { stars: level.stars, trails: [] }
}
