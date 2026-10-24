import { Group } from 'three';
import type { Button } from '@spud-squad/shared';
import { COLORS } from '../../dom.js';
import { makeLabel } from './labels.js';
import type { Label } from './labels.js';
import type { Resources } from './resources.js';

interface Hand {
  group: Group;
  born: number;
  dx: number;
  dz: number;
}
export class PressHands3D {
  readonly root = new Group();
  private hands: Hand[] = [];
  private labels = new Map<string, Label>();
  constructor(private readonly r: Resources) {}
  add(name: string, color: number, button: Button, now: number): void {
    if (this.hands.length >= 3) this.remove(this.hands.shift()!);
    const group = new Group();
    const material = this.r.toon(COLORS[color] ?? COLORS[0]!);
    const palm = this.r.mesh(
      this.r.bevel(0.18, 0.16, 0.09, 0.025),
      material,
      0,
      0.04,
      0,
    );
    group.add(palm);
    for (let i = 0; i < 4; i++) {
      const finger = this.r.mesh(
        this.r.cylinder(0.022, 0.13 + (i % 2) * 0.025),
        material,
        (i - 1.5) * 0.046,
        0.17,
        0,
      );
      group.add(
        finger,
        this.r.mesh(
          this.r.sphere(0.022, 8, 6),
          material,
          (i - 1.5) * 0.046,
          0.235 + (i % 2) * 0.025,
          0,
        ),
      );
    }
    const thumb = this.r.mesh(
      this.r.bevel(0.07, 0.12, 0.08, 0.02),
      material,
      -0.12,
      0.07,
      0,
    );
    thumb.rotation.z = -0.5;
    group.add(thumb);
    const direction =
      button === 'RIGHT'
        ? [-1, 0]
        : button === 'LEFT'
          ? [1, 0]
          : button === 'UP'
            ? [0, 1]
            : [0, -1];
    const dx = direction[0]!;
    const dz = direction[1]!;
    group.rotation.z = dx * -0.65;
    const labelKey = `${color}:${name}`;
    let label = this.labels.get(labelKey);
    if (!label) {
      label = makeLabel(name, COLORS[color] ?? COLORS[0]!, 1.7);
      this.labels.set(labelKey, label);
    }
    const sprite = label.sprite.clone();
    sprite.position.y = 0.3;
    group.add(sprite);
    group.traverse((node) => {
      node.castShadow = false;
    });
    this.root.add(group);
    this.hands.push({
      group,
      born: now,
      dx,
      dz,
    });
  }
  frame(now: number, reduced: boolean, x: number, z: number): void {
    this.hands = this.hands.filter((hand) => {
      const age = now - hand.born;
      if (age > 850) {
        this.remove(hand);
        return false;
      }
      const push = reduced ? 0 : Math.max(0, 1 - age / 180) * 0.23;
      hand.group.position.set(
        x + hand.dx * (0.65 + push),
        1.05,
        z + hand.dz * (0.48 + push),
      );
      const shrink = reduced ? 1 : Math.min(1, (850 - age) / 130);
      hand.group.scale.setScalar(shrink);
      return true;
    });
  }
  private remove(hand: Hand): void {
    this.root.remove(hand.group);
    hand.group.clear();
  }
  clear(): void {
    for (const hand of this.hands) this.remove(hand);
    this.hands = [];
    for (const label of this.labels.values()) label.dispose();
    this.labels.clear();
  }
}
