import sharp from 'sharp';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cache = fileURLToPath(new URL('./.cache/', import.meta.url));
const output = fileURLToPath(
  new URL('../public/assets/factory/', import.meta.url),
);
await mkdir(output, { recursive: true });
const basisRoot = path.dirname(require.resolve('@gpu-tex-enc/basis'));
const encoder = path.join(
  basisRoot,
  'bin',
  process.platform + '-' + process.arch,
  process.platform === 'win32' ? 'basisu.exe' : 'basisu',
);
const records = JSON.parse(
  await readFile(new URL('./sources.json', import.meta.url), 'utf8'),
);
const seed = (x, y) => {
  let v = Math.imul(x + 11, 374761393) ^ Math.imul(y + 37, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return (v ^ (v >>> 16)) >>> 0;
};
for (const [tier, cell] of [
  ['high', 512],
  ['medium', 256],
  ['low', 128],
]) {
  for (const kind of ['color', 'normal', 'orm']) {
    const inputs = [];
    for (let index = 0; index < 8; index++) {
      let image;
      if (index < 4) {
        const file = records[index].files.find((file) => file.kind === kind);
        image = await sharp(path.join(cache, file.name))
          .resize(cell, cell, { fit: 'cover' })
          .removeAlpha()
          .png()
          .toBuffer();
      } else {
        const pixels = new Uint8Array(cell * cell * 3);
        const bases = [
          [172, 184, 178],
          [151, 128, 94],
          [45, 49, 51],
          [88, 111, 117],
        ];
        for (let y = 0; y < cell; y++)
          for (let x = 0; x < cell; x++) {
            const i = (y * cell + x) * 3;
            const n = (seed(x, y) % 19) - 9;
            for (let channel = 0; channel < 3; channel++)
              pixels[i + channel] =
                kind === 'normal'
                  ? [128 + (index === 5 ? (x % 4 < 2 ? 8 : -8) : 0), 128, 255][
                      channel
                    ]
                  : kind === 'orm'
                    ? [
                        230,
                        index === 5 ? 242 : index === 6 ? 210 : 145,
                        index === 7 ? 150 : 0,
                      ][channel]
                    : Math.max(
                        0,
                        Math.min(
                          255,
                          bases[index - 4][channel] +
                            n +
                            (index === 5 && y % 4 < 2 ? -10 : 0),
                        ),
                      );
          }
        image = await sharp(pixels, {
          raw: { width: cell, height: cell, channels: 3 },
        })
          .png()
          .toBuffer();
      }
      inputs.push({
        input: image,
        left: (index % 4) * cell,
        top: Math.floor(index / 4) * cell,
      });
    }
    const png = path.join(cache, 'atlas-' + tier + '-' + kind + '.png');
    await sharp({
      create: {
        width: cell * 4,
        height: cell * 2,
        channels: 3,
        background: '#808080',
      },
    })
      .composite(inputs)
      .png()
      .toFile(png);
    const destination = path.join(
      output,
      'atlas-' + tier + '-' + kind + '.ktx2',
    );
    const args = [
      '-ktx2',
      '-q',
      '180',
      '-comp_level',
      '2',
      '-mipmap',
      '-file',
      png,
      '-output_file',
      destination,
    ];
    if (kind !== 'color') args.push('-linear');
    const run = spawnSync(encoder, args, {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    if (run.status !== 0)
      throw new Error(run.stdout + run.stderr + String(run.error ?? ''));
    console.log('Encoded', path.basename(destination));
  }
}
await copyFile(
  path.join(cache, 'empty_warehouse_01-environment.hdr'),
  path.join(output, 'warehouse.hdr'),
);
const three = path.resolve(path.dirname(require.resolve('three')), '..');
for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm'])
  await copyFile(
    path.join(three, 'examples/jsm/libs/basis', name),
    path.join(output, name),
  );
const manifest = {
  maxBytes: 6_000_000,
  shared: [
    'props.glb',
    'warehouse.hdr',
    'basis_transcoder.js',
    'basis_transcoder.wasm',
  ],
  tiers: Object.fromEntries(
    ['high', 'medium', 'low'].map((tier) => [
      tier,
      ['color', 'normal', 'orm'].map(
        (kind) => 'atlas-' + tier + '-' + kind + '.ktx2',
      ),
    ]),
  ),
};
await writeFile(
  path.join(output, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
