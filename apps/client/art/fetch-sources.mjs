import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = fileURLToPath(new URL('./.cache/', import.meta.url));
await mkdir(directory, { recursive: true });
const ids = [
  'interior_tiles',
  'concrete_brick_wall_001',
  'metal_plate',
  'wood_planks',
  'empty_warehouse_01',
];
const records = [];
for (const id of ids) {
  const info = await fetch('https://api.polyhaven.com/info/' + id).then(
    (response) => response.json(),
  );
  const files = await fetch('https://api.polyhaven.com/files/' + id).then(
    (response) => response.json(),
  );
  const record = {
    id,
    name: info.name,
    authors: Object.keys(info.authors),
    licence: 'CC0-1.0',
    source: 'https://polyhaven.com/a/' + id,
    files: [],
  };
  const selections =
    id === 'empty_warehouse_01'
      ? [['environment', files.hdri['1k'].hdr, 'hdr']]
      : [
          ['color', files.Diffuse['1k'].jpg, 'jpg'],
          ['normal', files.nor_gl['1k'].jpg, 'jpg'],
          ['orm', files.arm['1k'].jpg, 'jpg'],
        ];
  for (const [kind, file, extension] of selections) {
    const name = id + '-' + kind + '.' + extension;
    const target = path.join(directory, name);
    let bytes;
    try {
      bytes = await readFile(target);
    } catch {
      bytes = new Uint8Array(
        await fetch(file.url).then((response) => {
          if (!response.ok) throw new Error(file.url + ': ' + response.status);
          return response.arrayBuffer();
        }),
      );
      await writeFile(target, bytes);
    }
    const md5 = createHash('md5').update(bytes).digest('hex');
    if (md5 !== file.md5) throw new Error('Source hash mismatch: ' + name);
    record.files.push({
      kind,
      name,
      url: file.url,
      md5,
      bytes: bytes.byteLength,
    });
    console.log('Verified', name, bytes.byteLength);
  }
  records.push(record);
}
await writeFile(
  new URL('./sources.json', import.meta.url),
  JSON.stringify(records, null, 2) + '\n',
);
