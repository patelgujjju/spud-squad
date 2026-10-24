import { assignButtons } from './assignments.js';
import { samePoint } from './buttons.js';
import type { BasicButton, Button } from './buttons.js';
import { groupFactor, slicerAt } from './hazards.js';
import { loadLevel } from './levelLoader.js';
import type { Level } from './levelSchema.js';
import {
  beginHop,
  beltDirection,
  checkHazard,
  CONVEYOR_MS,
  deviceEnabled,
  grab,
  tileAt,
  touchTile,
} from './interactions.js';
import type { GameEvent, LevelState, Press, Transition } from './types.js';

function assertTime(t: number): void {
  if (
    !Number.isSafeInteger(t) ||
    t < 0 ||
    t > Number.MAX_SAFE_INTEGER - 1_000_000
  ) {
    throw new Error('Time must be a nonnegative safe integer in milliseconds');
  }
}

export function createLevelState(
  level: Level,
  seed: number,
  playerIds: readonly string[],
): LevelState {
  const parsed = loadLevel(level);
  const assignments = assignButtons(playerIds, seed, parsed.buttons);
  return {
    level: parsed,
    seed,
    playerIds: [...playerIds],
    assignments,
    time: 0,
    factor: groupFactor(playerIds.length),
    status: 'playing',
    position: parsed.start,
    facing: 'RIGHT',
    hop: null,
    buffer: null,
    keys: 0,
    collectedKeys: [],
    unlockedDoors: [],
    toggledDevices: [],
    checkpoint: { position: parsed.start, facing: 'RIGHT', toggledDevices: [] },
    conveyorAt: null,
    respawnAt: null,
    goldenChip: false,
    deaths: 0,
    finishedAt: null,
    lastPress: null,
    heroId: null,
    dedupTick: -1,
    tickButtons: [],
    stats: Object.fromEntries(
      playerIds.map((id) => [id, { presses: 0, deathsCaused: 0 }]),
    ),
  };
}

function copyState(state: LevelState): LevelState {
  return {
    ...state,
    playerIds: [...state.playerIds],
    assignments: Object.fromEntries(
      Object.entries(state.assignments).map(([id, buttons]) => [
        id,
        [...buttons],
      ]),
    ),
    position: [...state.position],
    hop: state.hop ? { ...state.hop } : null,
    buffer: state.buffer ? { ...state.buffer } : null,
    collectedKeys: [...state.collectedKeys],
    unlockedDoors: [...state.unlockedDoors],
    toggledDevices: [...state.toggledDevices],
    checkpoint: {
      ...state.checkpoint,
      toggledDevices: [...state.checkpoint.toggledDevices],
    },
    lastPress: state.lastPress ? { ...state.lastPress } : null,
    tickButtons: state.tickButtons.map((press) => ({ ...press })),
    stats: Object.fromEntries(
      Object.entries(state.stats).map(([id, stats]) => [id, { ...stats }]),
    ),
  };
}

function execute(state: LevelState, press: Press, events: GameEvent[]): void {
  const button = press.button as BasicButton;
  if (button === 'GRAB') grab(state, events);
  else beginHop(state, button, press.playerId, 'press', events);
}

/** Process coincident deadlines: land, hazard, buffered input, then belt. */
function processTime(state: LevelState, events: GameEvent[]): void {
  if (state.status === 'dead' && state.respawnAt === state.time) {
    state.status = 'playing';
    state.position = state.checkpoint.position;
    state.facing = state.checkpoint.facing;
    state.toggledDevices = [...state.checkpoint.toggledDevices];
    state.respawnAt = null;
    state.lastPress = null;
    events.push({ type: 'respawn', t: state.time, at: state.position });
  }
  if (state.status !== 'playing') return;
  if (state.hop?.endT === state.time) {
    const hop = state.hop;
    state.position = hop.to;
    state.hop = null;
    touchTile(state, events);
    if (tileAt(state, state.position) === 'E') {
      state.status = 'finished';
      state.finishedAt = state.time;
      state.heroId = hop.playerId ?? state.lastPress?.playerId ?? null;
      state.buffer = null;
      state.conveyorAt = null;
      events.push({ type: 'finish', t: state.time, playerId: state.heroId });
      return;
    }
  }
  checkHazard(state, events);
  if (state.status !== 'playing') return;
  if (!state.hop && state.buffer) {
    const buffered = state.buffer;
    state.buffer = null;
    execute(state, buffered, events);
    checkHazard(state, events);
    if (state.status !== 'playing') return;
  }
  if (state.conveyorAt === state.time) {
    const direction = beltDirection(state);
    state.conveyorAt = direction ? state.time + CONVEYOR_MS : null;
    if (direction && !state.hop)
      beginHop(state, direction, null, 'conveyor', events);
  }
}

function nextDeadline(state: LevelState): number {
  if (state.status === 'dead') return state.respawnAt!;
  if (state.status === 'finished') return Infinity;
  let next = Math.min(
    state.hop?.endT ?? Infinity,
    state.conveyorAt ?? Infinity,
  );
  const slicer = state.level.objects.find(
    (object) =>
      object.type === 'slicer' && samePoint(object.at, state.position),
  );
  if (slicer?.type === 'slicer' && deviceEnabled(state, slicer.at)) {
    next = Math.min(
      next,
      slicerAt(slicer, state.time, state.factor).nextChangeT,
    );
  }
  return next;
}

export function advance(input: LevelState, untilT: number): Transition {
  assertTime(untilT);
  if (untilT < input.time)
    throw new Error('Simulation time cannot move backwards');
  const state = copyState(input);
  const events: GameEvent[] = [];
  while (true) {
    const next = nextDeadline(state);
    if (next > untilT) break;
    state.time = next;
    processTime(state, events);
  }
  state.time = untilT;
  return { state, events };
}

export function applyPress(
  input: LevelState,
  playerId: string,
  button: Button,
  t: number,
): Transition {
  const result = advance(input, t);
  const { state, events } = result;
  if (
    state.status !== 'playing' ||
    !state.playerIds.includes(playerId) ||
    !state.assignments[playerId]?.includes(button) ||
    !state.level.buttons.includes(button as BasicButton)
  )
    return result;
  const tick = Math.floor(t / 100);
  if (state.dedupTick !== tick) {
    state.dedupTick = tick;
    state.tickButtons = [];
  }
  if (
    state.tickButtons.some(
      (press) => press.button === button && press.playerId !== playerId,
    )
  )
    return result;
  const press: Press = { playerId, button, t };
  state.tickButtons.push(press);
  state.stats[playerId]!.presses++;
  state.lastPress = press;
  const outcome = state.hop
    ? state.buffer
      ? 'dropped'
      : 'buffered'
    : 'executed';
  events.push({ type: 'press', t, playerId, button, outcome });
  if (outcome === 'buffered') state.buffer = press;
  else if (outcome === 'executed') {
    execute(state, press, events);
    checkHazard(state, events);
  }
  return result;
}
