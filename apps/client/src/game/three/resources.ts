import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Color,
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
  readonly gradient = new DataTexture(
    new Uint8Array([105, 155, 208, 255]),
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
      const x = w / 2 - radius;
      const z = d / 2 - radius;
      const shape = new Shape()
        .moveTo(-x, -z)
        .lineTo(x, -z)
        .lineTo(x, z)
        .lineTo(-x, z)
        .closePath();
      const geometry = new ExtrudeGeometry(shape, {
        depth: Math.max(0.01, h - radius * 2),
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: radius,
        bevelThickness: radius,
        curveSegments: 1,
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
        color: 0x563c2d,
        side: BackSide,
        transparent: true,
        opacity: 0.7,
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.gradient.dispose();
  }
}
export const palette = {
  floor: 0xa8c7c8,
  machine: 0x426872,
  cap: 0x5b7980,
  dark: 0x25464a,
  steel: 0xb5c5c5,
  brass: 0xb2935f,
  yellow: 0xf0bd46,
  ink: 0x213c40,
  cream: 0xffedc5,
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
