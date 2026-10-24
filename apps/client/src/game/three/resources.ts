import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Color,
  CanvasTexture,
  PlaneGeometry,
  CylinderGeometry,
  DataTexture,
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { Material } from 'three';

/** One geometry/material cache per renderer, released as a unit on exit. */
export class Resources {
  private geometries = new Map<string, BufferGeometry>();
  private materials = new Map<string, Material>();
  private shadowTexture: CanvasTexture | null = null;
  readonly gradient = new DataTexture(
    new Uint8Array([130, 195, 235, 255]),
    4,
    1,
    RedFormat,
  );
  constructor() {
    this.gradient.magFilter = this.gradient.minFilter = NearestFilter;
    this.gradient.needsUpdate = true;
  }
  geometry(key: string, create: () => BufferGeometry): BufferGeometry {
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = create();
      this.geometries.set(key, geometry);
    }
    return geometry;
  }
  box(w = 1, h = 1, d = 1): BufferGeometry {
    return this.geometry(`box:${w}:${h}:${d}`, () => new BoxGeometry(w, h, d));
  }
  bevel(w: number, h: number, d: number, radius = 0.035): BufferGeometry {
    return this.geometry(`bevel:${w}:${h}:${d}:${radius}`, () => {
      const bevel = Math.min(radius, h / 3, w / 5, d / 5);
      const x = w / 2 - bevel;
      const z = d / 2 - bevel;
      const corner = Math.min(radius * 1.8, x * 0.7, z * 0.7);
      const shape = new Shape()
        .moveTo(-x + corner, -z)
        .lineTo(x - corner, -z)
        .quadraticCurveTo(x, -z, x, -z + corner)
        .lineTo(x, z - corner)
        .quadraticCurveTo(x, z, x - corner, z)
        .lineTo(-x + corner, z)
        .quadraticCurveTo(-x, z, -x, z - corner)
        .lineTo(-x, -z + corner)
        .quadraticCurveTo(-x, -z, -x + corner, -z);
      const geometry = new ExtrudeGeometry(shape, {
        depth: h - bevel * 2,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel,
        curveSegments: 3,
      });
      geometry.rotateX(Math.PI / 2);
      geometry.center();
      return geometry;
    });
  }
  sphere(radius = 1, segments = 12, rings = 8): BufferGeometry {
    return this.geometry(
      `sphere:${radius}:${segments}:${rings}`,
      () => new SphereGeometry(radius, segments, rings),
    );
  }
  cylinder(radius: number, length: number, segments = 8): BufferGeometry {
    return this.geometry(
      `cylinder:${radius}:${length}:${segments}`,
      () => new CylinderGeometry(radius, radius, length, segments),
    );
  }
  torus(radius: number, tube: number, arc = Math.PI * 2): BufferGeometry {
    return this.geometry(
      `torus:${radius}:${tube}:${arc}`,
      () => new TorusGeometry(radius, tube, 5, 16, arc),
    );
  }
  toon(color: number | string, emissive = 0, intensity = 0): MeshToonMaterial {
    const key = `toon:${color}:${emissive}:${intensity}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshToonMaterial({
        color,
        gradientMap: this.gradient,
        emissive,
        emissiveIntensity: intensity,
      });
      this.materials.set(key, material);
    }
    return material as MeshToonMaterial;
  }
  basic(color: number | string, opacity = 1): MeshBasicMaterial {
    const key = `basic:${color}:${opacity}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshBasicMaterial({
        color,
        opacity,
        transparent: opacity < 1,
        depthWrite: opacity === 1,
      });
      this.materials.set(key, material);
    }
    return material as MeshBasicMaterial;
  }
  outline(): MeshBasicMaterial {
    const key = 'outline';
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshBasicMaterial({
        color: 0x2a1e14,
        side: BackSide,
        transparent: true,
        opacity: 0.82,
      });
      this.materials.set(key, material);
    }
    return material as MeshBasicMaterial;
  }
  mesh(
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (
      material instanceof MeshToonMaterial &&
      material.emissiveIntensity > 0.05
    )
      mesh.layers.enable(1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  silhouette(mesh: Mesh, size = 1.055): void {
    const line = new Mesh(mesh.geometry, this.outline());
    line.scale.setScalar(size);
    line.castShadow = false;
    mesh.add(line);
  }
  softShadow(width: number, depth: number, opacity: number): Mesh {
    if (!this.shadowTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createRadialGradient(64, 64, 12, 64, 64, 63);
      gradient.addColorStop(0, '#0f5e59');
      gradient.addColorStop(0.6, '#0f5e5977');
      gradient.addColorStop(1, '#0f5e5900');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      this.shadowTexture = new CanvasTexture(canvas);
    }
    const key = 'soft-shadow:' + opacity;
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshBasicMaterial({
        map: this.shadowTexture,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      this.materials.set(key, material);
    }
    const shadow = new Mesh(
      this.geometry('shadow-plane', () => new PlaneGeometry(1, 1)),
      material,
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(width, depth, 1);
    return shadow;
  }
  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.gradient.dispose();
    this.shadowTexture?.dispose();
  }
}
export const palette = {
  floor: 0xe9fbf8,
  grout: 0xbfe9e3,
  machine: 0x1fb5a8,
  cap: 0x1fb5a8,
  dark: 0x0f5e59,
  steel: 0xd1e5ed,
  brass: 0xffc93c,
  yellow: 0xffc93c,
  reward: 0xffd23f,
  danger: 0xff4d4d,
  exit: 0x6bff9e,
  ink: 0x2a1e14,
  cream: 0xfff6e6,
};
export function noise(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 4.1 + y * 2.8) * Math.sin(z * 3.3 - y * 1.4) * 0.055 +
    Math.sin(y * 9.1 + x * 3.1 + z) * 0.022
  );
}
export function tint(color: number, amount: number): Color {
  return new Color(color).multiplyScalar(amount);
}
