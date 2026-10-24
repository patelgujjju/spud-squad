import { Container, Graphics, Text } from 'pixi.js';
import type { Button } from '@spud-squad/shared';
import { COLORS } from '../dom.js';

interface Hand {
  node: Container;
  born: number;
  dx: number;
  dy: number;
  x: number;
  y: number;
}
export class PressHands {
  readonly node = new Container();
  private hands: Hand[] = [];
  add(
    name: string,
    color: number,
    button: Button,
    now: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    while (this.hands.length >= 3)
      this.hands.shift()!.node.destroy({ children: true });
    const direction =
      button === 'RIGHT'
        ? [-1, 0]
        : button === 'LEFT'
          ? [1, 0]
          : button === 'UP'
            ? [0, 1]
            : [0, -1];
    const dx = direction[0]!;
    const dy = direction[1]!;
    const node = new Container();
    const hand = new Graphics();
    const tint = Number.parseInt(COLORS[color]!.slice(1), 16);
    hand
      .roundRect(-9, -4, 18, 16, 5)
      .fill(tint)
      .stroke({ color: 0x173c40, width: 1.5 });
    [-7, -2, 3, 8].forEach((finger, i) =>
      hand.roundRect(finger - 2, -16 - (i % 2) * 3, 4, 17, 2).fill(tint),
    );
    hand.rotation = Math.atan2(-dy, -dx) + Math.PI / 2;
    const label = new Text({
      text: name,
      style: {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: tint,
        stroke: { color: 0xfff7df, width: 4 },
        wordWrap: true,
        wordWrapWidth: 150,
        breakWords: true,
        lineHeight: 16,
      },
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, 17);
    node.addChild(hand, label);
    this.node.addChild(node);
    this.hands.push({
      node,
      born: now,
      dx,
      dy,
      x: Math.max(85, Math.min(width - 85, x + dx * 58)),
      y: Math.max(23, Math.min(height - 60, y + dy * 50)),
    });
  }
  frame(now: number, reduced: boolean): void {
    this.hands = this.hands.filter((hand) => {
      const age = now - hand.born;
      if (age > 800) {
        hand.node.destroy({ children: true });
        return false;
      }
      const slide = reduced ? 0 : (1 - Math.min(1, age / 150)) * 12;
      hand.node.position.set(
        hand.x + hand.dx * slide,
        hand.y + hand.dy * slide,
      );
      hand.node.alpha = reduced ? 1 : Math.min(1, (800 - age) / 200);
      return true;
    });
  }
}
