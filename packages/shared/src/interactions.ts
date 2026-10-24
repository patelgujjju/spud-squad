import { BELTS, DELTAS, pointKey, samePoint } from './buttons.js';
import type { Direction, Point } from './buttons.js';
import { slicerAt } from './hazards.js';
import type { GameEvent, LevelState } from './types.js';

export const HOP_MS = 150;
export const CONVEYOR_MS = 400;
export const RESPAWN_MS = 1500;
export const tileAt = (state: LevelState, [x, y]: Point): string =>
  state.level.map[y]?.[x] ?? '#';
export const deviceEnabled = (state: LevelState, at: Point): boolean =>
  !state.toggledDevices.includes(pointKey(at));
export const doorOpen = (state: LevelState, at: Point): boolean =>
  state.unlockedDoors.includes(pointKey(at)) !==
  state.toggledDevices.includes(pointKey(at));
export const beltDirection = (state: LevelState): Direction | undefined =>
  deviceEnabled(state, state.position)
    ? BELTS[tileAt(state, state.position)]
    : undefined;

export function beginHop(
  state: LevelState,
  direction: Direction,
  playerId: string | null,
  source: 'press' | 'conveyor',
  events: GameEvent[],
): void {
  const delta = DELTAS[direction];
  const to: Point = [
    state.position[0] + delta[0],
    state.position[1] + delta[1],
  ];
  const tile = tileAt(state, to);
  if (
    tile === '#' ||
    tile === 'L' ||
    (tile === 'D' && !doorOpen(state, to) && state.keys === 0)
  ) {
    events.push({ type: 'blocked', t: state.time, at: to });
    return;
  }
  if (tile === 'D' && !doorOpen(state, to)) {
    state.keys--;
    // A key opens the current door even if a lever previously inverted it.
    const key = pointKey(to);
    state.unlockedDoors = state.unlockedDoors.includes(key)
      ? state.unlockedDoors.filter((door) => door !== key)
      : [...state.unlockedDoors, key];
    events.push({ type: 'door', t: state.time, at: to });
  }
  state.facing = direction;
  state.hop = {
    from: state.position,
    to,
    direction,
    startT: state.time,
    endT: state.time + HOP_MS,
    source,
    playerId,
  };
  events.push({ type: 'hop', t: state.time, hop: state.hop });
}

export function grab(state: LevelState, events: GameEvent[]): void {
  const delta = DELTAS[state.facing];
  const faced: Point = [
    state.position[0] + delta[0],
    state.position[1] + delta[1],
  ];
  const lever = state.level.objects.find(
    (object) => object.type === 'lever' && samePoint(object.at, faced),
  );
  if (lever?.type !== 'lever') return;
  for (const at of [lever.at, ...lever.toggles]) {
    const key = pointKey(at);
    state.toggledDevices = state.toggledDevices.includes(key)
      ? state.toggledDevices.filter((device) => device !== key)
      : [...state.toggledDevices, key];
  }
  // A newly enabled belt starts a new 400 ms residence interval.
  state.conveyorAt = beltDirection(state) ? state.time + CONVEYOR_MS : null;
  events.push({
    type: 'lever',
    t: state.time,
    at: faced,
    enabled: !deviceEnabled(state, faced),
  });
}

export function touchTile(state: LevelState, events: GameEvent[]): void {
  const key = pointKey(state.position);
  const tile = tileAt(state, state.position);
  if (tile === 'k' && !state.collectedKeys.includes(key)) {
    state.collectedKeys.push(key);
    state.keys++;
    events.push({ type: 'key', t: state.time, at: state.position });
  }
  if (
    !state.goldenChip &&
    (tile === 'G' ||
      (state.level.goldenChip &&
        samePoint(state.position, state.level.goldenChip)))
  ) {
    state.goldenChip = true;
    events.push({ type: 'goldenChip', t: state.time, at: state.position });
  }
  if (tile === 'C') {
    state.checkpoint = {
      position: state.position,
      facing: state.facing,
      toggledDevices: [...state.toggledDevices],
    };
    events.push({ type: 'checkpoint', t: state.time, at: state.position });
  }
  if (!beltDirection(state)) state.conveyorAt = null;
  else state.conveyorAt ??= state.time + CONVEYOR_MS;
}

export function checkHazard(state: LevelState, events: GameEvent[]): void {
  const slicer = state.level.objects.find(
    (object) =>
      object.type === 'slicer' && samePoint(object.at, state.position),
  );
  if (
    slicer?.type !== 'slicer' ||
    !slicerAt(slicer, state.time, state.factor, deviceEnabled(state, slicer.at))
      .active
  )
    return;
  state.status = 'dead';
  state.deaths++;
  const playerId = state.lastPress?.playerId ?? null;
  if (playerId) state.stats[playerId]!.deathsCaused++;
  state.respawnAt = state.time + RESPAWN_MS;
  state.hop = null;
  state.buffer = null;
  state.conveyorAt = null;
  events.push({ type: 'death', t: state.time, at: state.position, playerId });
}
