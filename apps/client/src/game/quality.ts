import type { QualityMode } from './three/performance.js';
export type { QualityMode } from './three/performance.js';
const key = 'spud.graphics-quality';
let current: QualityMode = 'auto';
try {
  const saved = localStorage.getItem(key);
  if (saved === 'high' || saved === 'low') current = saved;
} catch {
  /* optional */
}
export function getQuality(): QualityMode {
  return current;
}
export function setQuality(mode: QualityMode): void {
  current = mode;
  try {
    localStorage.setItem(key, mode);
  } catch {
    /* optional */
  }
  window.dispatchEvent(
    new CustomEvent('spud-quality-change', { detail: mode }),
  );
}
