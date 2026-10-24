import { describe, expect, it } from 'vitest';
import { assignButtons, shufflePlayers } from '../assignments.js';
import { BASIC_BUTTONS } from '../buttons.js';
import type { Button } from '../buttons.js';

describe('button ownership', () => {
  const expected: Record<number, Button[][]> = {
    1: [[...BASIC_BUTTONS]],
    2: [
      ['LEFT', 'RIGHT', 'GRAB'],
      ['UP', 'DOWN'],
    ],
    3: [['LEFT', 'RIGHT'], ['UP', 'DOWN'], ['GRAB']],
    4: [['LEFT'], ['RIGHT'], ['UP', 'DOWN'], ['GRAB']],
    5: BASIC_BUTTONS.map((button) => [button]),
  };
  it.each([1, 2, 3, 4, 5])(
    'matches every group in the %i-player design row',
    (count) => {
      const players = Array.from({ length: count }, (_, i) => `p${i}`);
      const order = shufflePlayers(players, 42);
      const assignments = assignButtons(players, 42);
      expect(order.map((id) => assignments[id])).toEqual(expected[count]);
      expect(players).toEqual(Array.from({ length: count }, (_, i) => `p${i}`));
    },
  );
  it.each([1, 2, 3, 4, 5])(
    'assigns the sixth button per the %i-player row',
    (count) => {
      const players = Array.from({ length: count }, (_, i) => `p${i}`);
      for (const special of ['STOP', 'JUMP'] as const) {
        const order = shufflePlayers(players, 99);
        const assignments = assignButtons(players, 99, [
          ...BASIC_BUTTONS,
          special,
        ]);
        const expectedIndex =
          count === 1
            ? 0
            : count === 2
              ? 1
              : count === 3
                ? 2
                : count === 4
                  ? 3
                  : 4;
        expect(
          order.filter((id) => assignments[id]!.includes(special)),
        ).toEqual([order[expectedIndex]]);
        expect(
          Object.values(assignments)
            .flat()
            .filter((button) => button === special),
        ).toHaveLength(1);
      }
    },
  );
  it.each([6, 7, 8, 9, 10])(
    'covers every button evenly with %i players',
    (count) => {
      for (const buttons of [
        BASIC_BUTTONS,
        [...BASIC_BUTTONS, 'JUMP'] as const,
      ]) {
        const assigned = Object.values(
          assignButtons(
            Array.from({ length: count }, (_, i) => `p${i}`),
            0,
            buttons,
          ),
        );
        expect(assigned.every((group) => group.length === 1)).toBe(true);
        const counts = buttons.map(
          (button) =>
            assigned.flat().filter((owned) => owned === button).length,
        );
        expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(
          1,
        );
      }
    },
  );
  it('is seeded, varies between seeds and only assigns available buttons', () => {
    const players = ['a', 'b', 'c', 'd', 'e'];
    expect(assignButtons(players, 42)).toEqual(assignButtons(players, 42));
    expect(shufflePlayers(players, 42)).not.toEqual(
      shufflePlayers(players, 43),
    );
    expect(
      Object.values(assignButtons(['a', 'b'], 1, ['LEFT', 'RIGHT']))
        .flat()
        .sort(),
    ).toEqual(['LEFT', 'RIGHT']);
    expect(Object.keys(assignButtons(['__proto__'], 0))).toEqual(['__proto__']);
  });
  it('rejects invalid inputs', () => {
    for (const players of [
      [],
      ['a', 'a'],
      [''],
      Array.from({ length: 11 }, (_, i) => `p${i}`),
    ]) {
      expect(() => assignButtons(players, 1)).toThrow();
    }
    expect(() => assignButtons(['a'], NaN)).toThrow();
    expect(() => assignButtons(['a'], 1, [])).toThrow();
    expect(() => assignButtons(['a'], 1, ['GRAB', 'GRAB'])).toThrow();
    expect(() => assignButtons(['a'], 1, ['STOP', 'JUMP'])).toThrow();
  });
});
