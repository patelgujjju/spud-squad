import { PerspectiveCamera, Vector3 } from 'three';
import type { Level } from '@spud-squad/shared';

const elevation = (55 * Math.PI) / 180;
const direction = new Vector3(
  0.07,
  Math.sin(elevation),
  Math.cos(elevation),
).normalize();
export class FollowCamera {
  readonly camera = new PerspectiveCamera(36, 1, 0.1, 120);
  private target = new Vector3();
  private desired = new Vector3();
  private position = new Vector3();
  private distance = 8;
  private desiredDistance = 8;
  private width = 1;
  private depth = 1;
  private initialized = false;
  setLevel(level: Level): void {
    this.width = level.map[0]!.length;
    this.depth = level.map.length;
    this.initialized = false;
    this.fit();
  }
  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.fit();
    this.initialized = false;
  }
  private fit(): void {
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    // Cover the drawing area; the camera follows the readable local grid when
    // a long board cannot fit a portrait rectangle at useful tile size.
    const across = (this.width + 0.4) / (2 * tan * this.camera.aspect);
    const vertical = (this.depth * Math.sin(elevation) + 0.7) / (2 * tan);
    this.desiredDistance = Math.max(5.8, Math.min(across, vertical) * 0.98);
  }
  frame(x: number, z: number, dt: number, reduced: boolean): void {
    const halfWidth =
      this.desiredDistance *
      Math.tan((this.camera.fov * Math.PI) / 360) *
      this.camera.aspect;
    const halfDepth =
      (this.desiredDistance * Math.tan((this.camera.fov * Math.PI) / 360)) /
      Math.sin(elevation);
    const centerX = (this.width - 1) / 2;
    const centerZ = (this.depth - 1) / 2;
    const clamp = (
      value: number,
      middle: number,
      half: number,
      size: number,
    ): number =>
      half * 2 >= size - 0.8
        ? middle
        : Math.max(half - 0.55, Math.min(size - half - 0.45, value));
    this.desired.set(
      clamp(x + 0.35, centerX, halfWidth, this.width),
      0.2,
      clamp(z, centerZ, halfDepth, this.depth),
    );
    const blend = reduced || !this.initialized ? 1 : 1 - Math.exp(-dt * 6);
    this.target.lerp(this.desired, blend);
    this.distance += (this.desiredDistance - this.distance) * blend;
    this.position
      .copy(direction)
      .multiplyScalar(this.distance)
      .add(this.target);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
    this.initialized = true;
  }
}
