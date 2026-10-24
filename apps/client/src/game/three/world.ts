import {
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  Shape,
  Vector3,
} from 'three';
import type { BufferGeometry, Color, Material } from 'three';
import { slicerAt } from '@spud-squad/shared';
import type { Level, SpudView } from '@spud-squad/shared';
import { palette, Resources } from './resources.js';
import { makeProp } from './props.js';
import type { Prop } from './props.js';
import type { FactoryParticles } from './particles.js';

interface Batch {
  geometry: BufferGeometry;
  material: Material;
  matrices: Matrix4[];
  colors: (Color | null)[];
  cast: boolean;
}
class Batches {
  private batches = new Map<string, Batch>();
  private dummy = new Object3D();
  add(
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    color: Color | null = null,
    cast = true,
  ): void {
    const key = `${geometry.uuid}:${material.uuid}:${cast}`;
    if (!this.batches.has(key))
      this.batches.set(key, {
        geometry,
        material,
        matrices: [],
        colors: [],
        cast,
      });
    const batch = this.batches.get(key)!;
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(rx, ry, rz);
    this.dummy.updateMatrix();
    batch.matrices.push(this.dummy.matrix.clone());
    batch.colors.push(color);
  }
  finish(root: Group): void {
    for (const batch of this.batches.values()) {
      const mesh = new InstancedMesh(
        batch.geometry,
        batch.material,
        batch.matrices.length,
      );
      batch.matrices.forEach((matrix, index) => {
        mesh.setMatrixAt(index, matrix);
        const color = batch.colors[index];
        if (color) mesh.setColorAt(index, color);
      });
      mesh.castShadow = batch.cast;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
  }
}
interface Belt {
  x: number;
  z: number;
  yaw: number;
}
export class FactoryWorld {
  readonly root = new Group();
  readonly props: Prop[] = [];
  private belts: Belt[] = [];
  private rollers: InstancedMesh;
  private arrows: InstancedMesh;
  private dummy = new Object3D();
  private sparkleAt = 0;
  private counterCount = 0;
  private particlePoint = new Vector3();
  constructor(
    readonly level: Level,
    private readonly r: Resources,
  ) {
    const batches = new Batches();
    const width = level.map[0]!.length;
    const depth = level.map.length;
    const centerX = (width - 1) / 2;
    const centerZ = (depth - 1) / 2;
    this.root.add(
      r.mesh(
        r.bevel(width + 0.32, 0.6, depth + 0.32, 0.14),
        r.toon(palette.machine),
        centerX,
        -0.34,
        centerZ,
      ),
    );
    this.root.add(
      r.mesh(
        r.bevel(width + 0.34, 0.065, depth + 0.34, 0.12),
        r.toon(palette.yellow),
        centerX,
        -0.48,
        centerZ,
      ),
    );
    this.root.add(
      r.mesh(
        r.bevel(width + 0.28, 0.1, depth + 0.28, 0.11),
        r.toon(palette.grout),
        centerX,
        -0.05,
        centerZ,
      ),
    );
    const dropShadow = r.softShadow(width * 1.18, depth * 1.55, 0.34);
    dropShadow.position.set(centerX, -0.96, centerZ + 0.25);
    this.root.add(dropShadow);
    level.map.forEach((row, z) =>
      [...row].forEach((symbol, x) => {
        batches.add(
          r.bevel(0.96, 0.12, 0.96, 0.04),
          r.toon(palette.floor),
          x,
          -0.02,
          z,
          0,
          0,
          0,
          null,
          false,
        );
        if (symbol === '#') this.counter(batches, x, z);
        else {
          if ('><^v'.includes(symbol)) {
            const yaw =
              symbol === '<'
                ? Math.PI
                : symbol === '^'
                  ? Math.PI / 2
                  : symbol === 'v'
                    ? -Math.PI / 2
                    : 0;
            this.belts.push({ x, z, yaw });
            batches.add(
              r.bevel(0.98, 0.16, 0.94),
              r.toon(0x0f5e59),
              x,
              0.06,
              z,
            );
            for (const side of [-1, 1])
              batches.add(
                r.bevel(0.94, 0.1, 0.055, 0.015),
                r.toon(palette.yellow),
                x - Math.sin(yaw) * side * 0.43,
                0.18,
                z + Math.cos(yaw) * side * 0.43,
                0,
                yaw,
              );
          } else if ('ECkDLS'.includes(symbol)) {
            const prop = makeProp(symbol, x, z, r);
            if (symbol === 'D') {
              const horizontal =
                level.map[z]?.[x - 1] !== '#' && level.map[z]?.[x + 1] !== '#';
              if (horizontal) prop.root.rotation.y = Math.PI / 2;
            }
            this.props.push(prop);
            this.root.add(prop.root);
          }
        }
      }),
    );
    const chip =
      level.goldenChip ??
      level.map.flatMap((row, z) =>
        [...row].flatMap((symbol, x) =>
          symbol === 'G' ? [[x, z] as const] : [],
        ),
      )[0];
    if (chip) {
      const prop = makeProp('G', chip[0], chip[1], r);
      this.props.push(prop);
      this.root.add(prop.root);
    }
    batches.finish(this.root);
    const rollerGeometry = r.geometry('roller', () => {
      const geometry = r.cylinder(0.058, 0.79, 8).clone();
      const positions = geometry.getAttribute('position');
      const colors: number[] = [];
      for (let i = 0; i < positions.count; i++) {
        const c = positions.getX(i) > 0 ? 0.73 : 0.45;
        colors.push(c, c + 0.04, c + 0.03);
      }
      // The shared geometry is used only by the roller material.
      return geometry.setAttribute(
        'color',
        new Float32BufferAttribute(colors, 3),
      );
    });
    const rollerMaterial = r.toon(0xfefefe);
    rollerMaterial.vertexColors = true;
    this.rollers = new InstancedMesh(
      rollerGeometry,
      rollerMaterial,
      this.belts.length * 7,
    );
    this.rollers.castShadow = false;
    this.rollers.receiveShadow = true;
    this.rollers.frustumCulled = false;
    const arrowGeometry = r.geometry('arrow', () => {
      const shape = new Shape()
        .moveTo(0.17, 0)
        .lineTo(-0.02, -0.12)
        .lineTo(-0.02, -0.05)
        .lineTo(-0.16, -0.05)
        .lineTo(-0.16, 0.05)
        .lineTo(-0.02, 0.05)
        .lineTo(-0.02, 0.12)
        .closePath();
      const geometry = new ExtrudeGeometry(shape, {
        depth: 0.018,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1,
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.center();
      return geometry;
    });
    this.arrows = new InstancedMesh(
      arrowGeometry,
      r.toon(0xffffff),
      this.belts.length * 2,
    );
    this.arrows.castShadow = false;
    this.arrows.frustumCulled = false;
    this.root.add(this.rollers, this.arrows);
  }
  private counter(b: Batches, x: number, z: number): void {
    const r = this.r;
    // Baked dark foot/corners keep the path legible even with shadows disabled.
    b.add(r.bevel(0.94, 0.06, 0.94, 0.04), r.toon(palette.dark), x, 0.07, z);
    b.add(
      r.bevel(0.92, 0.22, 0.92, 0.065),
      r.toon(palette.machine),
      x,
      0.18,
      z,
    );
    b.add(r.bevel(0.97, 0.05, 0.97, 0.025), r.toon(palette.yellow), x, 0.3, z);
    b.add(
      r.bevel(0.86, 0.015, 0.86, 0.006),
      r.toon(palette.machine),
      x,
      0.3275,
      z,
    );
    // One low bolt panel per six counters. No path decorations or repeated pipes.
    if (++this.counterCount % 6 === 0) {
      b.add(
        r.bevel(0.23, 0.009, 0.17, 0.003),
        r.toon(palette.dark),
        x + 0.16,
        0.3395,
        z - 0.15,
      );
      for (const dx of [-0.07, 0.07])
        b.add(
          r.sphere(0.012, 6, 4),
          r.toon(palette.steel),
          x + 0.16 + dx,
          0.337,
          z - 0.15,
          0,
          0,
          0,
          null,
          false,
        );
    }
  }
  frame(
    state: SpudView,
    now: number,
    dt: number,
    factor: number,
    reduced: boolean,
    particles: FactoryParticles,
    whoosh: () => void,
  ): void {
    for (const prop of this.props) {
      const key = prop.at.join(',');
      const toggled = state.toggledDevices.includes(key);
      if (prop.symbol === 'S') {
        const slicer = this.level.objects.find(
          (object) =>
            object.type === 'slicer' &&
            object.at[0] === prop.at[0] &&
            object.at[1] === prop.at[1],
        );
        if (slicer?.type !== 'slicer') continue;
        const phase = slicerAt(slicer, Math.floor(now), factor, !toggled);
        if (prop.seen && phase.active && !prop.active) whoosh();
        prop.active = phase.active;
        prop.seen = true;
        const rise = phase.active ? 0.38 : phase.warning ? 0.15 : -0.24;
        prop.moving!.position.y +=
          (rise - prop.moving!.position.y) *
          (reduced ? 1 : 1 - Math.exp(-dt * 17));
        prop.moving!.position.x =
          !reduced && phase.warning ? Math.sin(now / 20) * 0.012 : 0;
        prop.moving!.rotation.z = !reduced && phase.active ? now / 85 : 0;
        prop.blade!.material = phase.warning
          ? this.r.toon(palette.danger, palette.danger, 1.0)
          : this.r.toon(palette.steel);
        prop.blade!.layers.set(0);
        if (phase.warning) prop.blade!.layers.enable(1);
        prop.glow!.visible = phase.warning || phase.active;
      } else if (prop.symbol === 'k' || prop.symbol === 'G') {
        prop.root.visible =
          prop.symbol === 'k'
            ? !state.collectedKeys.includes(key)
            : !state.goldenChip;
        if (prop.moving) {
          prop.moving.position.y =
            0.44 + (reduced ? 0 : Math.sin(now / 380 + prop.at[0]) * 0.055);
          prop.moving.rotation.set(
            prop.symbol === 'G' ? (-62 * Math.PI) / 180 : 0,
            prop.symbol === 'G'
              ? reduced
                ? 0
                : Math.sin(now / 700) * 0.12
              : reduced
                ? 0
                : now / 900,
            prop.symbol === 'G' ? (reduced ? 0.2 : now / 1200) : 0,
          );
        }
      } else if (prop.symbol === 'D') {
        const open = state.unlockedDoors.includes(key) !== toggled;
        prop.amount +=
          ((open ? 1 : 0) - prop.amount) *
          (reduced ? 1 : 1 - Math.exp(-dt * 13));
        prop.moving!.scale.y = Math.max(0.01, 1 - prop.amount);
        prop.moving!.position.y = prop.amount * 1.02;
      } else if (prop.symbol === 'L')
        prop.moving!.rotation.z = toggled ? 0.5 : -0.5;
      if (prop.symbol === 'E' && prop.glow)
        prop.glow.scale.setScalar(reduced ? 1 : 1 + Math.sin(now / 400) * 0.05);
    }
    this.belts.forEach((belt, index) => {
      const enabled = !state.toggledDevices.includes(`${belt.x},${belt.z}`);
      for (let i = 0; i < 7; i++) {
        const offset = (i - 3) * 0.12;
        this.dummy.position.set(
          belt.x + Math.cos(belt.yaw) * offset,
          0.19,
          belt.z - Math.sin(belt.yaw) * offset,
        );
        this.dummy.rotation.set(0, belt.yaw, 0);
        this.dummy.rotateX(Math.PI / 2);
        if (!reduced && enabled) this.dummy.rotateY(now / 100);
        this.dummy.updateMatrix();
        this.rollers.setMatrixAt(index * 7 + i, this.dummy.matrix);
      }
      for (let i = 0; i < 2; i++) {
        const offset =
          ((i * 0.5 + (!reduced && enabled ? now / 1800 : 0)) % 1) - 0.5;
        this.dummy.position.set(
          belt.x + Math.cos(belt.yaw) * offset * 0.7,
          0.262,
          belt.z - Math.sin(belt.yaw) * offset * 0.7,
        );
        this.dummy.rotation.set(0, belt.yaw, 0);
        this.dummy.updateMatrix();
        this.arrows.setMatrixAt(index * 2 + i, this.dummy.matrix);
      }
    });
    this.rollers.instanceMatrix.needsUpdate = true;
    this.arrows.instanceMatrix.needsUpdate = true;
    if (!reduced && now > this.sparkleAt) {
      this.sparkleAt = now + 550;
      for (const chip of this.props)
        if (chip.symbol === 'G' && chip.root.visible)
          particles.burst(
            'chip',
            this.particlePoint.set(chip.at[0], 0.5, chip.at[1]),
            3,
          );
    }
  }
  dispose(): void {
    this.root.traverse((node) => {
      if (node instanceof InstancedMesh) node.dispose();
    });
    this.root.clear();
  }
}
