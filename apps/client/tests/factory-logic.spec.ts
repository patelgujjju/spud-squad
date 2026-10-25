import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Box3, CompressedTexture, Vector3 } from 'three';
import { loadLevel } from '@spud-squad/shared';
import { furnish } from '../src/game/factory/variants.js';
import { FactoryCamera } from '../src/game/factory/camera.js';
import { FactoryMaterials } from '../src/game/factory/materials.js';
import { RoomBatches } from '../src/game/factory/batches.js';

const level = loadLevel(
  readFileSync(new URL('../../../levels/1-1.json', import.meta.url), 'utf8'),
);

test('factory furnishing is seeded, covers only walls, and avoids identical neighbours', () => {
  const first = furnish(level, 123);
  expect(first).toEqual(furnish(level, 123));
  expect(first).not.toEqual(furnish(level, 124));
  expect(first.length).toBe(level.map.join('').split('#').length - 1);
  for (const entry of first) {
    expect(level.map[entry.z]?.[entry.x]).toBe('#');
    for (const other of first)
      if (
        entry !== other &&
        Math.abs(entry.x - other.x) <= 1 &&
        Math.abs(entry.z - other.z) <= 1
      )
        expect(entry.variant).not.toBe(other.variant);
  }
});

test('factory fly-over lasts 2.5 seconds, can be skipped, and held overview restores follow', () => {
  const rig = new FactoryCamera();
  rig.resize(390, 590);
  const bounds = new Box3(
    new Vector3(-2.5, 0, -2.5),
    new Vector3(10.5, 5.6, 7.5),
  );
  rig.configure(level, bounds, 100);
  expect(rig.frame(1, 1, 'RIGHT', 100, 1 / 60, false)).toBe(0);
  expect(rig.mode).toBe('flyover');
  expect(rig.frame(1, 1, 'RIGHT', 2599, 1 / 60, false)).toBeLessThan(1);
  expect(rig.frame(1, 1, 'RIGHT', 2600, 1 / 60, false)).toBe(1);
  expect(rig.mode).toBe('follow');
  rig.configure(level, bounds, 3000);
  rig.skip();
  rig.frame(1, 1, 'RIGHT', 3001, 1 / 60, false);
  expect(rig.mode).toBe('follow');
  rig.overview(true);
  rig.frame(1, 1, 'RIGHT', 3002, 1 / 60, false);
  expect(rig.mode).toBe('overview');
  rig.overview(false);
  rig.frame(1, 1, 'RIGHT', 3003, 1 / 60, false);
  expect(rig.mode).toBe('follow');
  rig.configure(level, bounds, 4000);
  rig.frame(1, 1, 'RIGHT', 4000, 1 / 60, true);
  expect(rig.mode).toBe('follow');
});

test('path fading preserves interactive machines but still fades anything hiding Spud', () => {
  const materials = new FactoryMaterials(
    {
      color: new CompressedTexture([], 1, 1),
      normal: new CompressedTexture([], 1, 1),
      orm: new CompressedTexture([], 1, 1),
    },
    'low',
  );
  const camera = new Vector3(0, 5, 5);
  const path = [new Vector3(2, 0.08, 0)];
  const blockingPath = new Box3(new Vector3(1, 0.5, 1), new Vector3(1.8, 2, 2));
  const props = new RoomBatches(materials);
  props.occluder(blockingPath);
  expect(props.visibility(camera, 0, 0, 1 / 60, path)).toBe(1);
  const machines = new RoomBatches(materials);
  machines.occluder(blockingPath, false);
  expect(machines.visibility(camera, 0, 0, 1 / 60, path)).toBe(0);
  machines.occluder(
    new Box3(new Vector3(-0.5, 0.4, 1), new Vector3(0.5, 2, 2)),
    false,
  );
  expect(machines.visibility(camera, 0, 0, 1 / 60, path)).toBe(1);
  materials.dispose();
});
