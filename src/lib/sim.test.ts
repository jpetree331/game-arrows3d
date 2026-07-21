import { describe, expect, it } from 'vitest'
import type { BoardState } from './sim'
import { applyShot, boundsExit, evaluateShot, sweptSphereVsCapsule, sweptSphereVsSphere } from './sim'
import type { Vec3 } from './vec'

const seg = (a: Vec3, b: Vec3) => ({ a, b })

describe('sweptSphereVsSphere', () => {
  it('head-on hit at the known t', () => {
    // r=1 sphere from x=0 to x=10, target at x=5 with R=1: contact at x=3 → t=0.3
    const t = sweptSphereVsSphere(seg([0, 0, 0], [10, 0, 0]), 1, [5, 0, 0], 1)
    expect(t).toBeCloseTo(0.3, 10)
  })

  it('grazing hit: closest approach exactly r+R', () => {
    // target at [5,2,0], R=1, r=1 → tangent contact at t=0.5
    const t = sweptSphereVsSphere(seg([0, 0, 0], [10, 0, 0]), 1, [5, 2, 0], 1)
    expect(t).toBeCloseTo(0.5, 6)
  })

  it('clean miss: closest approach just beyond r+R', () => {
    const t = sweptSphereVsSphere(seg([0, 0, 0], [10, 0, 0]), 1, [5, 2.001, 0], 1)
    expect(t).toBeNull()
  })

  it('contained start returns 0', () => {
    const t = sweptSphereVsSphere(seg([5, 0.5, 0], [15, 0.5, 0]), 1, [5, 0, 0], 1)
    expect(t).toBe(0)
  })

  it('target behind the motion is a miss', () => {
    const t = sweptSphereVsSphere(seg([0, 0, 0], [10, 0, 0]), 1, [-5, 0, 0], 1)
    expect(t).toBeNull()
  })

  it('stationary segment with no contact is a miss', () => {
    const t = sweptSphereVsSphere(seg([0, 0, 0], [0, 0, 0]), 1, [5, 0, 0], 1)
    expect(t).toBeNull()
  })
})

describe('sweptSphereVsCapsule', () => {
  // capsule along z through x=5: axis (5,0,-4)→(5,0,4), r=0.5
  const capsule = { a: [5, 0, -4] as Vec3, b: [5, 0, 4] as Vec3, r: 0.5 }

  it('hits the cylinder body at the known t', () => {
    // r=1 from x=0 to x=10 at z=0: combined radius 1.5 → contact at x=3.5 → t=0.35
    const t = sweptSphereVsCapsule(seg([0, 0, 0], [10, 0, 0]), 1, capsule)
    expect(t).toBeCloseTo(0.35, 10)
  })

  it('misses past the end of the axis span plus cap', () => {
    // z=6: axis ends at z=4, cap sphere reach 0.5, swept radius 1 → gap of 0.5
    const t = sweptSphereVsCapsule(seg([0, 0, 6], [10, 0, 6]), 1, capsule)
    expect(t).toBeNull()
  })

  it('hits the end-cap sphere', () => {
    // z=5: passes 1 beyond the z=4 cap center; combined radius 1.5 covers it
    const t = sweptSphereVsCapsule(seg([0, 0, 5], [10, 0, 5]), 1, capsule)
    expect(t).not.toBeNull()
    // contact with cap sphere at (5,0,4): |(x-5,0,1)| = 1.5 → x = 5-sqrt(1.25)
    expect(t!).toBeCloseTo((5 - Math.sqrt(1.25)) / 10, 10)
  })

  it('travel parallel to the axis, offset beyond reach, is a miss', () => {
    const t = sweptSphereVsCapsule(seg([7, 0, -10], [7, 0, 10]), 1, capsule)
    expect(t).toBeNull() // perpendicular distance 2 > 1.5
  })

  it('travel parallel to the axis within reach hits', () => {
    const t = sweptSphereVsCapsule(seg([6, 0, -10], [6, 0, 10]), 1, capsule)
    expect(t).not.toBeNull() // perpendicular distance 1 < 1.5, enters via the -z cap
  })

  it('contained start returns 0', () => {
    const t = sweptSphereVsCapsule(seg([5.5, 0, 0], [15, 0, 0]), 1, capsule)
    expect(t).toBe(0)
  })

  it('degenerate capsule behaves as a sphere', () => {
    const t = sweptSphereVsCapsule(seg([0, 0, 0], [10, 0, 0]), 1, { a: [5, 0, 0], b: [5, 0, 0], r: 1 })
    expect(t).toBeCloseTo(0.3, 10)
  })
})

