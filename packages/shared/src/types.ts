import type { Button, Direction, Point } from './buttons.js';
import type { Level } from './levelSchema.js';

export interface Press {
  playerId: string;
  button: Button;
  t: number;
}
export interface Hop {
  from: Point;
  to: Point;
  direction: Direction;
  startT: number;
  endT: number;
  source: 'press' | 'conveyor';
  playerId: string | null;
}
export interface PlayerStats {
  presses: number;
  deathsCaused: number;
}
export interface Checkpoint {
  position: Point;
  facing: Direction;
  toggledDevices: string[];
}
export interface LevelState {
  level: Level;
  seed: number;
  playerIds: string[];
  assignments: Record<string, Button[]>;
  time: number;
  factor: number;
  status: 'playing' | 'dead' | 'finished';
  position: Point;
  facing: Direction;
  hop: Hop | null;
  buffer: Press | null;
  keys: number;
  collectedKeys: string[];
  unlockedDoors: string[];
  toggledDevices: string[];
  checkpoint: Checkpoint;
  conveyorAt: number | null;
  respawnAt: number | null;
  goldenChip: boolean;
  deaths: number;
  finishedAt: number | null;
  lastPress: Press | null;
  heroId: string | null;
  dedupTick: number;
  tickButtons: Press[];
  stats: Record<string, PlayerStats>;
}
export type GameEvent =
  | {
      type: 'press';
      t: number;
      playerId: string;
      button: Button;
      outcome: 'executed' | 'buffered' | 'dropped';
    }
  | { type: 'hop'; t: number; hop: Hop }
  | { type: 'blocked'; t: number; at: Point }
  | { type: 'checkpoint'; t: number; at: Point }
  | { type: 'key' | 'door' | 'goldenChip'; t: number; at: Point }
  | { type: 'lever'; t: number; at: Point; enabled: boolean }
  | { type: 'death'; t: number; at: Point; playerId: string | null }
  | { type: 'respawn'; t: number; at: Point }
  | { type: 'finish'; t: number; playerId: string | null };
export interface Transition {
  state: LevelState;
  events: GameEvent[];
}
