import { describe, expect, it } from 'vitest';
import { advance } from '../engine.js';
import { deviceEnabled, doorOpen } from '../interactions.js';
import { fixture, initial, press, slicer, step, walk } from './helpers.js';

describe('keys and levers', () => {
  it('collects each key once; one key opens only one door without repeated consumption', () => {
    const level = fixture(['########', '#.kD.DE#', '########']);
    let state = walk(initial(level), ['RIGHT', 'RIGHT']);
    expect(state.keys).toBe(0);
    expect(doorOpen(state, [3, 1])).toBe(true);
    state = step(state, 'RIGHT');
    expect(press(state, 'RIGHT').state.hop).toBeNull();
    state = walk(state, ['LEFT', 'LEFT']);
    expect(state.keys).toBe(0);
    expect(state.collectedKeys).toEqual(['2,1']);
    expect(doorOpen(state, [3, 1])).toBe(true);
  });
  const devices = fixture(
    ['#########', '#.LD>S.E#', '#.......#', '#########'],
    {
      objects: [
        {
          type: 'lever',
          at: [2, 1],
          toggles: [
            [3, 1],
            [4, 1],
            [5, 1],
          ],
        },
        slicer([5, 1]),
      ],
    },
  );
  it('GRAB toggles every linked door, belt and slicer; a second GRAB reverses it', () => {
    let state = press(initial(devices), 'GRAB').state;
    expect(doorOpen(state, [3, 1])).toBe(true);
    expect(deviceEnabled(state, [4, 1])).toBe(false);
    expect(deviceEnabled(state, [5, 1])).toBe(false);
    state = press(state, 'GRAB', 100).state;
    expect(doorOpen(state, [3, 1])).toBe(false);
    expect(deviceEnabled(state, [4, 1])).toBe(true);
    expect(deviceEnabled(state, [5, 1])).toBe(true);
  });
  it('GRAB only reaches the faced adjacent tile, and levers block movement', () => {
    expect(press(initial(devices), 'RIGHT').state.hop).toBeNull();
    const below = step(initial(devices), 'DOWN');
    expect(press(below, 'GRAB').state.toggledDevices).toEqual([]);
  });
  it('a lever can close a key-opened door and another key opens it again', () => {
    const level = fixture(
      ['#########', '#.kD.L.E#', '#..k....#', '#########'],
      { objects: [{ type: 'lever', at: [5, 1], toggles: [[3, 1]] }] },
    );
    let state = walk(initial(level), ['RIGHT', 'RIGHT', 'RIGHT']);
    expect(doorOpen(state, [3, 1])).toBe(true);
    state = press(state, 'GRAB').state;
    expect(doorOpen(state, [3, 1])).toBe(false);
    state = walk(state, ['DOWN', 'LEFT']);
    expect(state.keys).toBe(1);
    state = step(state, 'UP');
    expect(doorOpen(state, [3, 1])).toBe(true);
    expect(state.keys).toBe(0);
  });
  it('buffered GRAB acts on the facing and position at landing', () => {
    const level = fixture(['########', '#..L.DE#', '########'], {
      objects: [{ type: 'lever', at: [3, 1], toggles: [[5, 1]] }],
    });
    let state = press(initial(level), 'RIGHT').state;
    state = press(state, 'GRAB', 20).state;
    const landed = advance(state, 150);
    expect(doorOpen(landed.state, [5, 1])).toBe(true);
    expect(landed.events).toContainEqual({
      type: 'lever',
      t: 150,
      at: [3, 1],
      enabled: true,
    });
  });
});

