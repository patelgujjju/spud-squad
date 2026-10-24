import { loadLevel } from '@spud-squad/shared';
import one from '../../../levels/1-1.json';
import four from '../../../levels/1-4.json';
import six from '../../../levels/1-6.json';
import chop from '../../../levels/2-1.json';
export const levels = [one, four, six, chop].map(loadLevel);
export const levelById = new Map(levels.map((level) => [level.id, level]));
export const HINTS: Record<string, string> = {
  '1-1': 'Follow the corridor. Take the turn. Find the exit.',
  '1-4': 'Find the yellow key card. One card opens one door.',
  '1-6':
    'Belts push every 0.4 seconds. Step off for the Golden Chip. Watch the blade!',
  '2-1': 'Red means get ready. Cross the blade while it is still.',
};
