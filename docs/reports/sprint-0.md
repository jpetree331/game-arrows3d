# Sprint 0 — Scaffold + sim core (no rendering)

## What shipped
- Vite react-ts scaffold at `E:\git\sagitta`, dev port 5175 strictPort, npm.
- **Pinned versions:** vite 8.1.5, react 19.2.7, react-dom 19.2.7,
  three 0.185.1, typescript 7.0.2, vitest 4.1.10, @types/three 0.185.1,
  @vitejs/plugin-react 6.0.3, Node 22.18.0, npm 11.9.0. Recorded in
  BUILD_BRIEF.md.
- Repo skeleton: `src/pages`, `src/components`, `src/lib`, `src/config`,
  `src/levels`, `docs/reports`, `scripts`. Plus `.env.example` (comment only),
  `vercel.json` (SPA catch-all seam, not deployed).
- `lib/vec.ts` — Vec3 ops on plain number[3]; no three import.
- `lib/sim.ts` — `sweptSphereVsSphere`, `sweptSphereVsCapsule` (cylinder-body
  + cap-sphere exact tests), `boundsExit`, `evaluateShot`, `applyShot`
  (immutable; illegal shots return the same state reference).
- `lib/level.ts` — `sanitizeLevel` (clamps positions to 0.8·BOUNDS_R,
  renormalizes dirs, drops malformed stars, dedupes ids, never throws) +
  `toBoard`.
- `lib/solver.ts` — `findSolution` DFS, fewest-blockers-first ordering,
  200k node cap, memo on remaining-star set (trail geometry is a pure
  function of the fired set, so the memo is sound).
- `lib/id.ts` — `makeId` with non-secure-context fallback.
- `config/tuning.ts` — every default from the brief plus animation/camera/
  color tokens.
- 29 Vitest tests: swept-sphere (head-on known-t, exact grazing, near miss,
  contained start, behind, stationary), swept-capsule (body known-t, cap
  sphere known-t, past-the-end miss, parallel travel both ways, contained,
  degenerate), evaluateShot ordering on the 3-star line, trail crossing,
  immutability, sanitizer, solver.

## Divergences / decisions (autonomy clause)
- **TypeScript 7.0.2, not TS 5.** Jess overrode the brief's locked TS 5
  mid-scaffold ("newest is best") — this is the Go-native tsc; `--noEmit`
  verified working against the whole project. BUILD_BRIEF.md updated.
- **Rules discovery — exact collinearity:** on a perfectly collinear
  star line, the leader's trail lies along the followers' paths, so even
  back-to-front order is unsolvable — trails are obstacles, forever, per the
  design thesis. This is now an explicit test (sim + solver). Order-dependent
  puzzles live in the 0.41–0.7 annulus: a star center 0.41–0.7 world units
  off another's path blocks as a star but not (later) as a trail, provided
  its own dir carries the trail away. Level 001 must be authored with this
  geometry; exact collinear decoys are permanently dead shots.
- `evaluateShot` on an unknown id returns `{legal:false, hitT:0}` instead of
  throwing (defensive; renderer only passes picked ids anyway).
- Remote set to https://github.com/jpetree331/game-arrows-3d.git per Jess.

## What you need to do once
Nothing — no env vars, no services.

## What's deferred
Rendering (Sprint 1), generator + juice (Sprint 2), everything Phase 2.

## Verification
- `npm test` → 3 files, 29 tests, all green.
- `npx tsc --noEmit` → exit 0.
- lib purity: grep for react/three imports in `src/lib` → 0 matches.
