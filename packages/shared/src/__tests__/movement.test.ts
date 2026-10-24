import { describe, expect, it } from 'vitest';
import { applyPress, advance } from '../engine.js';
import { fixture, initial, owner, press, step } from './helpers.js';

const room = fixture(['#######', '#.....#', '#....E#', '#######']);

describe('movement and input timing', () => {
  it('hops one tile in exactly 150 ms and leaves input unchanged', () => {
    const before = initial(room);
    const snapshot = JSON.stringify(before);
    const moving = press(before, 'RIGHT').state;
    expect(moving.position).toEqual([1, 1]);
    expect(moving.hop).toMatchObject({
      from: [1, 1],
      to: [2, 1],
      startT: 0,
      endT: 150,
    });
    expect(advance(moving, 149).state.position).toEqual([1, 1]);
    expect(advance(moving, 150).state.position).toEqual([2, 1]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
  it('moves in all directions and updates facing after successful moves', () => {
    let state = initial(room);
    for (const button of ['RIGHT', 'DOWN', 'LEFT', 'UP'] as const) {
      state = step(state, button);
      expect(state.facing).toBe(button);
    }
    expect(state.position).toEqual([1, 1]);
  });
  it('blocks walls and map boundaries without changing facing or occupying the buffer', () => {
    const blocked = press(initial(room), 'LEFT');
    expect(blocked.state.hop).toBeNull();
    expect(blocked.state.facing).toBe('RIGHT');
    expect(blocked.events).toContainEqual({
      type: 'blocked',
      t: 0,
      at: [0, 1],
    });
    const openEdge = initial(fixture(['.E'], { start: [0, 0] }));
    expect(press(openEdge, 'UP').state.hop).toBeNull();
  });
  it('buffers the first press, drops later presses and executes the buffer at landing', () => {
    let state = press(initial(room), 'RIGHT').state;
    state = press(state, 'DOWN', 20).state;
    const dropped = press(state, 'LEFT', 30);
    expect(dropped.events.at(-1)).toMatchObject({
      type: 'press',
      outcome: 'dropped',
    });
    state = advance(dropped.state, 150).state;
    expect(state.hop).toMatchObject({
      direction: 'DOWN',
      startT: 150,
      endT: 300,
    });
    expect(state.buffer).toBeNull();
    expect(advance(state, 300).state.position).toEqual([2, 2]);
  });
  it('accepts a fresh press exactly at landing and allows same-owner repeats in one tick', () => {
    let state = press(initial(room), 'RIGHT').state;
    state = press(state, 'RIGHT', 50).state;
    expect(state.buffer?.button).toBe('RIGHT');
    state = advance(state, 300).state;
    expect(press(state, 'DOWN', 300).state.hop?.direction).toBe('DOWN');
  });
  it('rejects other players, unowned and unsupported buttons without recording them', () => {
    const state = initial(room, ['a', 'b']);
    const rightOwner = owner(state, 'RIGHT');
    const other = state.playerIds.find((id) => id !== rightOwner)!;
    expect(applyPress(state, other, 'RIGHT', 0).state).toEqual(state);
    expect(applyPress(state, 'stranger', 'RIGHT', 0).state).toEqual(state);
    expect(applyPress(state, rightOwner, 'JUMP', 0).state).toEqual(state);
  });
  it('deduplicates shared owners in the same 100 ms tick but accepts the next tick', () => {
    const players = Array.from({ length: 10 }, (_, i) => `p${i}`);
    let state = initial(room, players);
    const owners = players.filter((id) =>
      state.assignments[id]!.includes('RIGHT'),
    );
    state = applyPress(state, owners[0]!, 'RIGHT', 0).state;
    const duplicate = applyPress(state, owners[1]!, 'RIGHT', 99);
    expect(duplicate.events).toHaveLength(0);
    expect(duplicate.state.buffer).toBeNull();
    state = applyPress(duplicate.state, owners[1]!, 'RIGHT', 100).state;
    expect(state.buffer?.playerId).toBe(owners[1]);
  });
  it('clears a blocked buffered action instead of retrying it forever', () => {
    let state = press(initial(room), 'RIGHT').state;
    state = press(state, 'UP', 50).state;
    state = advance(state, 1000).state;
    expect(state.position).toEqual([2, 1]);
    expect(state.buffer).toBeNull();
    expect(state.hop).toBeNull();
  });
  it('rejects backwards, fractional, unsafe and invalid times', () => {
    const state = advance(initial(room), 10).state;
    for (const time of [-1, 9, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER]) {
      expect(() => advance(state, time)).toThrow();
    }
  });
  it('does not accept inputs after finishing', () => {
    const done = step(initial(fixture(['####', '#.E#', '####'])), 'RIGHT');
    expect(done.finishedAt).toBe(150);
    expect(press(done, 'LEFT').events).toHaveLength(0);
    expect(advance(done, 5000).state.position).toEqual([2, 1]);
  });
});
