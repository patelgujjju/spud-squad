import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levelLoader.js';
import { fixture, shipped, slicer } from './helpers.js';

describe('level schema and loader', () => {
  it.each(['1-1', '1-4', '1-6', '2-1'])(
    'loads actual level %s from JSON',
    (id) => {
      expect(shipped(id).id).toBe(id);
    },
  );
  it('loads objects, clones input and rejects malformed JSON', () => {
    const level = fixture(['#####', '#..E#', '#####']);
    expect(loadLevel(level)).toEqual(level);
    expect(loadLevel(level)).not.toBe(level);
    expect(() => loadLevel('{')).toThrow();
  });
  it.each([
    { map: ['####', '#.E#', '###'] },
    { map: ['####', '#..#', '####'] },
    { map: ['#####', '#.EE#', '#####'] },
    { map: ['#####', '#.xE#', '#####'] },
    { map: ['#####', '#.SE#', '#####'] },
    { map: ['#####', '#.LE#', '#####'] },
    { start: [20, 1] },
    { start: [0, 0] },
    { buttons: ['RIGHT', 'RIGHT'] },
    { buttons: ['STOP'] },
    { world: 2 },
    { darkness: true },
    { parSeconds: 0 },
    { unexpected: true },
    { goldenChip: [0, 0] },
    { goldenChip: [8, 8] },
    { objects: [slicer([2, 1])] },
    { objects: [{ ...slicer([2, 1]), offMs: 399 }] },
  ])('rejects invalid data %j', (change) => {
    const base = fixture(['#####', '#..E#', '#####']);
    expect(() => loadLevel({ ...base, ...change })).toThrow();
  });
  it('rejects duplicate objects and invalid or duplicate lever links', () => {
    expect(() =>
      fixture(['######', '#.S.E#', '######'], {
        objects: [slicer([2, 1]), slicer([2, 1])],
      }),
    ).toThrow();
    const map = ['#######', '#.L.DE#', '#######'];
    expect(() =>
      fixture(map, {
        objects: [{ type: 'lever', at: [2, 1], toggles: [[0, 0]] }],
      }),
    ).toThrow();
    expect(() =>
      fixture(map, {
        objects: [
          {
            type: 'lever',
            at: [2, 1],
            toggles: [
              [4, 1],
              [4, 1],
            ],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      fixture(map, {
        buttons: ['RIGHT'],
        objects: [{ type: 'lever', at: [2, 1], toggles: [[4, 1]] }],
      }),
    ).toThrow();
  });
  it('validates Golden Chip symbols and coordinates', () => {
    expect(fixture(['#####', '#.GE#', '#####']).map[1]).toContain('G');
    expect(() => fixture(['######', '#.GGE#', '######'])).toThrow();
    expect(() =>
      fixture(['######', '#.G.E#', '######'], { goldenChip: [3, 1] }),
    ).toThrow();
    expect(
      fixture(['#####', '#.GE#', '#####'], { goldenChip: [2, 1] }).goldenChip,
    ).toEqual([2, 1]);
  });
});
