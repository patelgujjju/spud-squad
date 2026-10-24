import { readFileSync } from 'node:fs';
import { applyPress, advance, createLevelState } from '../engine.js';
import { loadLevel } from '../levelLoader.js';
import type { Button, Direction, Point } from '../buttons.js';
import type { Level } from '../levelSchema.js';
import type { LevelState, Transition } from '../types.js';

export function fixture(map: string[], options: Partial<Level> = {}): Level {
  return loadLevel({
    id: '1-1',
    name: 'Test room',
    world: 1,
    buttons: ['UP', 'DOWN', 'LEFT', 'RIGHT', 'GRAB'],
    map,
    start: [1, 1],
    objects: [],
    parSeconds: 10,
    darkness: false,
    ...options,
  });
}
export const shipped = (id: string): Level =>
  loadLevel(
    readFileSync(
      new URL(`../../../../levels/${id}.json`, import.meta.url),
      'utf8',
    ),
  );
export const owner = (state: LevelState, button: Button): string =>
  state.playerIds.find((id) => state.assignments[id]!.includes(button))!;
export const initial = (level: Level, players = ['a']): LevelState =>
  createLevelState(level, 42, players);
export function press(
  state: LevelState,
  button: Button,
  t = state.time,
): Transition {
  return applyPress(state, owner(state, button), button, t);
}
export function step(
  state: LevelState,
  button: Direction,
  t = state.time,
): LevelState {
  return advance(press(state, button, t).state, t + 150).state;
}
export function walk(state: LevelState, directions: Direction[]): LevelState {
  return directions.reduce(
    (current, direction) => step(current, direction),
    state,
  );
}
export const slicer = (at: Point, phaseMs = 0): Level['objects'][number] => ({
  type: 'slicer',
  at: [...at],
  onMs: 1200,
  offMs: 1800,
  phaseMs,
});
