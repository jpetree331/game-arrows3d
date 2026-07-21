import { describe, expect, it } from 'vitest'
import raw from './001.json'
import { sanitizeLevel, toBoard } from '../lib/level'
import type { BoardState } from '../lib/sim'
import { applyShot, evaluateShot } from '../lib/sim'
import { findSolution } from '../lib/solver'

const board = (): BoardState => toBoard(sanitizeLevel(raw))

/** All permutations of ids (5! = 120 — cheap). */
function permutations(ids: string[]): string[][] {
  if (ids.length <= 1) return [ids]
  return ids.flatMap((id) => permutations(ids.filter((x) => x !== id)).map((rest) => [id, ...rest]))
}

describe('level 001 — First Light', () => {
  it('sanitizes to 5 stars and ignores underscore keys', () => {
    const level = sanitizeLevel(raw)
    expect(level.name).toBe('First Light')
    expect(level.stars).toHaveLength(5)
  })

  it('is solvable in exactly one order (brute force over all 120)', () => {
    const ids = board().stars.map((s) => s.id)
    const clears = permutations(ids).filter((order) => {
      let s = board()
      for (const id of order) {
        if (!evaluateShot(s, id).legal) return false
        s = applyShot(s, id)
      }
      return s.stars.length === 0
    })
    expect(clears).toEqual([['E', 'D', 'C', 'B', 'A']])
  })

  it('the solver finds that order', () => {
    expect(findSolution(board())).toEqual(['E', 'D', 'C', 'B', 'A'])
  })

  it('decoy: B is legal immediately, but firing it dooms C on a trail collision', () => {
    let s = board()
    expect(evaluateShot(s, 'B').legal).toBe(true)
    s = applyShot(s, 'B')
    const doomed = evaluateShot(s, 'C')
    expect(doomed.legal).toBe(false)
    expect(doomed.hitKind).toBe('trail')
  })
})
