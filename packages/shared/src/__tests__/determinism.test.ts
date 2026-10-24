import { describe, expect, it } from 'vitest';
import { advance, applyPress } from '../engine.js';
import {
  fixture,
  initial,
  press,
  shipped,
  slicer,
  step,
  walk,
} from './helpers.js';

function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}

describe('deterministic advancement', () => {
  it('replays the same seed and press stream exactly', () => {
    const replay = () => {
      let state = initial(shipped('2-1'));
      const events = [];
      for (const t of [0, 160, 320, 480, 2200, 2360, 2520, 2680]) {
        const result = applyPress(state, 'a', 'RIGHT', t);
        events.push(...result.events);
        state = result.state;
      }
      const end = advance(state, 5000);
      return { state: end.state, events: [...events, ...end.events] };
    };
    expect(replay()).toEqual(replay());
    expect(replay().state.status).toBe('finished');
  });
  it('matches a large jump with many 10 Hz advances through death and respawn', () => {
    const state = press(
      walk(initial(shipped('2-1')), ['RIGHT', 'RIGHT', 'RIGHT']),
      'RIGHT',
    ).state;
    const one = advance(state, 10_000);
    let current = state;
    const events = [];
    for (let time = 500; time <= 10_000; time += 100) {
      const next = advance(current, time);
      current = next.state;
      events.push(...next.events);
    }
    expect(current).toEqual(one.state);
    expect(events).toEqual(one.events);
  });
  it('matches partitioned advances through conveyor hops and buffered input', () => {
    const room = fixture(['#########', '#.>>>>.E#', '#########']);
    let state = step(initial(room), 'RIGHT');
    state = press(state, 'RIGHT', 550).state;
    const one = advance(state, 3000);
    const left = advance(state, 1300);
    const right = advance(left.state, 3000);
    expect(right.state).toEqual(one.state);
    expect([...left.events, ...right.events]).toEqual(one.events);
  });
  it('runs against frozen state and level inputs', () => {
    const level = shipped('2-1');
    freeze(level);
    let state = initial(level);
    freeze(state);
    state = press(state, 'RIGHT').state;
    freeze(state);
    expect(advance(state, 500).state.position).toEqual([2, 1]);
  });
  it('attributes automatic belt deaths to the latest press and clears blame on respawn', () => {
    const level = fixture(
      ['#########', '#.>S..E##', '#C......#', '#########'],
      { objects: [slicer([3, 1])] },
    );
    let state = walk(initial(level), ['DOWN', 'UP', 'RIGHT']);
    state = advance(state, 1000).state;
    expect(state.status).toBe('dead');
    expect(state.stats.a!.deathsCaused).toBe(1);
    expect(advance(state, 2500).state.lastPress).toBeNull();
  });
});