describe('conveyors', () => {
  const level = fixture(['########', '#.>>>.E#', '########']);
  it('waits 400 ms after entry, then makes 150 ms hops every 400 ms', () => {
    const state = step(initial(level), 'RIGHT');
    expect(advance(state, 549).state.position).toEqual([2, 1]);
    expect(advance(state, 550).state.hop).toMatchObject({
      startT: 550,
      endT: 700,
      source: 'conveyor',
    });
    const next = advance(state, 700).state;
    expect(next.position).toEqual([3, 1]);
    expect(next.conveyorAt).toBe(950);
    const off = advance(next, 1500).state;
    expect(off.position).toEqual([5, 1]);
    expect(off.conveyorAt).toBeNull();
  });
  it.each([
    ['>', [3, 2]],
    ['<', [1, 2]],
    ['^', [2, 1]],
    ['v', [2, 3]],
  ] as const)('pushes %s in the proper direction', (symbol, target) => {
    const room = fixture(
      ['#####', '#..E#', `#.${symbol}.#`, '#...#', '#####'],
      { start: [1, 2] },
    );
    const entered = step(initial(room), 'RIGHT');
    expect(advance(entered, 700).state.position).toEqual(target);
  });
  it('allows players to move against a belt and resets timing after leaving', () => {
    let state = advance(step(initial(level), 'RIGHT'), 700).state;
    state = step(state, 'LEFT');
    expect(state.position).toEqual([2, 1]);
    expect(state.conveyorAt).toBe(950);
    state = step(state, 'LEFT');
    expect(state.position).toEqual([1, 1]);
    expect(state.conveyorAt).toBeNull();
    state = step(state, 'RIGHT');
    expect(state.conveyorAt).toBe(state.time + 400);
  });
  it('never interrupts a manual hop and skips an overlapping scheduled push', () => {
    const state = step(initial(level), 'RIGHT');
    const moving = press(state, 'RIGHT', 500).state;
    const skipped = advance(moving, 550).state;
    expect(skipped.hop?.source).toBe('press');
    expect(skipped.conveyorAt).toBe(950);
    expect(advance(skipped, 650).state.position).toEqual([3, 1]);
  });
  it('retries a blocked automatic push at the next 400 ms deadline', () => {
    const state = step(
      initial(fixture(['######', '#.>#E#', '######'])),
      'RIGHT',
    );
    const blocked = advance(state, 550);
    expect(blocked.state.hop).toBeNull();
    expect(blocked.state.conveyorAt).toBe(950);
    expect(blocked.events).toContainEqual({
      type: 'blocked',
      t: 550,
      at: [3, 1],
    });
  });
  it('a lever disables a belt under Spud, then enabling it restarts residence timing', () => {
    const level = fixture(['########', '#..>L.E#', '########'], {
      objects: [{ type: 'lever', at: [4, 1], toggles: [[3, 1]] }],
    });
    let state = walk(initial(level), ['RIGHT', 'RIGHT']);
    state = press(state, 'GRAB').state;
    expect(state.conveyorAt).toBeNull();
    state = advance(state, 1000).state;
    expect(state.position).toEqual([3, 1]);
    state = press(state, 'GRAB').state;
    expect(state.conveyorAt).toBe(1400);
  });
});

describe('checkpoint restoration', () => {
  it('saves enabled lever state at a checkpoint and restores it after a later death', () => {
    const level = fixture(
      ['###########', '#..LD..S.E#', '#C........#', '###########'],
      {
        objects: [
          { type: 'lever', at: [3, 1], toggles: [[4, 1]] },
          slicer([7, 1]),
        ],
      },
    );
    let state = step(initial(level), 'RIGHT');
    state = press(state, 'GRAB').state;
    state = walk(state, ['DOWN', 'LEFT']);
    expect(state.checkpoint.toggledDevices).toEqual(['3,1', '4,1']);
    state = walk(state, ['RIGHT', 'UP', 'LEFT', 'RIGHT']);
    state = press(state, 'GRAB').state;
    expect(doorOpen(state, [4, 1])).toBe(false);
    state = walk(state, ['DOWN', 'RIGHT', 'RIGHT', 'RIGHT', 'UP', 'RIGHT']);
    state = step(state, 'RIGHT', 2900);
    expect(state.status).toBe('dead');
    state = advance(state, 4550).state;
    expect(state.position).toEqual([1, 2]);
    expect(doorOpen(state, [4, 1])).toBe(true);
  });
  it('restores lever-controlled devices to the last checkpoint after an actual slicer death', () => {
    const level = fixture(
      ['###########', '#..LD..S.E#', '#C........#', '###########'],
      {
        objects: [
          { type: 'lever', at: [3, 1], toggles: [[4, 1]] },
          slicer([7, 1]),
        ],
      },
    );
    let state = walk(initial(level), ['DOWN', 'UP', 'RIGHT']);
    state = press(state, 'GRAB').state;
    expect(doorOpen(state, [4, 1])).toBe(true);
    state = walk(state, ['DOWN', 'RIGHT', 'RIGHT', 'UP', 'RIGHT', 'RIGHT']);
    state = step(state, 'RIGHT', 2900);
    expect(state.status).toBe('dead');
    expect(state.deaths).toBe(1);
    expect(advance(state, 4549).state.status).toBe('dead');
    state = advance(state, 4550).state;
    expect(state.position).toEqual([1, 2]);
    expect(state.status).toBe('playing');
    expect(doorOpen(state, [4, 1])).toBe(false);
  });
  it('retains key inventory and consumed-key doors across respawn without duplicate pickups', () => {
    const level = fixture(['#########', '#.kD.S.E#', '#########'], {
      objects: [slicer([5, 1])],
    });
    let state = walk(initial(level), ['RIGHT', 'RIGHT', 'RIGHT', 'RIGHT']);
    expect(state.status).toBe('dead');
    state = advance(state, 2100).state;
    expect(state.position).toEqual([1, 1]);
    expect(state.lastPress).toBeNull();
    state = step(state, 'RIGHT');
    expect(state.keys).toBe(0);
    expect(doorOpen(state, [3, 1])).toBe(true);
  });
});
