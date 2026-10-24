import { loadLevel } from '@spud-squad/shared';
import one from '../../../levels/1-1.json';
import four from '../../../levels/1-4.json';
import six from '../../../levels/1-6.json';
import chop from '../../../levels/2-1.json';

export const levels = new Map(
  [one, four, six, chop].map((json) => {
    const level = loadLevel(json);
    return [level.id, level];
  }),
);
