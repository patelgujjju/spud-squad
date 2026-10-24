import { advance } from './engine.js';
import type { LevelState } from './types.js';

/** Preserve existing jobs; hand any orphaned buttons to the least-loaded survivor. */
export function releaseButtons(
  input: LevelState,
  playerId: string,
  remainingIds: readonly string[],
): LevelState {
  const state = advance(input, input.time).state;
  const released = state.assignments[playerId] ?? [];
  delete state.assignments[playerId];
  if (state.buffer?.playerId === playerId) state.buffer = null;
  const survivors = state.playerIds.filter(
    (id) => remainingIds.includes(id) && id !== playerId,
  );
  for (const button of released) {
    if (survivors.some((id) => state.assignments[id]?.includes(button)))
      continue;
    const receiver = [...survivors].sort(
      (a, b) =>
        (state.assignments[a]?.length ?? 0) -
        (state.assignments[b]?.length ?? 0),
    )[0];
    if (receiver) (state.assignments[receiver] ??= []).push(button);
  }
  return state;
}
