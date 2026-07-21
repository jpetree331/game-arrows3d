# Sprint 1 — Renderer + tap-to-fire

## What shipped
- `components/SceneHost.tsx`: plain three.js host (no R3F). Renderer,
  PerspectiveCamera, OrbitControls (damped, pan disabled, zoom clamped to
  tuning), fog, static Points starfield backdrop (fog-exempt so it stays
  crisp), bounds as faint wireframe sphere, ambient + directional light.
- Stars: shared sphere geometry + heading spike (thin cone, 3·STAR_R,
  oriented by quaternion from +Y to dir). Per-star materials for flash.
- Picking: raycaster on tap; tap vs orbit disambiguation per brief
  (max pointer movement < 6 px tracked across pointermove, duration
  < 300 ms). Taps during a shot animation are ignored (busy guard);
  orbiting stays live throughout.
- Fire flow: `evaluateShot` from lib decides everything. Legal → ease-out
  flight to the bounds exit, star removed, trail tube added, `applyShot`
  commits, HUD count updates. Illegal → flight to hitT, red flash
  (FLASH_MS), ease-out return home, board unchanged.
- Trails render as TRAIL_R tubes in the accent token color.
- HUD (React + theme.css, IBM Plex Mono): level name, stars remaining,
  Reset (remounts SceneHost for a fresh board). Win overlay
  "Constellation complete", orbit stays free underneath.
- `pages/Game.tsx`, slimmed `App.tsx`, `theme.css` token file,
  `levels/001.json` ("First Light") hand-authored: 5 stars, exactly one
  clearing order (E→D→C→B→A), decoy B legal from the start but firing it
  before C dooms C on a trail collision.
- `levels/001.test.ts`: brute force over all 120 firing orders proves
  "solvable in exactly one order" and that the decoy fails with
  `hitKind: 'trail'`. Permanent regression test.

## Divergences / decisions (flagged per the divergence rules)
- **RULE AMENDMENT — trails are full chords.** The brief's pos→exit trail
  is provably symmetric: if star Q's path passes within STAR_R+TRAIL_R of
  star P's path (identical segments both ways), each one's trail blocks the
  other, so no clearable board can ever produce a trail collision — the
  design thesis would be vacuous, and the brief's own Sprint 1 VERIFY
  ("confirm the trail block triggers") and the 001 decoy spec would be
  unsatisfiable. Minimal fix that restores asymmetry: a fired star's trail
  is its full line-chord through the bounds sphere (backward extension
  included). Your shot may cross the part of a line *behind* another star —
  creating genuine one-way "C before B" constraints. Implemented in
  `trailForStar` (sim.ts) with the reasoning in a comment; visually the
  cleared level reads as great-chords, which looks better than stubs.
  Revert = one function if the design should go another way, but the strict
  rule makes trails decoration, not obstacles.
- `evaluateShot` gained optional `hitKind: 'star' | 'trail'` (test +
  future juice hook; superset of the brief's signature).
- Canvas sizing is re-checked every frame instead of trusting
  ResizeObserver: the Claude browser pane never fires RO callbacks and the
  mount-time size can be 0 before CSS applies. RO removed entirely.
- Hidden-tab heartbeat: a 500 ms setInterval advances the frame when
  `document.hidden`, so in-flight shots resolve instead of freezing when
  the tab is backgrounded. `FRAME_DT_MAX` (0.25 s) clamps per-frame delta
  so throttled tabs jump rather than crawl.
- THREE.Clock deprecated in r185 → THREE.Timer.
- `resolveJsonModule` added to tsconfig.app.json for level JSON imports.
- Google Fonts link for IBM Plex Mono in index.html (monospace fallback in
  the token). Fine for local dev; self-host if it ever ships.

## Verification (done in a live browser, Chrome via MCP)
- Played 001 to completion in order E,D,C,B,A → "stars 0", win overlay
  shown, five-chord constellation rendered. Screenshots taken throughout.
- Decoy: fired B first (legal), then tapped C → C flew to B's trail,
  flashed red, returned home, board unchanged. Trails matter, on screen.
- Taps during shot animation are ignored (observed); orbit drag after win
  rotates the constellation with overlay intact.
- Resize: viewport changed size twice mid-session; canvas tracked both
  times (per-frame size check).
- FPS: not honestly measurable this session — the tab was throttled to
  ~1 frame/several seconds because the window was occluded (that throttling
  is what motivated the heartbeat + dt-clamp work). Scene is ~40 draw
  calls / <60k tris; 60 fps on the dev machine is not in doubt, but eyeball
  it when playing for real.
- `npm test` 33 green, `npx tsc --noEmit` clean.
