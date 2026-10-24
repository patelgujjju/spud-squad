import { describe, expect, it } from 'vitest';
import { clientMessageSchema, spudView } from '../protocol.js';
import { releaseButtons } from '../releaseButtons.js';
import { initial, press, shipped } from './helpers.js';

describe('wire protocol', () => {
  it('accepts each supported message and supplies the placeholder skin', () => {
    const join = clientMessageSchema.parse({
      type: 'join',
      code: 'ABCDE',
      nickname: ' Mash ',
    });
    expect(join).toMatchObject({ nickname: 'Mash', skin: 'spud' });
    for (const message of [
      { type: 'press', button: 'RIGHT', seq: 1 },
      { type: 'ready', ready: true },
      { type: 'host', action: 'start' },
      { type: 'ping', timestamp: 123 },
    ])
      expect(clientMessageSchema.safeParse(message).success).toBe(true);
  });
  it.each([
    { type: 'press', button: 'RIGHT', seq: -1 },
    { type: 'press', button: 'JUMP', seq: 0 },
    { type: 'press', button: 'RIGHT', seq: 0, position: [2, 1] },
    { type: 'join', code: '00000', nickname: 'Mash' },
    { type: 'join', code: 'ABCDE', nickname: '<script>' },
    { type: 'join', code: 'ABCDE', nickname: 'Mash', reconnectToken: 'forged' },
    { type: 'ping', timestamp: Infinity },
    { type: 'ready', ready: 'yes' },
    { type: 'host', action: 'teleport' },
    { type: 'chat', text: 'hello' },
  ])('rejects malformed or unsupported messages %j', (message) => {
    expect(clientMessageSchema.safeParse(message).success).toBe(false);
  });
  it('only exposes the public simulation snapshot', () => {
    const state = initial(shipped('1-1'));
    expect(spudView(state)).toMatchObject({
      position: [1, 1],
      status: 'playing',
      checkpoint: [1, 1],
    });
    expect(spudView(state)).not.toHaveProperty('stats');
    expect(spudView(state)).not.toHaveProperty('buffer');
  });
});
describe('departed owners', () => {
  it('gives orphaned buttons to the least-loaded available survivors', () => {
    const before = initial(shipped('1-1'), ['a', 'b', 'c']);
    const removed = before.playerIds.find((id) =>
      before.assignments[id]!.includes('LEFT'),
    )!;
    const survivors = before.playerIds.filter((id) => id !== removed);
    const lightest = survivors.find(
      (id) => before.assignments[id]!.length === 1,
    )!;
    const after = releaseButtons(before, removed, survivors);
    expect(after.assignments[lightest]).toContain('LEFT');
    expect(survivors.map((id) => after.assignments[id]!.length).sort()).toEqual(
      [2, 3],
    );
    for (const id of survivors)
      expect(after.assignments[id]).toEqual(
        expect.arrayContaining(before.assignments[id]!),
      );
  });
  it('releases buttons to the survivor without changing stats or the original state', () => {
    const before = initial(shipped('1-1'), ['a', 'b']);
    const after = releaseButtons(before, 'a', ['b']);
    expect(after.assignments.a).toBeUndefined();
    expect(after.assignments.b).toHaveLength(5);
    expect(before.assignments.a).toBeDefined();
    expect(after.stats).toEqual(before.stats);
  });
  it('retains other jobs, avoids duplicate shared buttons and tolerates no survivors', () => {
    const before = initial(
      shipped('1-1'),
      Array.from({ length: 10 }, (_, i) => `p${i}`),
    );
    const removed = before.playerIds[0]!;
    const after = releaseButtons(before, removed, before.playerIds.slice(1));
    expect(Object.values(after.assignments).flat()).toHaveLength(9);
    expect(
      releaseButtons(initial(shipped('1-1')), 'a', []).assignments,
    ).toEqual({});
    expect(
      releaseButtons(before, 'unknown', before.playerIds).assignments,
    ).toEqual(before.assignments);
  });
  it('clears a departed player’s buffered input', () => {
    let state = press(initial(shipped('1-1')), 'RIGHT').state;
    state = press(state, 'RIGHT', 20).state;
    expect(state.buffer).not.toBeNull();
    expect(releaseButtons(state, 'a', []).buffer).toBeNull();
  });
});
