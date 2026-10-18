# Sagitta — Master Build Plan (greybox prototype)

3D port of Arrows: stars with direction vectors, tap to launch, shots can't hit
anything, fired stars leave persistent trails, a cleared level is a drawn
constellation. Codename **Sagitta** — the Arrow constellation. Greybox goal: one
evening of Fable time, one dense test level, playable in the browser.

## Locked decisions
- **Stack:** Vite 8 + React 19 + TypeScript 5 + three (latest r-release at
  scaffold; record exact versions in the Sprint 0 report — these are the locked
  versions thereafter). Plain three.js mounted in a single React host component;
  **no react-three-fiber, no drei** — the sim is pure math in `lib/`, three is
  render-only, R3F would blur that seam for zero gain at this scope.
- **No Supabase, no backend, no persistence this phase.** Levels are static JSON.
  Progress/sharing is a seam only — do not implement.
- **Dev port 5175** (5173/5174/5178 are claimed by other repos).
- **Trails are obstacles.** A fired star's trail persists as a segment obstacle
  for the rest of the level. This is the design thesis, not a tunable.
- **No fail state.** An invalid shot animates to the collision point, flashes,
  and returns home. Infinite retries. Puzzle, not action.
- **Styling:** hand-written CSS, one `src/theme.css` token file. No Tailwind,
  no component libraries. Greybox palette: near-black space, white/grey stars,
  one accent for trails. Fonts: IBM Plex Mono for HUD.
- Deployment target eventually Vercel SPA (`vercel.json` catch-all), but **local
  dev only this phase** — commit the vercel.json seam, don't deploy.

## How to run this plan
Save the Standing Brief below as `BUILD_BRIEF.md` in the repo root
(`E:\git\sagitta`). Then paste each sprint block into Claude Code in order.
Reports go to `docs/reports/sprint-N.md` with the standard shape: What shipped /
What you need to do once / What's deferred / Verification. Commits map 1:1 to
sprints: `Sprint 1: renderer + tap-to-fire`.

---

# STANDING BRIEF (save as BUILD_BRIEF.md)

# BUILD_BRIEF.md — Sagitta (3D Arrows greybox)

## Stack & environment
Windows 11, repo at `E:\git\sagitta`. Vite 8 + React 19 + TS 5 + three
(pin exact versions at scaffold and record them here). Dev server port **5175**
(`server.port` in vite.config.ts, `strictPort: true`). npm, not pnpm/yarn.
No other services, no env vars needed this phase — still commit an
`.env.example` containing only a comment saying so.

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

---

# PHASE 1 — GREYBOX

## Sprint 0 — Scaffold + sim core (no rendering)
### RECON
Read BUILD_BRIEF.md in full. Check nothing exists at E:\git\sagitta.
### BUILD
Scaffold Vite 8 + React 19 + TS, port 5175 strictPort. Create the repo
skeleton (pages/, components/, lib/, config/, levels/, docs/reports/).
Implement `lib/vec.ts` (minimal Vec3 ops on number[3] — do not import three),
`lib/sim.ts`, `lib/level.ts` with sanitizer, `lib/solver.ts`,
`config/tuning.ts` with every default named in the brief. Add Vitest; write
tests for the two swept-collision functions (known-geometry cases: grazing
hit, clean miss, contained start) and for `evaluateShot` ordering on a
hand-built 3-star line. Record pinned versions in the sprint report AND
back into BUILD_BRIEF.md.
### VERIFY (do this, don't skip)
`npm test` green. `npx tsc --noEmit` clean. Confirm lib/ has zero non-lib
imports (`grep -r "from 'react'\|from 'three'" src/lib` returns nothing).

## Sprint 1 — Renderer + tap-to-fire
### RECON
Read BUILD_BRIEF.md and the Sprint 0 report. Read lib/sim.ts signatures —
do not modify lib/ this sprint except bug fixes (flag any).
### BUILD
`components/SceneHost.tsx`: three renderer, OrbitControls
(three/examples/jsm), fog, starfield backdrop (static Points), bounds
rendered as a faint wireframe sphere. Render stars as spheres + heading
spikes. Raycaster picking; tap/orbit disambiguation per brief. On tap:
`evaluateShot` → animate legal shots to exit (ease-out, then leave a trail
line), illegal shots to hitT with red flash and return. Trails render as
`TRAIL_R`-thick tubes in the accent token color. Win state: HUD overlay
"Constellation complete", controls keep orbiting. HUD (React, theme.css):
level name, stars remaining, reset button. Hardcode-load `levels/001.json`
— author it by hand: 5 stars, solvable in exactly one order, one decoy
ordering that fails on a trail collision (prove trails matter).
### VERIFY (do this, don't skip)
Play 001 to completion in the browser. Fire out of order and confirm the
trail block triggers. Orbit while a shot animates — no picking misfires.
Resize window — canvas tracks. Report FPS eyeballed on the dev machine.

## Sprint 2 — Generator + dense test level + juice pass
### RECON
Read prior reports. Read lib/solver.ts.
### BUILD
`scripts/generate-level.mjs` (plain Node, imports lib/ directly — this is
the seam paying off): place N stars with random unit dirs, min pairwise
spacing 3·STAR_R, reject boards where `findSolution` returns null,
retry up to 500 boards, write `levels/NNN.json` with the solution order
in a `"_solution"` field (loader must ignore underscore keys). Generate
`levels/002.json` with N=16 (the dense cluster test). Juice, cheap only:
shot trail draws progressively behind the moving star; small camera-shake
token on illegal hits; stars idle with a subtle pulse. Add level picker
(config-driven list in `config/levels.ts` — no per-level branching in
components).
### VERIFY (do this, don't skip)
Generate 5 boards at N=16; all must be solvable per solver and at least
one must be humanly completable by following `_solution` in the browser.
Confirm generator rejects and retries (log rejected count). Re-run
`npm test` + tsc. Write the sprint report and STOP — playtest gate before
any Phase 2.

# PHASE 2 — (gated, do not start)
⚠️ GATE A: husband playtest on 001/002 before designing difficulty curve,
level count, mobile touch targets, or any persistence. Capture: did he
orbit instinctively, did trails read as obstacles without being told, and
did any shot feel unfairly unreadable (depth-cue failure).
