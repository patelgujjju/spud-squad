import { readFile, readdir } from 'node:fs/promises';
import { loadLevel } from '../../packages/shared/dist/index.js';

const directory = new URL('../../levels/', import.meta.url);
const files = (await readdir(directory))
  .filter((file) => file.endsWith('.json'))
  .sort();
const ids = new Set();
for (const file of files) {
  const level = loadLevel(await readFile(new URL(file, directory), 'utf8'));
  if (ids.has(level.id) || file !== `${level.id}.json`) {
    throw new Error(`Duplicate or mismatched level ID in ${file}`);
  }
  ids.add(level.id);
  console.log(`${level.id}: ${level.name} — valid`);
}
