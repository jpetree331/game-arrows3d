import { describe, expect, it } from 'vitest'
import { sanitizeLevel } from './level'
import { len } from './vec'

describe('sanitizeLevel', () => {
  it('passes a well-formed level through', () => {
    const level = sanitizeLevel({
      name: 'Test',
      stars: [{ id: 's1', pos: [1, 2, 3], dir: [0, 0, 2] }],
      _solution: ['s1'], // underscore keys must be ignored
    })
    expect(level.name).toBe('Test')
    expect(level.stars).toHaveLength(1)
    expect(len(level.stars[0].dir)).toBeCloseTo(1, 10) // renormalized
  })

  it('clamps out-of-bounds positions to 0.8·BOUNDS_R', () => {
    const level = sanitizeLevel({ name: 'Far', stars: [{ id: 's', pos: [100, 0, 0], dir: [1, 0, 0] }] })
    expect(len(level.stars[0].pos)).toBeCloseTo(8, 10)
  })

  it('drops malformed stars and never throws on garbage', () => {
    const level = sanitizeLevel({
      name: 'Messy',
      stars: [
        { id: 'ok', pos: [1, 0, 0], dir: [0, 1, 0] },
        { id: 'zero-dir', pos: [1, 0, 0], dir: [0, 0, 0] },
        { id: 'bad-pos', pos: [1, 'x', 0], dir: [0, 1, 0] },
        { id: 'nan', pos: [NaN, 0, 0], dir: [0, 1, 0] },
        null,
        42,
      ],
    })
    expect(level.stars.map((s) => s.id)).toEqual(['ok'])

    expect(sanitizeLevel(null).stars).toEqual([])
    expect(sanitizeLevel('nonsense').stars).toEqual([])
    expect(sanitizeLevel([1, 2, 3]).stars).toEqual([])
  })

  it('replaces duplicate and missing ids', () => {
    const level = sanitizeLevel({
      name: 'Dupes',
      stars: [
        { id: 'a', pos: [1, 0, 0], dir: [1, 0, 0] },
        { id: 'a', pos: [2, 0, 0], dir: [1, 0, 0] },
        { pos: [3, 0, 0], dir: [1, 0, 0] },
      ],
    })
    const ids = level.stars.map((s) => s.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe('a')
  })
})
