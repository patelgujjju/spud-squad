import { describe, expect, it } from 'vitest';
import { serverMessageSchema } from '../serverMessageSchema.js';
import { spudView } from '../protocol.js';
import { initial, shipped } from './helpers.js';

describe('server wire validation', () => {
  it('accepts authoritative snapshots and clock replies', () => {
    const state = initial(shipped('1-1'));
    expect(
      serverMessageSchema.safeParse({
        type: 'spud',
        state: spudView(state),
        serverTime: 10,
        whoPressed: null,
      }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: 'pong',
        timestamp: 2,
        serverTime: 10,
      }).success,
    ).toBe(true);
  });
  it('rejects malformed state, unknown messages and extra fields', () => {
    const state = spudView(initial(shipped('1-1')));
    expect(
      serverMessageSchema.safeParse({
        type: 'spud',
        state: { ...state, position: 'forged' },
        serverTime: 1,
        whoPressed: null,
      }).success,
    ).toBe(false);
    expect(
      serverMessageSchema.safeParse({ type: 'teleport', at: [2, 1] }).success,
    ).toBe(false);
    expect(
      serverMessageSchema.safeParse({
        type: 'pong',
        timestamp: 0,
        serverTime: 1,
        script: 'bad',
      }).success,
    ).toBe(false);
  });
});
