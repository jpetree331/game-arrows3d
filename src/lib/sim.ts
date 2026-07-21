// lib/sim.ts — framework-free: no React, no three, no DOM imports.
// All game rules live here as pure functions; the renderer only animates answers.

import { TUNING } from '../config/tuning.ts'
import type { Vec3 } from './vec.ts'
import { add, distPointSeg, dot, lenSq, scale, sub, EPS } from './vec.ts'

export interface Star {
  id: string
  pos: Vec3
  dir: Vec3 // unit
}

export interface Trail {
  id: string
  a: Vec3
  b: Vec3
}

export interface BoardState {
  stars: Star[]
  trails: Trail[]
}

export interface Seg {
  a: Vec3
  b: Vec3
}

export interface Capsule {
  a: Vec3
  b: Vec3
  r: number
}

export interface SimConfig {
  boundsR: number
  starR: number
  trailR: number
}

export const DEFAULT_SIM: SimConfig = {
  boundsR: TUNING.BOUNDS_R,
  starR: TUNING.STAR_R,
  trailR: TUNING.TRAIL_R,
}

export interface ShotResult {
  legal: boolean
  /** Fraction [0,1] along pos→exitPoint of the first collision. Present iff !legal. */
  hitT?: number
  /** What the first collision was with. Present iff !legal. */
  hitKind?: 'star' | 'trail'
  exitPoint: Vec3
}

/**
 * First contact of a sphere (radius r) swept along seg against a static
 * sphere (center, R). Returns t in [0,1] along the segment, or null for a
 * clean miss. A start already touching/overlapping returns 0.
 */
export function sweptSphereVsSphere(seg: Seg, r: number, center: Vec3, R: number): number | null {
  const d = sub(seg.b, seg.a)
  const m = sub(seg.a, center)
  const rr = r + R
  const c = lenSq(m) - rr * rr
  if (c <= 0) return 0 // starting in contact
  const A = lenSq(d)
  if (A < EPS) return null // no motion, no initial contact
  const B = dot(m, d)
  if (B >= 0) return null // moving away
  const disc = B * B - A * c
  if (disc < 0) return null
  const t = (-B - Math.sqrt(disc)) / A
  return t >= 0 && t <= 1 ? t : null
}

/**
 * First contact of a sphere (radius r) swept along seg against a static
 * capsule. Returns t in [0,1] or null. Equivalent to sweeping a point
 * against the capsule inflated by r: infinite-cylinder body test clamped to
 * the axis span, plus sphere tests on both caps.
 */
export function sweptSphereVsCapsule(seg: Seg, r: number, capsule: Capsule): number | null {
  const R = r + capsule.r
  const u = sub(capsule.b, capsule.a)
  const uLenSq = lenSq(u)
  if (uLenSq < EPS * EPS) return sweptSphereVsSphere(seg, r, capsule.a, capsule.r)

  if (distPointSeg(seg.a, capsule.a, capsule.b) <= R) return 0 // starting in contact

  const uLen = Math.sqrt(uLenSq)
  const uHat = scale(u, 1 / uLen)
  const d = sub(seg.b, seg.a)
  const m = sub(seg.a, capsule.a)
  const md = dot(m, uHat)
  const dd = dot(d, uHat)
  // components perpendicular to the axis
  const mp = sub(m, scale(uHat, md))
  const dp = sub(d, scale(uHat, dd))

  let best: number | null = null

  const A = lenSq(dp)
  if (A > EPS) {
    const B = dot(mp, dp)
    const C = lenSq(mp) - R * R
    const disc = B * B - A * C
    if (disc >= 0) {
      const t = (-B - Math.sqrt(disc)) / A // entering root
      if (t >= 0 && t <= 1) {
        const s = md + t * dd // axial position at contact
        if (s >= 0 && s <= uLen) best = t
      }
    }
  }

  for (const cap of [capsule.a, capsule.b]) {
    const t = sweptSphereVsSphere(seg, r, cap, capsule.r)
    if (t !== null && (best === null || t < best)) best = t
  }

  return best
}

/** Exit point of a ray from pos along unit dir on the bounds sphere. */
export function boundsExit(pos: Vec3, dir: Vec3, boundsR: number): Vec3 {
  const B = dot(pos, dir)
  const C = lenSq(pos) - boundsR * boundsR
  const disc = B * B - C
  // pos is inside the bounds in every legal board state, so disc > 0 and the
  // positive root exists; guard anyway for defensive callers.
  const t = -B + Math.sqrt(Math.max(0, disc))
  return add(pos, scale(dir, t))
}

/**
 * Is firing this star legal, and if not, where does it stop?
 * The swept sphere runs from the star's pos to its bounds exit point and must
 * touch no remaining star and no existing trail.
 */
export function evaluateShot(state: BoardState, starId: string, cfg: SimConfig = DEFAULT_SIM): ShotResult {
  const star = state.stars.find((s) => s.id === starId)
  if (!star) return { legal: false, hitT: 0, exitPoint: [0, 0, 0] }

  const exitPoint = boundsExit(star.pos, star.dir, cfg.boundsR)
  const seg: Seg = { a: star.pos, b: exitPoint }

  let minT: number | null = null
  let hitKind: 'star' | 'trail' = 'star'
  for (const other of state.stars) {
    if (other.id === starId) continue
    const t = sweptSphereVsSphere(seg, cfg.starR, other.pos, cfg.starR)
    if (t !== null && (minT === null || t < minT)) {
      minT = t
      hitKind = 'star'
    }
  }
  for (const trail of state.trails) {
    const t = sweptSphereVsCapsule(seg, cfg.starR, { a: trail.a, b: trail.b, r: cfg.trailR })
    if (t !== null && (minT === null || t < minT)) {
      minT = t
      hitKind = 'trail'
    }
  }

  return minT === null ? { legal: true, exitPoint } : { legal: false, hitT: minT, hitKind, exitPoint }
}

/**
 * The trail a star leaves when fired: the full chord of its line through the
 * bounds sphere — from the backward bounds intersection, through pos, to the
 * exit point.
 *
 * RULE AMENDMENT (flagged in the Sprint 1 report): the brief specified the
 * trail as pos→exit only, but that rule is provably symmetric — if Q's path
 * comes within STAR_R+TRAIL_R of P's path, each one's trail blocks the other,
 * so no solvable board can ever produce a trail collision and the "trails are
 * obstacles" thesis is vacuous. Full-chord trails restore asymmetric one-way
 * ordering constraints (your path may cross the part of a line BEHIND its
 * star) and make trail collisions actually reachable in solvable levels.
 */
export function trailForStar(star: Star, cfg: SimConfig = DEFAULT_SIM): Trail {
  const back = boundsExit(star.pos, scale(star.dir, -1), cfg.boundsR)
  const exit = boundsExit(star.pos, star.dir, cfg.boundsR)
  return { id: `trail-${star.id}`, a: back, b: exit }
}

/**
 * Immutable: legal shot returns a new state with the star removed and its
 * trail (full chord) added; illegal shot returns the input state unchanged.
 */
export function applyShot(state: BoardState, starId: string, cfg: SimConfig = DEFAULT_SIM): BoardState {
  const result = evaluateShot(state, starId, cfg)
  if (!result.legal) return state
  const star = state.stars.find((s) => s.id === starId)!
  return {
    stars: state.stars.filter((s) => s.id !== starId),
    trails: [...state.trails, trailForStar(star, cfg)],
  }
}
