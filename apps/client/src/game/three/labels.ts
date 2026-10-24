import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three';

export interface Label {
  sprite: Sprite;
  dispose(): void;
}
export function makeLabel(text: string, color: string, width = 1.8): Label {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff5d9';
  ctx.strokeStyle = '#294b4b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(5, 8, 502, 105, 22);
  ctx.fill();
  ctx.stroke();
  let size = 52;
  ctx.font = `900 ${size}px Nunito, sans-serif`;
  while (ctx.measureText(text).width > 465 && size > 30) {
    size -= 2;
    ctx.font = `900 ${size}px Nunito, sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.strokeStyle = '#2a1e14';
  ctx.lineWidth = 2.5;
  ctx.strokeText(text, 256, 62);
  ctx.fillText(text, 256, 62);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  const material = new SpriteMaterial({
    map: texture,
    depthTest: false,
    transparent: true,
  });
  const sprite = new Sprite(material);
  sprite.scale.set(width, width / 4, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 20;
  return {
    sprite,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}
