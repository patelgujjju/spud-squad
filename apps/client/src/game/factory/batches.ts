import {
  Box3,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  RGBADepthPacking,
  Ray,
  Vector3,
} from 'three';
import type { BufferGeometry, Group, Object3D } from 'three';
import type { FactoryMaterials, Visibility } from './materials.js';
import { dither } from './materials.js';

interface Entry {
  geometry: BufferGeometry;
  name: string;
  matrices: Matrix4[];
  groups: number[];
}
interface Occluder {
  bounds: Box3;
  pathFade: boolean;
  opacity: number;
  references: { attribute: InstancedBufferAttribute; index: number }[];
  uniforms: Visibility[];
}
export class RoomBatches {
  private entries = new Map<string, Entry>();
  private occluders: Occluder[] = [];
  private meshes: InstancedMesh[] = [];
  private ray = new Ray();
  private direction = new Vector3();
  private hit = new Vector3();
  private target = new Vector3();
  private depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  constructor(private materials: FactoryMaterials) {
    dither(this.depth, { value: 1 });
  }
  occluder(bounds: Box3, pathFade = true): number {
    this.occluders.push({
      bounds: bounds.clone(),
      pathFade,
      opacity: 1,
      references: [],
      uniforms: [],
    });
    return this.occluders.length - 1;
  }
  add(
    geometry: BufferGeometry,
    name: string,
    matrix: Matrix4,
    group = -1,
  ): void {
    const key = geometry.uuid + ':' + name;
    if (!this.entries.has(key))
      this.entries.set(key, { geometry, name, matrices: [], groups: [] });
    const entry = this.entries.get(key)!;
    entry.matrices.push(matrix.clone());
    entry.groups.push(group);
  }
  model(root: Object3D, transform: Matrix4): void {
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root).applyMatrix4(transform);
    const id = this.occluder(bounds);
    root.traverse((node) => {
      if (node instanceof Mesh) {
        const name = Array.isArray(node.material)
          ? node.material[0]!.name
          : node.material.name;
        this.add(
          node.geometry,
          name,
          new Matrix4().multiplyMatrices(transform, node.matrixWorld),
          id,
        );
      }
    });
  }
  dynamic(root: Object3D): Visibility {
    root.updateMatrixWorld(true);
    // Interactive machines sit on walkable tiles; preserve their silhouette.
    // They fade only when they actually hide Spud, never to expose their own floor.
    const id = this.occluder(new Box3().setFromObject(root), false);
    const visibility = { value: 1 };
    this.occluders[id]!.uniforms.push(visibility);
    return visibility;
  }
  build(root: Group): void {
    for (const entry of this.entries.values()) {
      const geometry = entry.geometry.clone();
      const visibility = new InstancedBufferAttribute(
        new Float32Array(entry.matrices.length).fill(1),
        1,
      );
      geometry.setAttribute('instanceVisibility', visibility);
      const mesh = new InstancedMesh(
        geometry,
        this.materials.get(entry.name),
        entry.matrices.length,
      );
      entry.matrices.forEach((matrix, index) => {
        mesh.setMatrixAt(index, matrix);
        const id = entry.groups[index]!;
        if (id >= 0)
          this.occluders[id]!.references.push({ attribute: visibility, index });
      });
      mesh.castShadow = true;
      mesh.customDepthMaterial = this.depth;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
      this.meshes.push(mesh);
    }
    this.entries.clear();
  }
  visibility(
    camera: Vector3,
    x: number,
    z: number,
    dt: number,
    path: readonly Vector3[] = [],
  ): number {
    let faded = 0;
    for (const item of this.occluders) {
      // Foreground roof structure must not cut across the navigable view.
      let obscures =
        item.bounds.min.z > z + 0.5 &&
        (item.bounds.min.y > 3.5 ||
          (item.bounds.min.y > 1 &&
            item.bounds.max.z - item.bounds.min.z < 0.3));
      for (const height of [0.22, 0.85]) {
        this.target.set(x, height, z);
        this.direction.subVectors(this.target, camera);
        const distance = this.direction.length();
        this.ray.set(camera, this.direction.normalize());
        if (
          this.ray.intersectBox(item.bounds, this.hit) &&
          this.hit.distanceTo(camera) < distance - 0.15
        ) {
          obscures = true;
          break;
        }
      }
      if (!obscures && item.pathFade)
        for (const tile of path) {
          if (Math.abs(tile.x - x) > 4.5 || Math.abs(tile.z - z) > 4.5)
            continue;
          this.direction.subVectors(tile, camera);
          const distance = this.direction.length();
          this.ray.set(camera, this.direction.normalize());
          if (
            this.ray.intersectBox(item.bounds, this.hit) &&
            this.hit.distanceTo(camera) < distance - 0.12
          ) {
            obscures = true;
            break;
          }
        }
      const previous = item.opacity;
      const desired = obscures ? 0.012 : 1;
      item.opacity = obscures
        ? desired
        : item.opacity + (desired - item.opacity) * (1 - Math.exp(-dt * 12));
      if (obscures) faded++;
      if (Math.abs(previous - item.opacity) < 0.0001) continue;
      for (const ref of item.references) {
        ref.attribute.setX(ref.index, item.opacity);
        ref.attribute.needsUpdate = true;
      }
      item.uniforms.forEach((value) => {
        value.value = item.opacity;
      });
    }
    return faded;
  }
  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.meshes = [];
    this.depth.dispose();
  }
}
