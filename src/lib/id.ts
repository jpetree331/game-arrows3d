// lib/id.ts — framework-free: no React, no three, no DOM imports.

/**
 * Prefixed unique id with a fallback for non-secure contexts
 * (crypto.randomUUID is unavailable on plain-HTTP LAN).
 */
export function makeId(prefix: string): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return `${prefix}-${c.randomUUID()}`
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
