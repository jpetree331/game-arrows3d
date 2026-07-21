# BUILD_BRIEF.md — Sagitta (3D Arrows greybox)

## Stack & environment
Windows 11, repo at `E:\git\sagitta`. Vite 8 + React 19 + TS + three.
**Pinned versions (recorded at Sprint 0 scaffold, 2026-07-20 — locked
thereafter):** vite 8.1.5, react 19.2.7, react-dom 19.2.7, three 0.185.1,
typescript 7.0.2 (Jess overrode the brief's TS 5 to newest — the Go-native
compiler; `tsc --noEmit` verified working), vitest 4.1.10, @types/three
0.185.1, @vitejs/plugin-react 6.0.3, Node 22.18.0, npm 11.9.0.
Dev server port **5175** (`server.port` in vite.config.ts, `strictPort: true`).
npm, not pnpm/yarn. No other services, no env vars needed this phase — an
`.env.example` containing only a comment says so.
Remote: https://github.com/jpetree331/game-arrows-3d.git

## The autonomy clause (applies to every sprint)
Work autonomously to completion. Do not stop to ask for confirmation on
reversible implementation choices — pick the sound default, note it in your
summary, and keep going. Never: change the locked stack, add dependencies
beyond three + vitest, or implement persistence/backend seams marked
"seam only."

## The Recon → Build → Verify contract
Every sprint runs RECON (read before writing), BUILD, VERIFY (do this, don't
skip), and reports divergences from the plan in the sprint report.

## Divergence rules (do NOT break these without flagging)
- **`src/lib/` is framework-free.** No React, no three, no DOM imports.
  All game math (collision, solvability, level data) lives there as pure
  functions on plain arrays/objects, unit-testable in Node. State this in
  every lib file header.
- **The renderer never decides game rules.** `SceneHost` asks `lib/sim.ts`
  "is this shot legal / where does it stop" and animates the answer. If you
  find rule logic creeping into the three layer, stop and move it.
- **All tunables live in `src/config/tuning.ts`** (radii, speeds, bounds,
  camera limits, colors-by-token-name). No magic numbers in components.

## Core rules (source of truth)
- Play space: sphere of radius `BOUNDS_R` (default 10) centered at origin.
- A **star** = `{ id, pos: Vec3, dir: Vec3 (unit) }`. Radius `STAR_R` (0.35).
- **Fire(star):** the star travels from `pos` along `dir`. The shot is **legal**
  iff the swept sphere (radius `STAR_R`) from `pos` to the bounds exit point
  touches no remaining star and no existing trail (trail = capsule of radius
  `TRAIL_R` = 0.06 around its segment).
- **Legal shot:** star is removed from the board; a trail segment is added from
  `pos` to the bounds exit point.
- **Illegal shot:** compute first collision t; star animates to that point,
  flashes red, animates home. Board state unchanged.
- **Win:** zero stars remain. The trails ARE the constellation; hold on it.
- Required pure functions in `lib/sim.ts`:
  `sweptSphereVsSphere(seg, r, center, R): t|null`,
  `sweptSphereVsCapsule(seg, r, capsule): t|null`,
  `evaluateShot(state, starId): { legal, hitT?, exitPoint }`,
  `applyShot(state, starId): State` (immutable).
- `lib/solver.ts`: `findSolution(state): id[] | null` — DFS with greedy
  ordering (try stars with fewest blockers first), hard cap on visited nodes
  (default 200k), return null on cap. Used by the level generator only —
  never at play time.

## Level format
`src/levels/NNN.json`: `{ "name": string, "stars": [{ "id", "pos": [x,y,z],
"dir": [x,y,z] }] }`. Positions within 0.8·BOUNDS_R; dirs normalized on load
by a defensive sanitizer (`sanitizeLevel` in `lib/level.ts` — clamp positions
into bounds, renormalize dirs, drop malformed stars; corrupt JSON must never
crash the app).

## Guardrails carried throughout
- Tap vs orbit disambiguation: pointer is a tap iff total movement
  < 6 px and duration < 300 ms; otherwise it belongs to OrbitControls.
- Every star renders with a heading spike (thin cone, length 3·STAR_R) —
  direction must be readable; add fog + size attenuation for depth cues.
- `makeId(prefix)` helper with non-secure-context fallback (crypto.randomUUID
  is unavailable on plain-HTTP LAN).
