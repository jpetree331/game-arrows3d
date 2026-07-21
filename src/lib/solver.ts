// lib/solver.ts — framework-free: no React, no three, no DOM imports.
// Used by the level generator only — never at play time.

import { TUNING } from '../config/tuning'
import type { BoardState, SimConfig, Star } from './sim'
import { DEFAULT_SIM, applyShot, boundsExit, sweptSphereVsCapsule, sweptSphereVsSphere } from './sim'

/** How many obstacles (stars + trails) currently block this star's shot. */
function countBlockers(state: BoardState, star: Star, cfg: SimConfig): number {
  const seg = { a: star.pos, b: boundsExit(star.pos, star.dir, cfg.boundsR) }
  let n = 0
  for (const other of state.stars) {
    if (other.id === star.id) continue
    if (sweptSphereVsSphere(seg, cfg.starR, other.pos, cfg.starR) !== null) n++
  }
  for (const trail of state.trails) {
    if (sweptSphereVsCapsule(seg, cfg.starR, { a: trail.a, b: trail.b, r: cfg.trailR }) !== null) n++
  }
  return n
}

/**
 * DFS for a firing order that clears the board. Greedy ordering: at each
 * state, try stars with the fewest blockers first (only zero-blocker shots
 * are legal to fire). Trail geometry is fully determined by the set of fired
 * stars, so states memoize on the remaining-id set. Hard cap on visited
 * nodes; returns null when capped or unsolvable.
 */
export function findSolution(
  state: BoardState,
  cfg: SimConfig = DEFAULT_SIM,
  nodeCap: number = TUNING.SOLVER_NODE_CAP,
): string[] | null {
  const ctx = { visited: 0, capped: false }
  const dead = new Set<string>()

  const dfs = (s: BoardState): string[] | null => {
    if (s.stars.length === 0) return []
    if (ctx.capped) return null
    if (++ctx.visited > nodeCap) {
      ctx.capped = true
      return null
    }
    const key = s.stars
      .map((st) => st.id)
      .sort()
      .join('|')
    if (dead.has(key)) return null

    const ordered = s.stars
      .map((st) => ({ st, blockers: countBlockers(s, st, cfg) }))
      .sort((a, b) => a.blockers - b.blockers)

    for (const { st, blockers } of ordered) {
      if (blockers > 0) break // sorted ascending: nothing legal remains
      const rest = dfs(applyShot(s, st.id, cfg))
      if (rest) return [st.id, ...rest]
      if (ctx.capped) return null
    }

    dead.add(key)
    return null
  }

  const solution = dfs(state)
  return ctx.capped ? null : solution
}
