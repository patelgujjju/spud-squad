import {
  Scene,
  Group,
  Mesh,
  MeshStandardMaterial,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  Shape,
  ExtrudeGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
const scene = new Scene();
const materials = new Map();
function material(name) {
  if (!materials.has(name)) {
    const colors = {
      enamel: 0xc6d0ca,
      metal: 0x77858b,
      dark: 0x182129,
      wood: 0x9a7854,
      burlap: 0xb09b78,
      paint: 0x556b71,
      glass: 0x263c45,
      yellow: 0xc8a747,
      red: 0x9d342b,
      green: 0x528b71,
      gold: 0xcba24b,
    };
    const m = new MeshStandardMaterial({
      color: colors[name],
      roughness: name === 'glass' ? 0.15 : 0.7,
      metalness: ['metal', 'gold', 'glass'].includes(name) ? 0.65 : 0,
    });
    m.name = name;
    materials.set(name, m);
  }
  return materials.get(name);
}
function part(
  root,
  geometry,
  name,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
) {
  const mesh = new Mesh(geometry, material(name));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  root.add(mesh);
  return mesh;
}
function box(root, name, w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  return part(
    root,
    new RoundedBoxGeometry(w, h, d, 1, Math.min(0.018, h / 5, w / 5, d / 5)),
    name,
    x,
    y,
    z,
    rx,
    ry,
    rz,
  );
}
const cyl = (r, h, n = 16) => new CylinderGeometry(r, r, h, n);
function model(name, build, merge = true) {
  const root = new Group();
  root.name = name;
  build(root);
  root.updateMatrixWorld(true);
  if (merge) {
    const batches = new Map();
    root.traverse((node) => {
      if (node instanceof Mesh) {
        const key = node.material.name;
        if (!batches.has(key)) batches.set(key, []);
        const g = node.geometry.index
          ? node.geometry.toNonIndexed()
          : node.geometry.clone();
        g.applyMatrix4(node.matrixWorld);
        const uv = g.getAttribute('uv');
        for (let i = 0; i < uv.count; i++)
          uv.setXY(
            i,
            Math.max(0.002, Math.min(0.998, uv.getX(i))),
            Math.max(0.002, Math.min(0.998, uv.getY(i))),
          );
        batches.get(key).push(g);
      }
    });
    root.clear();
    for (const [key, geometries] of batches)
      root.add(new Mesh(mergeGeometries(geometries), material(key)));
  }
  scene.add(root);
  return root;
}
function crate(g, x, y, z, scale = 1) {
  box(g, 'wood', 0.74 * scale, 0.43 * scale, 0.75 * scale, x, y, z);
  for (const side of [-1, 1]) {
    box(
      g,
      'wood',
      0.82 * scale,
      0.055 * scale,
      0.08 * scale,
      x,
      y + side * 0.17 * scale,
      z + 0.39 * scale,
    );
    box(
      g,
      'metal',
      0.035 * scale,
      0.41 * scale,
      0.035 * scale,
      x + side * 0.34 * scale,
      y,
      z + 0.415 * scale,
    );
  }
  box(
    g,
    'wood',
    0.06 * scale,
    0.46 * scale,
    0.04 * scale,
    x,
    y,
    z + 0.407 * scale,
    0,
    0,
    0.7,
  );
}
function sack(g, x, y, z, scale = 1) {
  const geometry = new SphereGeometry(0.24, 16, 12);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i),
      py = p.getY(i),
      pz = p.getZ(i);
    const lump = 1 + 0.05 * Math.sin(px * 37 + py * 19) * Math.cos(pz * 27);
    p.setXYZ(i, px * lump * scale, py * 1.45 * lump * scale, pz * lump * scale);
  }
  geometry.computeVertexNormals();
  part(g, geometry, 'burlap', x, y, z);
  part(
    g,
    cyl(0.042 * scale, 0.12 * scale, 8),
    'burlap',
    x,
    y + 0.34 * scale,
    z,
  );
  part(
    g,
    new TorusGeometry(0.052 * scale, 0.012 * scale, 5, 12),
    'wood',
    x,
    y + 0.32 * scale,
    z,
    Math.PI / 2,
  );
}
model('washer', (g) => {
  box(g, 'enamel', 0.86, 1.0, 0.83, 0, 0.56, 0);
  box(g, 'metal', 0.91, 0.1, 0.89, 0, 1.1, 0);
  box(g, 'dark', 0.76, 0.14, 0.035, 0, 0.97, 0.44);
  for (const x of [-0.22, 0.14, 0.27])
    part(
      g,
      cyl(x < 0 ? 0.045 : 0.024, 0.035, 12),
      'metal',
      x,
      0.97,
      0.47,
      Math.PI / 2,
    );
  part(g, new TorusGeometry(0.245, 0.035, 8, 24), 'metal', 0, 0.53, 0.45);
  part(g, cyl(0.214, 0.045, 24), 'glass', 0, 0.53, 0.45, Math.PI / 2);
  part(g, new TorusGeometry(0.195, 0.008, 5, 24), 'dark', 0, 0.53, 0.48);
  box(g, 'yellow', 0.13, 0.04, 0.01, -0.23, 0.8, 0.444);
  for (const x of [-0.31, 0.31])
    for (const z of [-0.3, 0.3]) box(g, 'dark', 0.09, 0.14, 0.09, x, 0.07, z);
  part(
    g,
    new TorusGeometry(0.11, 0.025, 6, 16, Math.PI),
    'dark',
    0.26,
    0.52,
    -0.47,
    0,
    Math.PI / 2,
  );
});
model('crates', (g) => {
  crate(g, -0.035, 0.28, 0.015);
  crate(g, 0.025, 0.74, -0.025, 0.9);
});
model('sacks', (g) => {
  for (const x of [-0.3, 0, 0.3]) box(g, 'wood', 0.16, 0.1, 0.88, x, 0.05, 0);
  sack(g, -0.21, 0.43, -0.15, 0.91);
  sack(g, 0.21, 0.4, 0.12, 0.87);
  sack(g, -0.1, 0.4, 0.24, 0.7);
});
model('shelves', (g) => {
  for (const x of [-0.4, 0.4])
    for (const z of [-0.37, 0.37])
      box(g, 'metal', 0.035, 1.52, 0.035, x, 0.76, z);
  for (const y of [0.17, 0.68, 1.2]) box(g, 'metal', 0.86, 0.04, 0.83, 0, y, 0);
  crate(g, -0.2, 0.43, 0.02, 0.42);
  crate(g, 0.2, 0.44, -0.02, 0.45);
  sack(g, 0.18, 0.92, 0.02, 0.52);
  box(g, 'paint', 0.3, 0.22, 0.43, -0.2, 0.83, -0.04);
  box(g, 'metal', 0.025, 1.55, 0.025, 0, 0.76, -0.39, 0, 0, 0.47);
});
model('railings', (g) => {
  for (const x of [-0.39, 0.39])
    for (const z of [-0.39, 0.39]) {
      part(g, cyl(0.023, 0.98, 8), 'metal', x, 0.49, z);
      box(g, 'metal', 0.1, 0.045, 0.1, x, 0.023, z);
    }
  for (const z of [-0.39, 0.39])
    for (const y of [0.52, 0.95])
      part(g, cyl(0.022, 0.8, 8), 'metal', 0, y, z, 0, 0, Math.PI / 2);
  for (const x of [-0.39, 0.39])
    part(g, cyl(0.022, 0.8, 8), 'metal', x, 0.95, 0, Math.PI / 2);
  part(
    g,
    new TorusGeometry(0.25, 0.065, 8, 20),
    'dark',
    0,
    0.12,
    0,
    Math.PI / 2,
  );
  box(g, 'yellow', 0.12, 0.11, 0.04, -0.26, 0.69, 0.4);
});
model('control', (g) => {
  box(g, 'metal', 0.8, 0.12, 0.75, 0, 0.06, 0);
  box(g, 'paint', 0.65, 1.1, 0.54, 0, 0.66, -0.06);
  box(g, 'metal', 0.7, 0.08, 0.6, 0, 1.25, -0.06);
  box(g, 'dark', 0.44, 0.25, 0.025, 0, 1.0, 0.23);
  box(g, 'green', 0.29, 0.018, 0.012, -0.03, 1.02, 0.248);
  for (const x of [-0.19, 0, 0.19])
    part(
      g,
      cyl(0.039, 0.04, 12),
      x === 0 ? 'red' : 'dark',
      x,
      0.7,
      0.25,
      Math.PI / 2,
    );
  box(g, 'yellow', 0.25, 0.08, 0.01, 0, 0.4, 0.218);
  for (const side of [-1, 1])
    part(g, cyl(0.018, 0.7, 8), 'metal', side * 0.34, 0.5, -0.3);
});
model(
  'slicer',
  (g) => {
    box(g, 'paint', 0.94, 0.26, 0.92, 0, 0.13, 0);
    for (const x of [-0.37, 0.37])
      box(g, 'metal', 0.16, 0.65, 0.73, x, 0.59, -0.04);
    box(g, 'metal', 0.88, 0.1, 0.22, 0, 0.93, -0.24);
    box(g, 'dark', 0.65, 0.04, 0.16, 0, 0.28, 0.04);
    for (const x of [-0.36, 0.36])
      box(g, 'yellow', 0.05, 0.25, 0.025, x, 0.63, 0.34, 0, 0, 0.45);
    const rotor = new Group();
    rotor.name = 'rotor';
    rotor.position.set(0, 0.51, 0.09);
    g.add(rotor);
    const shape = new Shape();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r = i % 3 === 0 ? 0.37 : i % 3 === 1 ? 0.33 : 0.295;
      if (!i) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const blade = new ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: false,
      steps: 1,
    });
    blade.center();
    part(rotor, blade, 'metal');
    part(rotor, cyl(0.065, 0.08), 'dark', 0, 0, 0.04, Math.PI / 2);
    const beacon = new Group();
    beacon.name = 'beacon';
    g.add(beacon);
    part(beacon, cyl(0.075, 0.035), 'dark', 0.34, 1.02, -0.24);
    part(
      beacon,
      new SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      'red',
      0.34,
      1.035,
      -0.24,
    );
  },
  false,
);
model('conveyor', (g) => {
  box(g, 'paint', 0.97, 0.21, 0.91, 0, 0.105, 0);
  for (const z of [-0.42, 0.42]) box(g, 'metal', 0.96, 0.13, 0.065, 0, 0.26, z);
  for (let i = 0; i < 7; i++)
    part(
      g,
      cyl(0.052, 0.77, 12),
      'metal',
      (i - 3) * 0.125,
      0.24,
      0,
      Math.PI / 2,
    );
  for (const x of [-0.3, 0.3]) box(g, 'dark', 0.1, 0.16, 0.1, x, 0.05, 0.3);
});
model('exit', (g) => {
  for (const x of [-0.43, 0.43])
    box(g, 'metal', 0.12, 1.75, 0.24, x, 0.875, -0.12);
  box(g, 'metal', 0.98, 0.13, 0.24, 0, 1.75, -0.12);
  box(g, 'dark', 0.74, 1.57, 0.04, 0, 0.83, -0.24);
  box(g, 'metal', 0.83, 0.05, 0.45, 0, 0.025, 0.06);
  box(g, 'dark', 0.85, 0.27, 0.12, 0, 2.0, -0.1);
});
model('pedestal', (g) => {
  part(g, cyl(0.16, 0.17), 'dark', 0, 0.085, 0);
  part(g, cyl(0.11, 0.03), 'gold', 0, 0.19, 0);
});
const output = fileURLToPath(
  new URL('../public/assets/factory/', import.meta.url),
);
await mkdir(output, { recursive: true });
scene.traverse((node) => {
  if (node instanceof Mesh) {
    const uv = node.geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++)
      uv.setXY(
        i,
        Math.max(0.002, Math.min(0.998, uv.getX(i))),
        Math.max(0.002, Math.min(0.998, uv.getY(i))),
      );
  }
});
const bytes = await new GLTFExporter().parseAsync(scene, {
  binary: true,
  onlyVisible: true,
});
const raw = fileURLToPath(
  new URL('./.cache/props-source.glb', import.meta.url),
);
await writeFile(raw, new Uint8Array(bytes));
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const document = await io.read(raw);
await document.transform(
  dedup(),
  weld(),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);
await io.write(output + 'props.glb', document);
console.log('Built meshopt factory props.');
