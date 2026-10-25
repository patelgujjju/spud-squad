import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const assets = new URL('../apps/client/dist/assets/', import.meta.url);
const files = (await readdir(assets, { recursive: true })).filter((file) =>
  file.endsWith('.js'),
);
const sizes = await Promise.all(
  files.map(
    async (file) =>
      gzipSync(await readFile(new URL(file.replaceAll('\\', '/'), assets)))
        .byteLength,
  ),
);
const total = sizes.reduce((sum, size) => sum + size, 0);
console.log(
  `All client JavaScript: ${(total / 1024).toFixed(1)} KiB gzipped (budget: 400 KiB).`,
);
if (total >= 400 * 1024)
  throw new Error('Client JavaScript exceeds the 400 KiB gzip budget');
