// All gameplay/render tunables live here — no magic numbers in components.
// Framework-free: safe to import from lib/, scripts/, and components alike.

export const TUNING = {
  // --- core geometry ---
  BOUNDS_R: 10, // play space: sphere of this radius centered at origin
  STAR_R: 0.35,
  TRAIL_R: 0.06,
  LEVEL_POS_FRACTION: 0.8, // star positions live within this fraction of BOUNDS_R

  // --- solver / generator ---
  SOLVER_NODE_CAP: 200_000,
  GEN_MIN_SPACING_FACTOR: 3, // min pairwise star spacing, × STAR_R
  GEN_MAX_BOARDS: 500, // reject-and-retry cap per generated level

  // --- interaction ---
  TAP_MAX_PX: 6, // pointer is a tap iff moved less than this…
  TAP_MAX_MS: 300, // …and released within this

  // --- animation ---
  FRAME_DT_MAX: 0.25, // clamp per-frame delta so throttled background tabs jump, not crawl
  SHOT_SPEED: 14, // world units / second, legal shot travel
  RETURN_SPEED: 22, // world units / second, illegal shot flying home
  FLASH_MS: 280, // red flash duration on illegal hit
  SHAKE_AMP: 0.12, // camera shake amplitude (world units) on illegal hit
  SHAKE_MS: 200,
  PULSE_AMP: 0.05, // idle star scale pulse amplitude (fraction)
  PULSE_HZ: 0.5,

  // --- camera ---
  CAMERA_FOV: 55,
  CAMERA_MIN_DIST: 4,
  CAMERA_MAX_DIST: 45,
  CAMERA_START_DIST: 24,

  // --- render depth cues ---
  FOG_NEAR: 18,
  FOG_FAR: 70,
  SPIKE_LEN_FACTOR: 3, // heading spike length, × STAR_R
  STARFIELD_COUNT: 900,
  STARFIELD_R: 60,

  // --- greybox palette, by token name ---
  COLORS: {
    space: '#05060a',
    star: '#e9eaf0',
    starDim: '#9aa1ae',
    spike: '#cdd2dc',
    trail: '#7cd7ff', // the one accent
    flash: '#ff5252',
    bounds: '#262c38',
    fog: '#05060a',
    backdrop: '#8b93a5',
  },
} as const

export type Tuning = typeof TUNING
