import { Color, Float32BufferAttribute, Group, Mesh } from 'three';
import type { Direction } from '@spud-squad/shared';
import { noise, Resources } from './resources.js';

export class SpudModel {
  readonly root = new Group();
  readonly body = new Group();
  private eyes = new Group();
  private pupils = new Group();
  private brows: Mesh[] = [];
  private legs: Group[] = [];
  private fries = new Group();
  private sticks: Mesh[] = [];
  private sad = new Group();
  private deathTime = -10_000;
  private popTime = -10_000;
  private lastMove = 0;
  constructor(r: Resources) {
    const geometry = r.geometry('potato', () => {
      const geometry = r.sphere(1, 28, 18).clone();
      const positions = geometry.getAttribute('position');
      const colors: number[] = [];
      const base = new Color(0xc98a4b);
      const highlight = new Color(0xe8b07a);
      const spotColor = new Color(0x8a5a2b);
      const spots = [
        [0.67, 0.24, 0.7],
        [-0.61, -0.45, 0.66],
        [0.2, -0.64, 0.73],
        [-0.45, 0.72, 0.5],
        [0.84, -0.44, -0.1],
        [-0.2, 0.3, -0.95],
      ];
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const bump = 1 + noise(x, y, z);
        positions.setXYZ(
          i,
          x * 0.365 * bump * (1 + y * 0.06),
          y * 0.465 * bump,
          z * 0.315 * bump,
        );
        const spot = spots.some(
          ([sx, sy, sz]) =>
            (x - sx!) ** 2 + (y - sy!) ** 2 + (z - sz!) ** 2 < 0.038,
        );
        const color = spot
          ? spotColor
          : base.clone().lerp(highlight, Math.max(0, y * 0.3 + z * 0.12));
        colors.push(color.r, color.g, color.b);
      }
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      return geometry;
    });
    const skin = r.toon(0xffffff, 0xc98a4b, 0.025);
    skin.vertexColors = true;
    const potato = r.mesh(geometry, skin, 0, 0.65, 0);
    const outline = r.mesh(geometry, r.outline(), 0, 0.65, 0);
    outline.scale.setScalar(1.055);
    outline.castShadow = false;
    this.body.add(outline, potato);
    for (const x of [-0.135, 0.135]) {
      const white = r.mesh(
        r.sphere(0.128, 16, 12),
        r.toon(0xffffff),
        x,
        0.875,
        0.255,
      );
      white.scale.set(0.9, 1.12, 0.83);
      this.eyes.add(white);
      const pupil = r.mesh(
        r.sphere(0.047, 12, 8),
        r.toon(0x172d33),
        x,
        0.915,
        0.363,
      );
      pupil.scale.set(0.85, 1, 0.65);
      this.pupils.add(pupil);
      const glint = r.mesh(
        r.sphere(0.015, 8, 6),
        r.basic(0xffffff),
        x - 0.01,
        0.936,
        0.39,
      );
      this.pupils.add(glint);
      const brow = r.mesh(
        r.torus(0.1, 0.018, Math.PI * 0.85),
        r.toon(0x533c30),
        x,
        1.03,
        0.255,
      );
      brow.rotation.z = x < 0 ? 0.15 : -0.05;
      this.brows.push(brow);
      this.body.add(brow);
      const leg = new Group();
      leg.position.set(x, 0.16, 0);
      const stub = r.mesh(
        r.cylinder(0.052, 0.13),
        r.toon(0x875b3c),
        0,
        -0.045,
        0,
      );
      const foot = r.mesh(
        r.bevel(0.13, 0.075, 0.19, 0.025),
        r.toon(0x684a35),
        0,
        -0.115,
        0.035,
      );
      leg.add(stub, foot);
      this.body.add(leg);
      this.legs.push(leg);
    }
    this.body.add(this.eyes, this.pupils);
    const mouth = r.mesh(
      r.sphere(0.042, 10, 8),
      r.toon(0x65432f),
      0.01,
      0.665,
      0.31,
    );
    mouth.scale.set(0.7, 1.1, 0.5);
    this.body.add(mouth);
    const sweat = new Group();
    const drop = r.mesh(
      r.sphere(0.046, 8, 6),
      r.toon(0x7fdae2),
      0.31,
      0.91,
      0.1,
    );
    drop.scale.set(0.72, 1.3, 0.65);
    sweat.add(drop);
    this.body.add(sweat);
    for (let i = 0; i < 9; i++) {
      const fry = r.mesh(
        r.bevel(0.088, 0.39 + (i % 3) * 0.025, 0.083, 0.015),
        r.toon(i % 2 ? 0xffd466 : 0xf0b73b),
      );
      this.sticks.push(fry);
      this.fries.add(fry);
    }
    const face = r.mesh(r.sphere(0.15, 12, 8), r.toon(0xffe29a), 0, 0.19, 0.17);
    face.scale.set(1, 0.75, 0.35);
    this.sad.add(face);
    for (const x of [-0.055, 0.055])
      this.sad.add(
        r.mesh(r.sphere(0.018, 8, 6), r.basic(0x65432f), x, 0.22, 0.228),
      );
    const frown = r.mesh(
      r.torus(0.045, 0.009, Math.PI),
      r.toon(0x65432f),
      0,
      0.13,
      0.232,
    );
    this.sad.add(frown);
    this.fries.add(this.sad);
    this.fries.visible = false;
    const shadow = r.softShadow(0.9, 0.65, 0.25);
    shadow.position.y = 0.005;
    this.root.add(shadow, this.body, this.fries);
  }
  die(time: number): void {
    this.deathTime = time;
  }
  respawn(time: number): void {
    this.popTime = time;
  }
  frame(
    now: number,
    hop: number,
    facing: Direction,
    panic: boolean,
    dead: boolean,
    reduced: boolean,
  ): void {
    this.body.visible = !dead;
    this.fries.visible = dead;
    if (dead) {
      this.death(now, reduced);
      return;
    }
    if (hop > 0) this.lastMove = now;
    const idle = now - this.lastMove > 1300;
    const blinkPhase = (now + 930) % 4700;
    const blink = !reduced && blinkPhase < 120 ? 0.08 : 1;
    for (const eye of this.eyes.children)
      eye.scale.y = 1.12 * blink * (panic ? 1.15 : 1);
    const gazeX = facing === 'LEFT' ? -0.042 : facing === 'RIGHT' ? 0.042 : 0;
    const gazeY = facing === 'UP' ? 0.035 : facing === 'DOWN' ? -0.027 : 0;
    this.pupils.position.set(
      idle ? Math.sin(now / 1800) * 0.01 : gazeX,
      idle ? 0.008 : gazeY,
      0,
    );
    for (const pupil of this.pupils.children) pupil.scale.y = blink;
    for (const [i, brow] of this.brows.entries()) {
      brow.position.y = panic ? 1.09 : 1.03;
      brow.rotation.z = panic ? (i ? 0.12 : -0.12) : i ? -0.05 : 0.15;
    }
    const pop = reduced ? 0 : Math.max(0, 1 - (now - this.popTime) / 340);
    const stretch = reduced ? 0 : Math.sin(hop * Math.PI) * 0.13;
    this.body.scale.set(
      1 - stretch * 0.8 + pop * 0.2,
      1 + stretch - pop * 0.45,
      1 - stretch * 0.6 + pop * 0.2,
    );
    this.body.position.y = reduced
      ? 0
      : Math.sin(hop * Math.PI) * 0.17 +
        (idle ? Math.sin(now / 420) * 0.008 : 0);
    this.body.rotation.z = reduced
      ? 0
      : panic
        ? Math.sin(now / 48) * 0.035
        : Math.sin(hop * Math.PI * 2) * 0.045;
    for (let i = 0; i < this.legs.length; i++)
      this.legs[i]!.rotation.x = reduced
        ? 0
        : Math.sin(hop * Math.PI * 2 + i * Math.PI) * 0.6;
  }
  private death(now: number, reduced: boolean): void {
    const age = Math.max(0, (now - this.deathTime) / 1000);
    for (let i = 0; i < this.sticks.length; i++) {
      const stick = this.sticks[i]!;
      const angle = i * 2.39996;
      const travel = reduced ? 1 : Math.min(1, age / 0.8);
      const height = reduced
        ? 0
        : age < 0.65
          ? Math.max(0, 0.4 + (1.7 + (i % 3) * 0.15) * age - 4.8 * age * age)
          : Math.max(
              0,
              Math.sin(Math.min(1, (age - 0.65) / 0.35) * Math.PI) * 0.12,
            );
      stick.position.set(
        Math.cos(angle) * (0.1 + (i % 3) * 0.065) * travel,
        0.075 + height + (i % 2) * 0.025,
        Math.sin(angle) * (0.12 + (i % 4) * 0.035) * travel,
      );
      const settle = reduced ? 1 : Math.min(1, age / 0.95);
      stick.rotation.set(
        (Math.PI / 2) * settle,
        angle + (1 - settle) * age * 6,
        ((i % 3) - 1) * 0.4,
      );
    }
    this.sad.visible = reduced || age > 0.55;
  }
}
