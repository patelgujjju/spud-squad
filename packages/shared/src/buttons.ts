export const BASIC_BUTTONS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'GRAB'] as const;
export type BasicButton = (typeof BASIC_BUTTONS)[number];
export type Button = BasicButton | 'STOP' | 'JUMP';
export type Direction = Exclude<BasicButton, 'GRAB'>;
export type Point = readonly [number, number];

export const DELTAS: Record<Direction, Point> = {
  UP: [0, -1],
  DOWN: [0, 1],
  LEFT: [-1, 0],
  RIGHT: [1, 0],
};
export const BELTS: Readonly<Record<string, Direction>> = {
  '^': 'UP',
  v: 'DOWN',
  '<': 'LEFT',
  '>': 'RIGHT',
};
export const pointKey = ([x, y]: Point): string => `${x},${y}`;
export const samePoint = (a: Point, b: Point): boolean =>
  a[0] === b[0] && a[1] === b[1];
