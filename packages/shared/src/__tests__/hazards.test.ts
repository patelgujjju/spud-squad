import { describe, expect, it } from 'vitest';
import { advance } from '../engine.js';
import { groupFactor, slicerAt } from '../hazards.js';
import {
  fixture,
  initial,
  press,
  shipped,
  slicer,
  step,
  walk,
} from './helpers.js';

describe('slicer clock', () => {
  const blade = {
    type: 'slicer',
    at: [1, 1],
    onMs: 1200,
    offMs: 1800,
    phaseMs: 0,
  } as const;
  const spec = { ...blade, at: [1, 1] as [number, number] };
  it.each([
    [0, true, false, 1200],
    [1199, true, false, 1200],
    [1200, false, false, 2600],
    [2599, false, false, 2600],
    [2600, false, true, 3000],
    [2999, false, true, 3000],
    [3000, true, false, 4200],
    [12_000, true, false, 13_200],
  ])('has the expected phase at %i ms', (t, active, warning, nextChangeT) => {
    expect(slicerAt(spec, t, 1)).toEqual({ active, warning, nextChangeT });
  });
  it.each([
    [1, 1],
    [2, 1],
    [3, 1.15],
    [4, 1.15],
    [5, 1.3],
    [6, 1.3],
    [7, 1.4],
    [10, 1.4],
  ])('scales only safe windows for %i players', (players, factor) => {
    expect(groupFactor(players)).toBe(factor);
    const nextOn = 1200 + Math.round(1800 * factor);
    expect(slicerAt(spec, 1199, factor).active).toBe(true);
    expect(slicerAt(spec, nextOn - 401, factor).warning).toBe(false);
    expect(slicerAt(spec, nextOn - 400, factor).warning).toBe(true);
    expect(slicerAt(spec, nextOn - 1, factor).active).toBe(false);
    expect(slicerAt(spec, nextOn, factor).active).toBe(true);
  });
  it('supports phase offsets and disabled blades without changing the schedule', () => {
    expect(slicerAt({ ...spec, phaseMs: 1200 }, 0, 1).active).toBe(false);
    expect(slicerAt({ ...spec, phaseMs: 1200 }, 1800, 1).active).toBe(true);
    expect(slicerAt(spec, 0, 1, false)).toEqual({
      active: false,
      warning: false,
      nextChangeT: 1200,
    });
    expect(slicerAt(spec, 2700, 1, false).warning).toBe(false);
  });
  it.each([0, 11, 1.5])('rejects invalid player count %s', (count) => {
    expect(() => groupFactor(count)).toThrow();
  });
});

describe('live hazard contacts', () => {
  it('kills on arrival during an active phase, clears the buffer and ignores presses while dead', () => {
    const level = fixture(['######', '#.S.E#', '######'], {
      objects: [slicer([2, 1])],
    });
    let state = press(initial(level), 'RIGHT').state;
    state = press(state, 'RIGHT', 20).state;
    const death = advance(state, 150);
    expect(death.events).toContainEqual({
      type: 'death',
      t: 150,
      at: [2, 1],
      playerId: 'a',
    });
    expect(death.state.hop).toBeNull();
    expect(death.state.buffer).toBeNull();
    expect(press(death.state, 'RIGHT', 200).state.stats.a!.presses).toBe(2);
    expect(advance(death.state, 1650).state.position).toEqual([1, 1]);
  });
  it('kills a stationary Spud at the exact activation time even across a long advance', () => {
    let state = walk(initial(shipped('2-1')), ['RIGHT', 'RIGHT', 'RIGHT']);
    state = step(state, 'RIGHT', 2750);
    expect(state.status).toBe('playing');
    expect(advance(state, 2999).state.status).toBe('playing');
    const activated = advance(state, 3000);
    expect(activated.state.status).toBe('dead');
    expect(activated.events).toContainEqual({
      type: 'death',
      t: 3000,
      at: [5, 1],
      playerId: 'a',
    });
    expect(advance(state, 4600).state.position).toEqual([3, 1]);
  });
  it('landing exactly on activation kills; leaving exactly then is safe', () => {
    const base = walk(initial(shipped('2-1')), ['RIGHT', 'RIGHT', 'RIGHT']);
    expect(step(base, 'RIGHT', 2850).status).toBe('dead');
    let onBlade = step(base, 'RIGHT', 2550);
    onBlade = step(onBlade, 'RIGHT', 2850);
    expect(onBlade.status).toBe('playing');
    expect(onBlade.position).toEqual([6, 1]);
  });
  it('activation takes priority over an incoming escape press at the same time', () => {
    const base = walk(initial(shipped('2-1')), ['RIGHT', 'RIGHT', 'RIGHT']);
    const standing = step(base, 'RIGHT', 2750);
    const input = press(standing, 'RIGHT', 3000);
    expect(input.state.status).toBe('dead');
    expect(input.events.map((event) => event.type)).toEqual(['death']);
  });
  it('keeps the group-adjusted safe window and the original phase after respawn', () => {
    let state = walk(initial(shipped('2-1'), ['a', 'b', 'c', 'd', 'e']), [
      'RIGHT',
      'RIGHT',
      'RIGHT',
    ]);
    state = step(state, 'RIGHT', 3050);
    expect(state.position).toEqual([5, 1]);
    expect(state.status).toBe('playing');
    const death = advance(state, 3540);
    expect(death.state.status).toBe('dead');
    expect(death.state.respawnAt).toBe(5040);
  });
});
