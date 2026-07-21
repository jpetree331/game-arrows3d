// lib/vec.ts — framework-free: no React, no three, no DOM imports.
// Minimal Vec3 ops on plain number[3] tuples. Pure functions only.

export type Vec3 = [number, number, number]

export const EPS = 1e-9

export const v3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const lenSq = (a: Vec3): number => dot(a, a)
export const len = (a: Vec3): number => Math.sqrt(lenSq(a))
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b))
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/** Unit vector; returns null for near-zero input rather than dividing by ~0. */
export function norm(a: Vec3): Vec3 | null {
  const l = len(a)
  return l < EPS ? null : scale(a, 1 / l)
}

/** Clamp a vector's magnitude to at most maxLen. */
export function clampLen(a: Vec3, maxLen: number): Vec3 {
  const l = len(a)
  return l > maxLen ? scale(a, maxLen / l) : a
}

/** Distance from point p to segment ab. */
export function distPointSeg(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a)
  const abLenSq = lenSq(ab)
  if (abLenSq < EPS * EPS) return dist(p, a)
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / abLenSq))
  return dist(p, add(a, scale(ab, t)))
}