describe('evaluateShot / applyShot on a 3-star line', () => {
  // A, B, C spaced along +x, all aiming +x: only back-to-front clears.
  const line = (): BoardState => ({
    stars: [
      { id: 'A', pos: [0, 0, 0], dir: [1, 0, 0] },
      { id: 'B', pos: [2, 0, 0], dir: [1, 0, 0] },
      { id: 'C', pos: [4, 0, 0], dir: [1, 0, 0] },
    ],
    trails: [],
  })

  it('front star is legal, blocked stars are not', () => {
    const s = line()
    expect(evaluateShot(s, 'C').legal).toBe(true)
    expect(evaluateShot(s, 'A').legal).toBe(false)
    expect(evaluateShot(s, 'B').legal).toBe(false)
  })

  it('A hits B first (ordering): hitT marks the nearer collision', () => {
    const s = line()
    const shot = evaluateShot(s, 'A')
    expect(shot.legal).toBe(false)
    // A's path to bounds exit x=10; contact with B (both r=0.35) at x=2-0.7=1.3 → t=0.13
    expect(shot.hitT!).toBeCloseTo(0.13, 6)
  })

  it('exactly collinear followers stay blocked by the leader trail (design thesis)', () => {
    // C's trail lies exactly along B's path: trails are obstacles, forever.
    const s = applyShot(line(), 'C')
    expect(evaluateShot(s, 'B').legal).toBe(false)
  })

  it('an offset line clears back-to-front and leaves three trails', () => {
    // 0.5 lateral offsets: inside star-block reach (2·STAR_R = 0.7) but outside
    // trail-block reach (STAR_R + TRAIL_R = 0.41) — order matters, trails don't
    // permanently block.
    let s: BoardState = {
      stars: [
        { id: 'A', pos: [0, 0, 0], dir: [1, 0, 0] },
        { id: 'B', pos: [2, 0.5, 0], dir: [1, 0, 0] },
        { id: 'C', pos: [4, 1, 0], dir: [1, 0, 0] },
      ],
      trails: [],
    }
    expect(evaluateShot(s, 'A').legal).toBe(false)
    expect(evaluateShot(s, 'B').legal).toBe(false)
    for (const id of ['C', 'B', 'A']) {
      expect(evaluateShot(s, id).legal).toBe(true)
      s = applyShot(s, id)
    }
    expect(s.stars).toHaveLength(0)
    expect(s.trails).toHaveLength(3)
  })

  it('a trail blocks a crossing shot', () => {
    let s = line()
    s = applyShot(s, 'C') // trail along +x from (4,0,0) to (10,0,0)
    const crosser: BoardState = {
      ...s,
      stars: [...s.stars, { id: 'X', pos: [6, -3, 0], dir: [0, 1, 0] }],
    }
    const shot = evaluateShot(crosser, 'X')
    expect(shot.legal).toBe(false)
  })

  it('illegal applyShot leaves state unchanged; legal applyShot is immutable', () => {
    const s = line()
    expect(applyShot(s, 'A')).toBe(s)
    const after = applyShot(s, 'C')
    expect(after).not.toBe(s)
    expect(s.stars).toHaveLength(3)
    expect(s.trails).toHaveLength(0)
  })

  it('exit point lands on the bounds sphere', () => {
    const exit = boundsExit([0, 0, 0], [1, 0, 0], 10)
    expect(exit[0]).toBeCloseTo(10, 10)
    const offCenter = boundsExit([3, 2, -1], [0, 0, 1], 10)
    expect(Math.hypot(...offCenter)).toBeCloseTo(10, 10)
  })
})
