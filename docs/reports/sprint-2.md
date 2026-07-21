# Sprint 2 — Generator + dense test level + juice pass

## What shipped
- `scripts/generate-level.mjs` — plain Node importing `src/lib` and
  `src/config` directly via Node 22 type stripping
  (`npm run gen -- <NNN> <N> [seed]`). Seeded mulberry32 PRNG so any board
  is reproducible from its logged seed. Places N stars uniformly in
  0.8·BOUNDS_R with min pairwise spacing 3·STAR_R (≤200 placement tries per
  star), random unit dirs, rejects boards `findSolution` can't solve, up to
  500 boards. Writes `_solution` plus a `_meta` block (seed, boards tried,
  rejected, timestamp) — loader ignores underscore keys by construction.
  `npm run gen -- verify <N> [seed]` runs 5 generations, stats only.
- `levels/002.json` — "Cluster 002", N=16, seed 20260720 (boards tried 3,
  rejected 2, both logged).
- Juice (cheap only):
  - Shot trail draws progressively — the forward edge rides under the
    flying star while the backward half of the chord extends in step, so
    the full line lands exactly when the star exits.
  - Camera shake on illegal hits (SHAKE_AMP/SHAKE_MS tokens), applied
    additively after `controls.update()` so OrbitControls and shake coexist.
  - Idle pulse: stars breathe at PULSE_HZ/PULSE_AMP with per-star phase
    offsets.
- Level picker: `config/levels.ts` id list + `import.meta.glob` over
  `levels/*.json` in Game.tsx — config-driven, zero per-level branching in
  components. HUD select shows `id · name`.
- Dev-only console bridge `window.__sagitta` ({fire, remaining, busy},
  DEV builds only, removed on unmount) — used for scripted playtesting.

## Divergences / decisions
- lib imports now carry explicit `.ts` extensions (Node type stripping
  requires them; Vite/tsc already allowed them). This is what lets the
  generator import the sim with zero build step — the seam paying off as
  designed.
- Generator observation: at N=16, random boards are solvable more often
  than expected (1–3 tries) and solutions come out mostly in placement
  order — random dense boards are loosely constrained. Real difficulty
  (deliberate chains, decoys) is authored, not sampled; that's Phase 2
  design territory, gated on the playtest.
- `_meta` block added to generated levels beyond the brief's `_solution`
  (underscore rule already covers it).

## What you need to do once
Nothing new. Dev server: `npm run dev` → http://localhost:5175 (left
running after this session).

## What's deferred
Everything Phase 2, per the gate. The brief's open question list for the
playtest stands: does orbiting come instinctively, do trails read as
obstacles untold, do any shots feel depth-unreadable.

## Verification
- `npm run gen -- verify 16 1001`: 5/5 boards solvable, per-board
  tried/rejected counts logged (rejection path exercised: 1–3 tries each).
- Played 002 in the browser following `_solution` via the dev bridge:
  all 16 shots legal in order, "stars 0", win overlay shown. Progressive
  trail drawing observed mid-flight (screenshot in session log).
- Level picker switches 001 ↔ 002; reset works per level.
- `npm test` 33 green; `npx tsc --noEmit` clean; lib purity grep still 0.
- STOPPED here per the brief: ⚠️ GATE A (husband playtest) before any
  Phase 2 work.
