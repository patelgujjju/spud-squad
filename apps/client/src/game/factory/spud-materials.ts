import {
  CanvasTexture,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NoColorSpace,
} from 'three';
import type { Group } from 'three';

/** Keep the comic silhouette; replace flat toon skin with porous PBR potato skin. */
export class PotatoMaterials {
  private materials: MeshStandardMaterial[] = [];
  private bump: CanvasTexture;
  constructor(root: Group) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const pixels = ctx.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) {
      const value = 165 + ((Math.imul(i + 19, 1274126177) >>> 13) % 65);
      pixels.data[i * 4] =
        pixels.data[i * 4 + 1] =
        pixels.data[i * 4 + 2] =
          value;
      pixels.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    this.bump = new CanvasTexture(canvas);
    this.bump.colorSpace = NoColorSpace;
    const cache = new Map<MeshToonMaterial, MeshStandardMaterial>();
    root.traverse((node) => {
      if (
        !(node instanceof Mesh) ||
        !(node.material instanceof MeshToonMaterial)
      )
        return;
      const original = node.material;
      if (!cache.has(original)) {
        const skin = original.vertexColors;
        const m = new MeshPhysicalMaterial({
          color: original.color,
          vertexColors: skin,
          roughness: skin ? 0.72 : 0.4,
          metalness: 0,
          clearcoat: skin ? 0.06 : 0.12,
          clearcoatRoughness: 0.35,
          bumpMap: skin ? this.bump : null,
          bumpScale: skin ? 0.012 : 0,
          sheen: skin ? 0.12 : 0,
          envMapIntensity: 0.4,
        });
        cache.set(original, m);
        this.materials.push(m);
      }
      node.material = cache.get(original)!;
    });
  }
  reflections(enabled: boolean): void {
    this.materials.forEach((material) => {
      material.envMapIntensity = enabled ? 0.4 : 0;
    });
  }
  dispose(): void {
    this.materials.forEach((material) => material.dispose());
    this.bump.dispose();
  }
}
