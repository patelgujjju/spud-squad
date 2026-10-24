import type { Slicer } from './levelSchema.js';

export const SLICER_WARNING_MS = 400;
export function groupFactor(playerCount: number): number {
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 10)
    throw new Error('Expected 1–10 players');
  return playerCount <= 2
    ? 1
    : playerCount <= 4
      ? 1.15
      : playerCount <= 6
        ? 1.3
        : 1.4;
}

/** Times are elapsed milliseconds from level start. Phase offsets the cycle. */
export function slicerAt(
  slicer: Slicer,
  t: number,
  factor: number,
  enabled = true,
): {
  active: boolean;
  warning: boolean;
  nextChangeT: number;
} {
  const offMs = Math.round(slicer.offMs * factor);
  const period = slicer.onMs + offMs;
  const phase = (((t + slicer.phaseMs) % period) + period) % period;
  const active = enabled && phase < slicer.onMs;
  const warningStart = period - SLICER_WARNING_MS;
  const warning = enabled && phase >= warningStart;
  const nextPhase =
    phase < slicer.onMs
      ? slicer.onMs
      : phase < warningStart
        ? warningStart
        : period;
  return { active, warning, nextChangeT: t + nextPhase - phase };
}
