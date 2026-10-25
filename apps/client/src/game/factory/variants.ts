import type { Level } from '@spud-squad/shared';

export const VARIANTS = [
  'washer',
  'crates',
  'sacks',
  'shelves',
  'railings',
  'control',
] as const;
export type PropVariant = (typeof VARIANTS)[number];
export interface Furnishing {
  x: number;
  z: number;
  variant: PropVariant;
  rotation: number;
}

export function hash(seed: number, x: number, z: number): number {
  let value =
    Math.imul((seed ^ (x * 374761393)) >>> 0, 668265263) ^
    Math.imul(z + 31, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}
/** Stable art selection, independent of simulation randomness and input order. */
export function furnish(level: Level, seed: number): Furnishing[] {
  const chosen = new Map<string, PropVariant>();
  const result: Furnishing[] = [];
  level.map.forEach((row, z) =>
    [...row].forEach((symbol, x) => {
      if (symbol !== '#') return;
      const neighbours = [
        [x - 1, z],
        [x - 1, z - 1],
        [x, z - 1],
        [x + 1, z - 1],
      ];
      const excluded = new Set(
        neighbours.map(([nx, nz]) => chosen.get(nx + ',' + nz)),
      );
      let index = hash(seed, x, z) % VARIANTS.length;
      while (excluded.has(VARIANTS[index]))
        index = (index + 1) % VARIANTS.length;
      const variant = VARIANTS[index]!;
      chosen.set(x + ',' + z, variant);
      const walkable = (cx: number, cz: number): boolean => {
        const value = level.map[cz]?.[cx];
        return value !== undefined && value !== '#';
      };
      const rotation = walkable(x, z + 1)
        ? 0
        : walkable(x + 1, z)
          ? Math.PI / 2
          : walkable(x - 1, z)
            ? -Math.PI / 2
            : walkable(x, z - 1)
              ? Math.PI
              : 0;
      result.push({ x, z, variant, rotation });
    }),
  );
  return result;
}
