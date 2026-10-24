import { levelSchema } from './levelSchema.js';
import type { Level } from './levelSchema.js';

/** Accept imported JSON or JSON text without doing filesystem/network I/O. */
export function loadLevel(input: unknown): Level {
  const value: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  return levelSchema.parse(value);
}
