import { ExtrudeGeometry, Group, Mesh, Shape } from 'three';
import { palette, Resources } from './resources.js';
import { makeLabel } from './labels.js';
import type { Label } from './labels.js';

export interface Prop {
  at: readonly [number, number];
  symbol: string;
  root: Group;
  moving?: Group;
  blade?: Mesh;
  glow?: Mesh;
  amount: number;
  active: boolean;
  seen: boolean;
}
export function makeProp(
  symbol: string,
  x: number,
  z: number,
  r: Resources,
  labels: Label[],
): Prop {
  const root = new Group();
  root.position.set(x, 0, z);
  const prop: Prop = {
    at: [x, z],
    symbol,
    root,
    amount: 0,
    active: false,
    seen: false,
  };
  const metal = r.toon(palette.steel);
  const ink = r.toon(palette.ink);
  const yellow = r.toon(palette.yellow);
  if (symbol === 'S') {
    root.add(r.mesh(r.bevel(0.96, 0.11, 0.32), ink, 0, 0.025, 0));
    for (const side of [-1, 1])
      root.add(
        r.mesh(r.bevel(0.95, 0.08, 0.07, 0.018), metal, 0, 0.1, side * 0.18),
      );
    const shape = new Shape();
    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * Math.PI * 2;
      const radius = i % 3 === 0 ? 0.4 : i % 3 === 1 ? 0.35 : 0.3;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();
    const geometry = r.geometry('saw', () => {
      const g = new ExtrudeGeometry(shape, {
        depth: 0.055,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1,
      });
      g.center();
      return g;
    });
    const moving = new Group();
    moving.position.y = 0.28;
    const blade = r.mesh(geometry, metal);
    moving.add(blade);
    const hub = r.mesh(r.cylinder(0.085, 0.08, 12), ink);
    hub.rotation.x = Math.PI / 2;
    moving.add(hub);
    const shine = r.mesh(r.torus(0.18, 0.018), r.toon(0xe7efeb), 0, 0, 0.04);
    moving.add(shine);
    const glow = r.mesh(
      r.bevel(0.85, 0.014, 0.5),
      r.basic(0xff3d31, 0.5),
      0,
      0.105,
      0,
    );
    glow.castShadow = false;
    glow.visible = false;
    root.add(glow, moving);
    prop.blade = blade;
    prop.moving = moving;
    prop.glow = glow;
    for (const side of [-1, 1])
      root.add(
        r.mesh(
          r.sphere(0.045, 8, 6),
          r.toon(0xea5d36, 0xff3422, 0.4),
          side * 0.42,
          0.13,
          0.23,
        ),
      );
  } else if (symbol === 'C') {
    const bowl = r.mesh(
      r.cylinder(0.29, 0.24, 10),
      r.toon(0xb58953),
      0,
      0.14,
      0,
    );
    root.add(bowl);
    const rim = r.mesh(r.torus(0.3, 0.04), yellow, 0, 0.27, 0);
    rim.rotation.x = Math.PI / 2;
    root.add(rim);
    for (let i = 0; i < 8; i++)
      root.add(
        r.mesh(
          r.box(0.035, 0.22, 0.035),
          r.toon(0xe1bd7e),
          Math.cos((i * Math.PI) / 4) * 0.29,
          0.14,
          Math.sin((i * Math.PI) / 4) * 0.29,
        ),
      );
    root.add(
      r.mesh(r.cylinder(0.018, 0.7, 6), ink, -0.3, 0.4, -0.23),
      r.mesh(r.box(0.27, 0.17, 0.025), r.toon(0x4eb8c7), -0.18, 0.68, -0.23),
    );
  } else if (symbol === 'k') {
    const moving = new Group();
    moving.add(
      r.mesh(r.bevel(0.42, 0.045, 0.29, 0.015), yellow),
      r.mesh(r.box(0.3, 0.012, 0.035), ink, 0, 0.03, -0.07),
      r.mesh(
        r.bevel(0.1, 0.015, 0.09, 0.008),
        r.toon(0xffe69a),
        -0.09,
        0.035,
        0.045,
      ),
    );
    root.add(moving);
    prop.moving = moving;
  } else if (symbol === 'D') {
    const moving = new Group();
    moving.add(r.mesh(r.bevel(0.77, 0.95, 0.16), r.toon(0xc57958), 0, 0.5, 0));
    for (let i = 0; i < 5; i++)
      moving.add(
        r.mesh(r.box(0.75, 0.024, 0.025), ink, 0, 0.15 + i * 0.17, 0.1),
      );
    moving.add(r.mesh(r.bevel(0.17, 0.2, 0.055, 0.025), yellow, 0, 0.55, 0.12));
    for (const side of [-1, 1])
      root.add(r.mesh(r.bevel(0.12, 1.12, 0.24), metal, side * 0.45, 0.56, 0));
    root.add(r.mesh(r.bevel(1.02, 0.14, 0.28), ink, 0, 1.13, 0), moving);
    prop.moving = moving;
  } else if (symbol === 'E') {
    root.add(r.mesh(r.cylinder(0.3, 0.035, 18), r.toon(0x143b38), 0, 0.025, 0));
    const ring = r.mesh(
      r.torus(0.32, 0.065),
      r.toon(0x6ce0ab, 0x48d9a3, 0.55),
      0,
      0.1,
      0,
    );
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
    const back = r.mesh(
      r.bevel(0.78, 0.4, 0.23),
      r.toon(0x5a9f8a),
      0,
      0.23,
      -0.31,
    );
    root.add(back);
    for (const side of [-1, 1])
      root.add(
        r.mesh(r.bevel(0.09, 0.22, 0.55), metal, side * 0.32, 0.12, 0.12),
      );
    const ramp = r.mesh(r.bevel(0.56, 0.05, 0.5), metal, 0, 0.03, 0.28);
    ramp.rotation.x = 0.18;
    root.add(ramp);
    const label = makeLabel('EXIT ↓', '#20644b', 0.92);
    label.sprite.position.set(0, 0.72, -0.12);
    labels.push(label);
    root.add(label.sprite);
    const glow = r.mesh(
      r.cylinder(0.42, 0.005, 24),
      r.basic(0x7ee6b5, 0.18),
      0,
      0.012,
      0,
    );
    glow.castShadow = false;
    root.add(glow);
    prop.glow = glow;
  } else if (symbol === 'L') {
    root.add(r.mesh(r.bevel(0.44, 0.19, 0.37), metal, 0, 0.12, 0));
    const moving = new Group();
    const rod = r.mesh(r.cylinder(0.028, 0.42, 6), ink, 0, 0.21, 0);
    moving.add(rod, r.mesh(r.sphere(0.1, 10, 8), r.toon(0xdb6940), 0, 0.43, 0));
    moving.position.y = 0.2;
    moving.rotation.z = -0.5;
    root.add(moving);
    prop.moving = moving;
  } else if (symbol === 'G') {
    const moving = new Group();
    const geometry = r.geometry('golden-chip', () => {
      const g = r.cylinder(0.23, 0.045, 16).clone();
      const positions = g.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const wave = 1 + Math.sin(Math.atan2(z, x) * 7) * 0.07;
        positions.setXYZ(
          i,
          x * wave,
          positions.getY(i) + Math.sin(x * 12) * 0.027,
          z * wave,
        );
      }
      g.computeVertexNormals();
      return g;
    });
    moving.add(r.mesh(geometry, r.toon(0xffcf4d, 0xeb9e24, 0.18)));
    for (let i = 0; i < 3; i++)
      moving.add(
        r.mesh(
          r.box(0.27, 0.008, 0.018),
          r.toon(0xe5a92e),
          0,
          0.035,
          (i - 1) * 0.08,
        ),
      );
    root.add(moving);
    prop.moving = moving;
  }
  return prop;
}
