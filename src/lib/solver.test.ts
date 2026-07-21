import { describe, expect, it } from 'vitest'
import type { BoardState } from './sim'
import { applyShot, evaluateShot } from './sim'
import { findSolution } from './solver'

describe('findSolution', () => {
  it('solves the offset 3-star line back-to-front', () => {
    const s: BoardState = {
      stars: [
        { id: 'A', pos: [0, 0, 0], dir: [1, 0, 0] },
        { id: 'B', pos: [2, 0.5, 0], dir: [1, 0, 0] },
        { id: 'C', pos: [4, 1, 0], dir: [1, 0, 0] },
      ],
      trails: [],
    }
    expect(findSolution(s)).toEqual(['C', 'B', 'A'])
  })

  it('an exactly collinear line is unsolvable: the leader trail blocks followers', () => {
    const s: BoardState = {
      stars: [
        { id: 'A', pos: [0, 0, 0], dir: [1, 0, 0] },
        { id: 'B', pos: [2, 0, 0], dir: [1, 0, 0] },
        { id: 'C', pos: [4, 0, 0], dir: [1, 0, 0] },
      ],
      trails: [],
    }
    expect(findSolution(s)).toBeNull()
  })

  it('returns null for a mutual deadlock', () => {
    // Two stars aimed straight at each other: each forever blocks the other.
    const s: BoardState = {
      stars: [
        { id: 'A', pos: [-2, 0, 0], dir: [1, 0, 0] },
        { id: 'B', pos: [2, 0, 0], dir: [-1, 0, 0] },
      ],
      trails: [],
    }
    expect(findSolution(s)).toBeNull()
  })

  it('found solutions replay legally to a clear board', () => {
    // blocker sits 0.5 off across's path (star-blocks it) but fires away
    // perpendicular, so its trail chord does not: blocker before across.
    const s: BoardState = {
      stars: [
        { id: 'up', pos: [0, 1, 0], dir: [0, 1, 0] },
        { id: 'blocker', pos: [2, 0.5, 3], dir: [0, 0, 1] },
        { id: 'across', pos: [-3, 0, 3], dir: [1, 0, 0] },
      ],
      trails: [],
    }
    expect(evaluateShot(s, 'across').legal).toBe(false)
    const order = findSolution(s)
    expect(order).not.toBeNull()
    expect(order!.indexOf('blocker')).toBeLessThan(order!.indexOf('across'))
    let state = s
    for (const id of order!) {
      expect(evaluateShot(state, id).legal).toBe(true)
      state = applyShot(state, id)
    }
    expect(state.stars).toHaveLength(0)
  })

  it('respects the node cap', () => {
    const s: BoardState = {
      stars: [
        { id: 'A', pos: [0, 0, 0], dir: [1, 0, 0] },
        { id: 'B', pos: [2, 0, 0], dir: [1, 0, 0] },
      ],
      trails: [],
    }
    expect(findSolution(s, undefined, 1)).toBeNull()
  })
})
