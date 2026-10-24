import { z } from 'zod';
import { BASIC_BUTTONS } from './buttons.js';
import type { Button } from './buttons.js';
import type { GameEvent, Hop, LevelState, Press } from './types.js';
import type { Results } from './results.js';

export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const roomCodeSchema = z
  .string()
  .regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
export const nicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[\p{L}\p{M}\p{N} _.-]+$/u);
export const skinSchema = z.enum(['spud']);
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('join'),
    code: roomCodeSchema,
    nickname: nicknameSchema,
    skin: skinSchema.default('spud'),
    reconnectToken: z.string().uuid().optional(),
  }),
  z.strictObject({
    type: z.literal('press'),
    button: z.enum(BASIC_BUTTONS),
    seq: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  }),
  z.strictObject({ type: z.literal('ready'), ready: z.boolean() }),
  z.strictObject({
    type: z.literal('host'),
    action: z.enum(['start', 'next', 'pickLevel', 'kick', 'lock']),
    levelId: z.string().max(8).optional(),
    playerId: z.string().max(64).optional(),
    locked: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal('ping'),
    timestamp: z.number().finite().min(0),
  }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type JoinMessage = Extract<ClientMessage, { type: 'join' }>;
export type HostMessage = Extract<ClientMessage, { type: 'host' }>;
export interface PlayerView {
  id: string;
  nickname: string;
  skin: 'spud';
  color: number;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
  reconnectUntil: number | null;
  buttons: Button[];
}
export interface RoomView {
  code: string;
  players: PlayerView[];
  hostId: string | null;
  mode: 'campaign';
  selectedLevel: string;
  locked: boolean;
  phase: 'lobby' | 'playing' | 'results';
  results: LevelResults | null;
  notice: string | null;
}
export type LevelResults = Results & {
  players: { id: string; nickname: string; color: number }[];
};
export interface SpudView {
  position: LevelState['position'];
  facing: LevelState['facing'];
  status: LevelState['status'];
  time: number;
  hop: Hop | null;
  keys: number;
  collectedKeys: string[];
  unlockedDoors: string[];
  toggledDevices: string[];
  goldenChip: boolean;
  checkpoint: LevelState['position'];
  deaths: number;
  respawnAt: number | null;
}
export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      reconnectToken: string;
      nextSeq: number;
      room: RoomView;
      serverTime: number;
    }
  | { type: 'room'; room: RoomView }
  | {
      type: 'levelStart';
      levelId: string;
      seed: number;
      startTime: number;
      assignments: Record<string, Button[]>;
      groupFactor: number;
    }
  | {
      type: 'spud';
      state: SpudView;
      serverTime: number;
      whoPressed: Press | null;
    }
  | { type: 'event'; event: GameEvent; serverTime: number }
  | { type: 'results'; results: LevelResults; serverTime: number }
  | { type: 'pong'; timestamp: number; serverTime: number }
  | { type: 'error'; code: string; message: string };

export function spudView(state: LevelState): SpudView {
  return {
    position: state.position,
    facing: state.facing,
    status: state.status,
    time: state.time,
    hop: state.hop,
    keys: state.keys,
    collectedKeys: state.collectedKeys,
    unlockedDoors: state.unlockedDoors,
    toggledDevices: state.toggledDevices,
    goldenChip: state.goldenChip,
    checkpoint: state.checkpoint.position,
    deaths: state.deaths,
    respawnAt: state.respawnAt,
  };
}
