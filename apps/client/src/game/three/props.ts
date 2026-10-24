import { ExtrudeGeometry, Group, Shape } from 'three';
import type { Mesh } from 'three';
import { palette, Resources } from './resources.js';

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
function arrowGeometry(r: Resources) {
  return r.geometry('exit-arrow', () => {
    const shape = new Shape()
      .moveTo(-0.12, 0.32)
      .lineTo(0.12, 0.32)
      .lineTo(0.12, 0.02)
      .lineTo(0.29, 0.02)
      .lineTo(0, -0.28)
      .lineTo(-0.29, 0.02)
      .lineTo(-0.12, 0.02)
      .closePath();
    const g = new ExtrudeGeometry(shape, {
      depth: 0.065,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 1,
    });
    g.center();
    return g;
  });
}
export function makeProp(
  symbol: string,
  x: number,
  z: number,
  r: Resources,
): Prop {
  const root = new Group();
  root.position.set(x, 0.04, z);
  const prop: Prop = {
    at: [x, z],
    symbol,
    root,
    amount: 0,
    active: false,
    seen: false,
  };
  const steel = r.toon(palette.steel);
  const ink = r.toon(palette.ink);
  const trim = r.toon(palette.yellow);
  if (symbol === 'S') {
    const bed = r.mesh(
      r.bevel(0.94, 0.1, 0.74, 0.05),
      r.toon(palette.danger),
      0,
      0.04,
      0,
    );
    r.silhouette(bed, 1.04);
    root.add(bed);
    root.add(
      r.mesh(r.bevel(0.86, 0.055, 0.2, 0.02), r.toon(palette.dark), 0, 0.11, 0),
    );
    const shape = new Shape();
    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * Math.PI * 2;
      const radius = i % 3 === 0 ? 0.45 : i % 3 === 1 ? 0.4 : 0.35;
      if (!i) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    shape.closePath();
    const geometry = r.geometry('saw', () => {
      const g = new ExtrudeGeometry(shape, {
        depth: 0.07,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1,
      });
      g.center();
      return g;
    });
    const moving = new Group();
    moving.position.y = 0.4;
    moving.rotation.x = -0.18;
    const blade = r.mesh(geometry, steel);
    r.silhouette(blade, 1.05);
    moving.add(blade);
    const hub = r.mesh(r.cylinder(0.1, 0.09, 12), trim, 0, 0, 0.045);
    hub.rotation.x = Math.PI / 2;
    const pin = r.mesh(r.sphere(0.043, 10, 8), ink, 0, 0, 0.1);
    moving.add(hub, pin);
    const glow = r.mesh(
      r.bevel(0.93, 0.015, 0.73, 0.025),
      r.basic(palette.danger, 0.48),
      0,
      0.11,
      0,
    );
    glow.castShadow = false;
    glow.layers.enable(1);
    glow.visible = false;
    root.add(moving, glow);
    prop.moving = moving;
    prop.blade = blade;
    prop.glow = glow;
  } else if (symbol === 'C') {
    const basket = r.mesh(
      r.cylinder(0.31, 0.18, 12),
      r.toon(0xffc476),
      0,
      0.15,
      0,
    );
    r.silhouette(basket);
    root.add(basket);
    const rim = r.mesh(r.torus(0.31, 0.045), trim, 0, 0.25, 0);
    rim.rotation.x = Math.PI / 2;
    root.add(rim);
    root.add(
      r.mesh(r.cylinder(0.29, 0.012, 12), r.toon(0xffe3a0), 0, 0.252, 0),
    );
    const flag = r.mesh(arrowGeometry(r), r.toon(0x32cbd3), -0.27, 0.56, -0.22);
    flag.scale.setScalar(0.42);
    flag.rotation.z = Math.PI;
    root.add(flag);
  } else if (symbol === 'k') {
    const moving = new Group();
    const card = r.mesh(r.bevel(0.48, 0.075, 0.34, 0.025), trim);
    r.silhouette(card);
    moving.add(card, r.mesh(r.box(0.37, 0.018, 0.05), ink, 0, 0.05, -0.08));
    moving.add(
      r.mesh(
        r.bevel(0.12, 0.018, 0.11, 0.005),
        r.toon(palette.cream),
        -0.1,
        0.05,
        0.05,
      ),
    );
    root.add(moving);
    prop.moving = moving;
  } else if (symbol === 'D') {
    const moving = new Group();
    const shutter = r.mesh(
      r.bevel(0.78, 0.58, 0.17, 0.035),
      r.toon(0xff8b6b),
      0,
      0.32,
      0,
    );
    r.silhouette(shutter);
    moving.add(shutter);
    for (let i = 0; i < 3; i++)
      moving.add(
        r.mesh(r.box(0.68, 0.025, 0.028), trim, 0, 0.17 + i * 0.17, 0.1),
      );
    for (const side of [-1, 1])
      root.add(
        r.mesh(
          r.bevel(0.1, 0.76, 0.22, 0.025),
          r.toon(palette.machine),
          side * 0.46,
          0.38,
          0,
        ),
      );
    root.add(
      r.mesh(r.bevel(1.02, 0.12, 0.26, 0.035), trim, 0, 0.78, 0),
      moving,
    );
    prop.moving = moving;
  } else if (symbol === 'E') {
    const base = r.mesh(
      r.bevel(0.85, 0.16, 0.86, 0.08),
      r.toon(palette.exit, palette.exit, 0.3),
      0,
      0.1,
      0,
    );
    r.silhouette(base, 1.04);
    root.add(base);
    root.add(
      r.mesh(
        r.bevel(0.57, 0.025, 0.6, 0.06),
        r.toon(palette.dark),
        0,
        0.193,
        0.03,
      ),
    );
    for (const side of [-1, 1])
      root.add(
        r.mesh(
          r.bevel(0.09, 0.17, 0.68, 0.03),
          r.toon(palette.exit, palette.exit, 0.35),
          side * 0.34,
          0.22,
          -0.02,
        ),
      );
    root.add(
      r.mesh(
        r.bevel(0.8, 0.24, 0.19, 0.045),
        r.toon(palette.machine),
        0,
        0.25,
        -0.37,
      ),
    );
    const arrow = r.mesh(
      arrowGeometry(r),
      r.toon(palette.exit, palette.exit, 0.65),
      0,
      0.85,
      -0.15,
    );
    arrow.rotation.x = (-62 * Math.PI) / 180;
    r.silhouette(arrow, 1.11);
    root.add(arrow);
    const glow = r.mesh(
      r.cylinder(0.48, 0.008, 24),
      r.basic(palette.exit, 0.18),
      0,
      0.05,
      0,
    );
    glow.layers.enable(1);
    glow.castShadow = false;
    root.add(glow);
    prop.glow = glow;
  } else if (symbol === 'L') {
    const base = r.mesh(r.bevel(0.5, 0.16, 0.4, 0.04), steel, 0, 0.12, 0);
    r.silhouette(base);
    root.add(base);
    const moving = new Group();
    const rod = r.mesh(r.cylinder(0.035, 0.36, 8), ink, 0, 0.18, 0);
    const knob = r.mesh(
      r.sphere(0.12, 12, 10),
      r.toon(palette.danger),
      0,
      0.4,
      0,
    );
    r.silhouette(knob);
    moving.add(rod, knob);
    moving.position.y = 0.16;
    moving.rotation.z = -0.5;
    root.add(moving);
    prop.moving = moving;
  } else if (symbol === 'G') {
    const moving = new Group();
    const geometry = r.geometry('golden-chip', () => {
      const g = r.cylinder(0.29, 0.075, 20).clone();
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const wave = 1 + Math.sin(Math.atan2(z, x) * 7) * 0.05;
        p.setXYZ(i, x * wave, p.getY(i) + Math.sin(x * 12) * 0.025, z * wave);
      }
      g.rotateX(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    });
    const chip = r.mesh(geometry, r.toon(palette.reward, palette.reward, 0.3));
    r.silhouette(chip, 1.07);
    moving.add(chip);
    for (let i = 0; i < 3; i++)
      moving.add(
        r.mesh(
          r.bevel(0.32, 0.025, 0.025, 0.008),
          r.toon(0xfff2a1),
          0,
          (i - 1) * 0.1,
          0.055,
        ),
      );
    const starShape = new Shape();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const radius = i % 2 ? 0.04 : 0.13;
      if (!i)
        starShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else starShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    starShape.closePath();
    const stars = r.geometry(
      'reward-star',
      () =>
        new ExtrudeGeometry(starShape, {
          depth: 0.02,
          bevelEnabled: false,
          steps: 1,
          curveSegments: 1,
        }),
    );
    for (const [sx, sy] of [
      [-0.33, 0.08],
      [0.26, 0.27],
    ]) {
      const star = r.mesh(
        stars,
        r.toon(palette.reward, palette.reward, 0.3),
        sx,
        sy,
        0.08,
      );
      moving.add(star);
    }
    root.add(moving);
    prop.moving = moving;
  }
  return prop;
}
