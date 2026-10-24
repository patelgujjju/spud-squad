import { z } from 'zod';
import { pointSchema } from './levelSchema.js';
import type { ServerMessage } from './protocol.js';

const time = z.number().finite().min(0);
const button = z.enum(['UP', 'DOWN', 'LEFT', 'RIGHT', 'GRAB', 'STOP', 'JUMP']);
const direction = z.enum(['UP', 'DOWN', 'LEFT', 'RIGHT']);
const assignments = z.record(z.string(), z.array(button));
const press = z.strictObject({ playerId: z.string(), button, t: time });
const hop = z.strictObject({
  from: pointSchema,
  to: pointSchema,
  direction,
  startT: time,
  endT: time,
  source: z.enum(['press', 'conveyor']),
  playerId: z.string().nullable(),
});
const results = z.strictObject({
  timeMs: time,
  deaths: z.int().min(0),
  stars: z.int().min(1).max(3),
  awards: z.strictObject({
    fryerFeeder: z.array(z.string()),
    heroPress: z.string().nullable(),
    buttonMasher: z.array(z.string()),
    asleepAtTheButton: z.array(z.string()),
    cleanHands: z.array(z.string()),
  }),
  players: z
    .array(
      z.strictObject({
        id: z.string(),
        nickname: z.string(),
        color: z.int().min(0).max(9),
      }),
    )
    .max(10),
});
const room = z.strictObject({
  code: z.string(),
  hostId: z.string().nullable(),
  mode: z.literal('campaign'),
  selectedLevel: z.string(),
  locked: z.boolean(),
  phase: z.enum(['lobby', 'playing', 'results']),
  results: results.nullable(),
  notice: z.string().nullable(),
  players: z
    .array(
      z.strictObject({
        id: z.string(),
        nickname: z.string(),
        skin: z.literal('spud'),
        color: z.int().min(0).max(9),
        ready: z.boolean(),
        connected: z.boolean(),
        joinedAt: time,
        reconnectUntil: time.nullable(),
        buttons: z.array(button),
      }),
    )
    .max(10),
});
const event = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('press'),
    t: time,
    playerId: z.string(),
    button,
    outcome: z.enum(['executed', 'buffered', 'dropped']),
  }),
  z.strictObject({ type: z.literal('hop'), t: time, hop }),
  z.strictObject({
    type: z.enum([
      'blocked',
      'checkpoint',
      'key',
      'door',
      'goldenChip',
      'respawn',
    ]),
    t: time,
    at: pointSchema,
  }),
  z.strictObject({
    type: z.literal('lever'),
    t: time,
    at: pointSchema,
    enabled: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('death'),
    t: time,
    at: pointSchema,
    playerId: z.string().nullable(),
  }),
  z.strictObject({
    type: z.literal('finish'),
    t: time,
    playerId: z.string().nullable(),
  }),
]);
export const serverMessageSchema: z.ZodType<ServerMessage> =
  z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('welcome'),
      playerId: z.string(),
      reconnectToken: z.string(),
      nextSeq: z.int().min(0),
      room,
      serverTime: time,
    }),
    z.strictObject({ type: z.literal('room'), room }),
    z.strictObject({
      type: z.literal('levelStart'),
      levelId: z.string(),
      seed: z.int(),
      startTime: time,
      assignments,
      groupFactor: z.number().positive(),
    }),
    z.strictObject({
      type: z.literal('spud'),
      serverTime: time,
      whoPressed: press.nullable(),
      state: z.strictObject({
        position: pointSchema,
        facing: direction,
        status: z.enum(['playing', 'dead', 'finished']),
        time,
        hop: hop.nullable(),
        keys: z.int().min(0),
        collectedKeys: z.array(z.string()),
        unlockedDoors: z.array(z.string()),
        toggledDevices: z.array(z.string()),
        goldenChip: z.boolean(),
        checkpoint: pointSchema,
        deaths: z.int().min(0),
        respawnAt: time.nullable(),
      }),
    }),
    z.strictObject({ type: z.literal('event'), event, serverTime: time }),
    z.strictObject({ type: z.literal('results'), results, serverTime: time }),
    z.strictObject({
      type: z.literal('pong'),
      timestamp: time,
      serverTime: time,
    }),
    z.strictObject({
      type: z.literal('error'),
      code: z.string(),
      message: z.string(),
    }),
  ]);
