import { describe, expect, it } from 'vitest';
import { advance, applyPress } from '../engine.js';
import { getResults } from '../results.js';
import type { Direction } from '../buttons.js';
import { initial, owner, press, shipped, step, walk } from './helpers.js';

const rights = (count: number): Direction[] =>
  Array.from({ length: count }, () => 'RIGHT');

describe('actual prototype level playthroughs', () => {
  it('1-1: follows a corridor with one turn and collects the chip', () => {
    const state = walk(initial(shipped('1-1')), [
      ...rights(3),
      'DOWN',
      'DOWN',
      ...rights(3),
    ]);
    expect(state.status).toBe('finished');
    expect(state.deaths).toBe(0);
    expect(getResults(state)).toMatchObject({
      stars: 3,
      awards: { heroPress: 'a', fryerFeeder: [], cleanHands: ['a'] },
    });
  });
  it('1-4: visits the key side room, detours to the chip and opens the exit door', () => {
    const state = walk(initial(shipped('1-4')), [
      'DOWN',
      'DOWN',
      'RIGHT',
      'RIGHT',
      'DOWN',
      'DOWN',
      'LEFT',
      'LEFT',
      ...rights(8),
      'UP',
      'UP',
      'UP',
      'UP',
    ]);
    expect(state.status).toBe('finished');
    expect(state.keys).toBe(0);
    expect(state.unlockedDoors).toEqual(['9,2']);
    expect(getResults(state).stars).toBe(3);
  });
  it('1-6: belts lead to a real slicer death, then the team respawns and escapes', () => {
    let state = walk(initial(shipped('1-6')), rights(8));
    expect(state.position).toEqual([9, 1]);
    state = step(state, 'RIGHT', 3000);
    expect(state.status).toBe('dead');
    expect(state.deaths).toBe(1);
    state = advance(state, 4650).state;
    expect(state.position).toEqual([1, 1]);
    state = walk(state, rights(8));
    state = step(state, 'RIGHT', 7050);
    state = step(state, 'RIGHT');
    expect(state.status).toBe('finished');
    expect(getResults(state).awards.fryerFeeder).toEqual(['a']);
  });
  it('1-6: players can step off the belt to collect its optional chip', () => {
    let state = walk(initial(shipped('1-6')), [
      'RIGHT',
      'RIGHT',
      'DOWN',
      'DOWN',
      'RIGHT',
      'RIGHT',
      'RIGHT',
      'UP',
      'UP',
      'RIGHT',
      'RIGHT',
      'RIGHT',
    ]);
    expect(state.position).toEqual([9, 1]);
    expect(state.goldenChip).toBe(true);
    state = walk(state, ['RIGHT', 'RIGHT']);
    expect(state.status).toBe('finished');
    expect(getResults(state).stars).toBe(3);
  });
  it('2-1: real two-player inputs cause death, checkpoint respawn and Fryer Feeder', () => {
    let state = initial(shipped('2-1'), ['alice', 'bob']);
    const feeder = owner(state, 'RIGHT');
    const clean = state.playerIds.find((id) => id !== feeder)!;
    state = walk(state, rights(4));
    expect(state.status).toBe('dead');
    expect(state.position).toEqual([5, 1]);
    expect(state.checkpoint.position).toEqual([3, 1]);
    const ignored = applyPress(state, clean, 'DOWN', 1000);
    expect(ignored.state.stats[clean]!.presses).toBe(0);
    state = advance(ignored.state, 2100).state;
    expect(state.position).toEqual([3, 1]);
    state = walk(state, rights(4));
    const results = getResults(state);
    expect(results).toEqual({
      timeMs: 2700,
      deaths: 1,
      stars: 3,
      awards: {
        fryerFeeder: [feeder],
        heroPress: feeder,
        buttonMasher: [feeder],
        asleepAtTheButton: [clean],
        cleanHands: [clean],
      },
    });
  });
  it('counts buffer overflows and attributes death to the last valid owned press', () => {
    let state = walk(initial(shipped('2-1'), ['a', 'b']), rights(3));
    const right = owner(state, 'RIGHT');
    const down = owner(state, 'DOWN');
    state = press(state, 'RIGHT').state;
    state = press(state, 'GRAB', 460).state;
    state = press(state, 'DOWN', 470).state;
    state = advance(state, 600).state;
    expect(state.status).toBe('dead');
    expect(state.stats[right]!.presses).toBe(5);
    expect(state.stats[down]!.presses).toBe(1);
    expect(state.stats[down]!.deathsCaused).toBe(1);
  });
});

describe('results', () => {
  it('requires a completed level', () => {
    expect(() => getResults(initial(shipped('1-1')))).toThrow('not finished');
  });
  it('requires beating par before the chip can give a third star', () => {
    const route: Direction[] = [...rights(3), 'DOWN', 'DOWN', ...rights(3)];
    const base = initial(shipped('1-1'));
    const atPar = walk(advance(base, 3800).state, route);
    expect(atPar.finishedAt).toBe(5000);
    expect(getResults(atPar).stars).toBe(1);
    const beforePar = walk(advance(base, 3799).state, route);
    expect(getResults(beforePar).stars).toBe(3);
  });
  it('awards two stars without a chip and scales par for the group size', () => {
    const level = {
      ...shipped('1-1'),
      goldenChip: [1, 1] as [number, number],
      parSeconds: 1,
    };
    // The chip at the starting tile is not entered on this route.
    let state = initial(level, ['a', 'b', 'c', 'd', 'e']);
    state = walk(state, [...rights(3), 'DOWN', 'DOWN', ...rights(3)]);
    expect(state.finishedAt).toBe(1200);
    expect(getResults(state).stars).toBe(2);
  });
  it('preserves all ties in awards', () => {
    let state = initial(shipped('1-1'), ['a', 'b', 'c', 'd', 'e']);
    state = walk(state, [...rights(3), 'DOWN', 'DOWN', ...rights(3)]);
    const results = getResults(state);
    expect(results.awards.asleepAtTheButton).toHaveLength(3);
    expect(results.awards.cleanHands).toHaveLength(5);
  });
});
