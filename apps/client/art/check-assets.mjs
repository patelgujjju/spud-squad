import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(
  new URL('../public/assets/factory/', import.meta.url),
);
const files = await readdir(directory);
let total = 0;
for (const name of files)
  total += (await stat(path.join(directory, name))).size;
if (total > 6_000_000)
  throw new Error('Factory asset pack exceeds 6 MB: ' + total);
const glb = await readFile(path.join(directory, 'props.glb'));
const jsonLength = glb.readUInt32LE(12);
const model = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
if (!model.extensionsRequired?.includes('EXT_meshopt_compression'))
  throw new Error('Factory props must use meshopt compression.');
for (const name of files.filter((file) => file.endsWith('.ktx2'))) {
  const texture = await readFile(path.join(directory, name));
  if (texture.subarray(0, 12).toString('hex') !== 'ab4b5458203230bb0d0a1a0a')
    throw new Error('Invalid KTX2 texture: ' + name);
}
console.log(
  'Factory pack: ' +
    total.toLocaleString('en-US') +
    ' / 6,000,000 bytes (all quality tiers and decoders).',
);
