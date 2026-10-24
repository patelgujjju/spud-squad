import { PerspectiveCamera, Vector3 } from 'three';
import type { Level } from '@spud-squad/shared';

const elevation = (62 * Math.PI) / 180;
const direction = new Vector3(
  0.025,
  Math.sin(elevation),
  Math.cos(elevation),
).normalize();

/** A fixed tabletop view: fit every island corner, never crop or leave a room. */
export class FollowCamera {
  readonly camera = new PerspectiveCamera(28, 1, 0.1, 160);
  private center = new Vector3();
  private corners: Vector3[] = [];
  private projection = new Vector3();
  private distance = 12;
  private impact = 0;
  setLevel(level: Level): void {
    const width = level.map[0]!.length;
    const depth = level.map.length;
    this.center.set((width - 1) / 2, 0.12, (depth - 1) / 2);
    this.corners = [];
    for (const x of [-0.76, width - 0.24])
      for (const y of [-0.92, 1.48])
        for (const z of [-0.76, depth - 0.24])
          this.corners.push(new Vector3(x, y, z));
    this.fit();
  }
  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.fit();
  }
  private place(distance: number): void {
    this.camera.position
      .copy(direction)
      .multiplyScalar(distance)
      .add(this.center);
    this.camera.lookAt(this.center);
    this.camera.updateMatrixWorld();
  }
  private fit(): void {
    if (!this.corners.length) return;
    let near = 2;
    let far = 100;
    for (let i = 0; i < 24; i++) {
      const distance = (near + far) / 2;
      this.place(distance);
      const fits = this.corners.every((corner) => {
        this.projection.copy(corner).project(this.camera);
        return (
          Math.abs(this.projection.x) <= 0.93 &&
          Math.abs(this.projection.y) <= 0.9
        );
      });
      if (fits) far = distance;
      else near = distance;
    }
    this.distance = far;
    this.place(far);
  }
  bounds(): number[] {
    let left = 1;
    let right = -1;
    let top = -1;
    let bottom = 1;
    for (const corner of this.corners) {
      this.projection.copy(corner).project(this.camera);
      left = Math.min(left, this.projection.x);
      right = Math.max(right, this.projection.x);
      top = Math.max(top, this.projection.y);
      bottom = Math.min(bottom, this.projection.y);
    }
    return [left, right, bottom, top];
  }
  worldUnitsPerPixel(height: number): number {
    return (
      (2 * this.distance * Math.tan((this.camera.fov * Math.PI) / 360)) /
      Math.max(1, height)
    );
  }
  shake(): void {
    this.impact = 0.045;
  }
  frame(_x: number, _z: number, dt: number, reduced: boolean): void {
    this.place(this.distance);
    if (!reduced && this.impact > 0.0005) {
      this.camera.position.x += Math.sin(this.impact * 1400) * this.impact;
      this.camera.position.y +=
        Math.cos(this.impact * 1200) * this.impact * 0.6;
    }
    this.impact *= Math.exp(-dt * 12);
  }
}
