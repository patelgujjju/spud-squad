import { Container, Graphics } from 'pixi.js';
import type { Level, SpudView } from '@spud-squad/shared';

export const TILE = 64;
const INK = 0x27454a;
export interface Device {
  at: readonly [number, number];
  symbol: string;
  node: Container;
  blade?: Graphics;
  warning?: Graphics;
  enabled: boolean;
  active: boolean;
  phase: string;
}
export function makeBoard(level: Level): {
  node: Container;
  devices: Device[];
} {
  const node = new Container();
  const ground = new Graphics();
  const devices: Device[] = [];
  node.addChild(ground);
  level.map.forEach((row, y) =>
    [...row].forEach((symbol, x) => {
      const px = x * TILE;
      const py = y * TILE;
      ground
        .roundRect(px + 1, py + 1, 62, 62, 5)
        .fill(symbol === '#' ? 0x31565b : 0xc7ddd2);
      if (symbol === '#') {
        ground
          .moveTo(px + 10, py + 14)
          .lineTo(px + 48, py + 14)
          .stroke({ color: 0x41666a, width: 3 });
        ground
          .circle(px + 10, py + 50, 2)
          .circle(px + 52, py + 50, 2)
          .fill(0x23464b);
        return;
      }
      ground
        .moveTo(px + 6, py + 59)
        .lineTo(px + 58, py + 59)
        .stroke({ color: 0xb0c8be, width: 2 });
      if (symbol === '.') return;
      const decoration = new Container();
      decoration.position.set(px + 32, py + 32);
      const g = new Graphics();
      decoration.addChild(g);
      node.addChild(decoration);
      if (symbol === 'E') {
        g.roundRect(-26, -26, 52, 52, 8)
          .fill(0x73b682)
          .stroke({ color: INK, width: 3 });
        g.roundRect(-19, -15, 38, 16, 5).fill(0x254c42);
        g.moveTo(0, 3)
          .lineTo(0, 21)
          .moveTo(-8, 13)
          .lineTo(0, 21)
          .lineTo(8, 13)
          .stroke({ color: 0xf7f2c9, width: 5 });
      } else if (symbol === 'C') {
        g.roundRect(-23, -6, 46, 26, 6)
          .fill(0xad8056)
          .stroke({ color: INK, width: 3 });
        [-13, 0, 13].forEach((a) =>
          g.moveTo(a, -4).lineTo(a, 17).stroke({ color: 0xe4bb82, width: 3 }),
        );
        g.moveTo(-16, -22).lineTo(-16, -2).stroke({ color: INK, width: 3 });
        g.poly([-14, -24, 11, -24, 5, -14, -14, -14]).fill(0x53bdc4);
      } else if (symbol === 'k') {
        g.roundRect(-18, -12, 36, 24, 4)
          .fill(0xf4c94d)
          .stroke({ color: INK, width: 3 });
        g.circle(-8, -2, 4).fill(INK);
        g.rect(2, -4, 11, 4).fill(0xffedab);
      } else if (symbol === 'D') {
        g.roundRect(-26, -27, 52, 54, 4)
          .fill(0xcd8766)
          .stroke({ color: INK, width: 3 });
        [-15, 0, 15].forEach((a) =>
          g.moveTo(-23, a).lineTo(23, a).stroke({ color: INK, width: 3 }),
        );
        g.circle(0, -1, 7).fill(0xffd25b).stroke({ color: INK, width: 2 });
      } else if (symbol === 'L') {
        g.roundRect(-18, 4, 36, 16, 4)
          .fill(0x829296)
          .stroke({ color: INK, width: 3 });
        g.moveTo(0, 8).lineTo(12, -17).stroke({ color: INK, width: 7 });
        g.circle(12, -17, 9).fill(0xe98142).stroke({ color: INK, width: 3 });
      } else if ('><^v'.includes(symbol)) {
        g.roundRect(-28, -24, 56, 48, 4)
          .fill(0x7d9b98)
          .stroke({ color: INK, width: 2 });
        for (const a of [-17, 1, 19])
          g.moveTo(a - 6, -14)
            .lineTo(a + 5, 0)
            .lineTo(a - 6, 14)
            .stroke({ color: 0xe5f1dd, width: 6 });
        decoration.rotation =
          symbol === '<'
            ? Math.PI
            : symbol === '^'
              ? -Math.PI / 2
              : symbol === 'v'
                ? Math.PI / 2
                : 0;
      } else if (symbol === 'S') {
        g.roundRect(-28, -28, 56, 56, 5)
          .fill(0xe6bc88)
          .stroke({ color: INK, width: 2 });
        const warning = new Graphics()
          .roundRect(-28, -28, 56, 56, 5)
          .fill(0xf04448);
        warning.visible = false;
        const blade = new Graphics();
        const points: number[] = [];
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          const radius = i % 3 === 0 ? 26 : 18;
          points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        blade.poly(points).fill(0xdde3e4).stroke({ color: 0x566970, width: 2 });
        blade.circle(0, 0, 7).fill(0x60757d).circle(0, 0, 3).fill(0xaab9bc);
        decoration.addChild(warning, blade);
        devices.push({
          at: [x, y],
          symbol,
          node: decoration,
          blade,
          warning,
          enabled: true,
          active: false,
          phase: '',
        });
        return;
      }
      if ('kDL><^v'.includes(symbol))
        devices.push({
          at: [x, y],
          symbol,
          node: decoration,
          enabled: true,
          active: false,
          phase: '',
        });
    }),
  );
  const chipPoint =
    level.goldenChip ??
    level.map.flatMap((row, y) =>
      [...row].flatMap((symbol, x) =>
        symbol === 'G' ? [[x, y] as const] : [],
      ),
    )[0];
  if (chipPoint) {
    const chip = new Graphics()
      .star(0, 0, 5, 19, 10)
      .fill(0xf9cf4e)
      .stroke({ color: 0x8b651f, width: 3 });
    chip.position.set(chipPoint[0] * TILE + 32, chipPoint[1] * TILE + 32);
    node.addChild(chip);
    devices.push({
      at: chipPoint,
      symbol: 'G',
      node: chip,
      enabled: true,
      active: false,
      phase: '',
    });
  }
  return { node, devices };
}
export function updateDevices(devices: Device[], state: SpudView): void {
  for (const device of devices) {
    const key = device.at.join(',');
    const toggled = state.toggledDevices.includes(key);
    if (device.symbol === 'k')
      device.node.visible = !state.collectedKeys.includes(key);
    if (device.symbol === 'G') device.node.visible = !state.goldenChip;
    if (device.symbol === 'D')
      device.node.visible = state.unlockedDoors.includes(key) === toggled;
    device.enabled = !toggled;
    if ('><^vL'.includes(device.symbol)) device.node.alpha = toggled ? 0.35 : 1;
  }
}
export function makeSpud(): {
  node: Container;
  eyes: Container;
  pupils: Graphics;
  fries: Container;
  poof: Container;
} {
  const node = new Container();
  const body = new Graphics()
    .moveTo(-22, 14)
    .bezierCurveTo(-29, -3, -18, -31, 0, -28)
    .bezierCurveTo(22, -31, 31, -3, 22, 17)
    .bezierCurveTo(12, 31, -15, 29, -22, 14)
    .fill(0xaf794c)
    .stroke({ color: 0x563f2e, width: 3 });
  body
    .ellipse(-13, 5, 3, 2)
    .ellipse(15, 10, 2, 2)
    .ellipse(-4, 18, 2, 1.5)
    .fill(0x98633e);
  body.ellipse(-10, 27, 7, 3).ellipse(11, 27, 7, 3).fill(0x563f2e);
  const eyes = new Container();
  eyes.addChild(
    new Graphics()
      .ellipse(-8, -10, 9, 11)
      .ellipse(9, -11, 9, 11)
      .fill(0xffffff)
      .stroke({ color: 0x563f2e, width: 1.5 }),
  );
  const pupils = new Graphics()
    .ellipse(-6, -8, 3.5, 5)
    .ellipse(11, -9, 3.5, 5)
    .fill(0x25383b);
  eyes.addChild(pupils);
  const mouth = new Graphics().ellipse(2, 10, 4, 5).fill(0x563f2e);
  const sweat = new Graphics()
    .poly([23, -20, 19, -11, 27, -11])
    .fill(0x82ced6)
    .stroke({ color: 0x3b777d, width: 1 });
  node.addChild(body, eyes, mouth, sweat);
  const fries = new Container();
  [-19, -10, 0, 10, 19].forEach((x, i) => {
    const fry = new Graphics()
      .roundRect(-4, -18, 8, 30, 2)
      .fill(i % 2 ? 0xfad564 : 0xf5be40)
      .stroke({ color: 0xa47724, width: 1.5 });
    fry.position.set(x, 8 + (i % 2) * 4);
    fry.rotation = (i - 2) * 0.27;
    fries.addChild(fry);
  });
  fries.addChild(
    new Graphics()
      .circle(-6, 9, 2)
      .circle(7, 9, 2)
      .fill(0x563f2e)
      .moveTo(-5, 18)
      .quadraticCurveTo(1, 12, 7, 18)
      .stroke({ color: 0x563f2e, width: 2 }),
  );
  const poof = new Container();
  for (let i = 0; i < 6; i++) {
    const cloud = new Graphics().circle(0, 0, 10 + (i % 2) * 3).fill(0xf3e9cf);
    cloud.position.set(
      Math.cos((i * Math.PI) / 3) * 20,
      Math.sin((i * Math.PI) / 3) * 20,
    );
    poof.addChild(cloud);
  }
  return { node, eyes, pupils, fries, poof };
}
