import { Box3, PerspectiveCamera, Vector3 } from 'three';
import type { Direction, Level } from '@spud-squad/shared';

const tilt = (50 * Math.PI) / 180;
const behind = new Vector3(-0.11, Math.sin(tilt), Math.cos(tilt)).normalize();
export class FactoryCamera {
  readonly camera = new PerspectiveCamera(48, 1, 0.08, 160);
  private room = new Box3();
  private center = new Vector3();
  private target = new Vector3();
  private wanted = new Vector3();
  private closePosition = new Vector3();
  private overviewPosition = new Vector3();
  private overviewTarget = new Vector3();
  private corner = new Vector3();
  private start = 0;
  private skipped = false;
  private held = false;
  private initialized = false;
  private impact = 0;
  mode: 'flyover' | 'follow' | 'overview' = 'flyover';
  configure(_level: Level, bounds: Box3, time: number): void {
    this.room.copy(bounds);
    bounds.getCenter(this.center);
    this.center.y = 1.0;
    this.start = time;
    this.skipped = false;
    this.held = false;
    this.initialized = false;
    this.fit();
  }
  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = width > height ? 40 : 48;
    this.camera.updateProjectionMatrix();
    this.fit();
  }
  private fit(): void {
    if (this.room.isEmpty()) return;
    const direction = new Vector3(-0.25, 0.86, 0.45).normalize();
    let near = 5,
      far = 100;
    for (let i = 0; i < 22; i++) {
      const distance = (near + far) / 2;
      this.camera.position
        .copy(direction)
        .multiplyScalar(distance)
        .add(this.center);
      this.camera.lookAt(this.center);
      this.camera.updateMatrixWorld();
      let fits = true;
      for (const x of [this.room.min.x, this.room.max.x])
        for (const y of [0, this.room.max.y])
          for (const z of [this.room.min.z, this.room.max.z]) {
            this.corner.set(x, y, z).project(this.camera);
            if (
              Math.abs(this.corner.x) > 0.92 ||
              Math.abs(this.corner.y) > 0.89
            )
              fits = false;
          }
      if (fits) far = distance;
      else near = distance;
    }
    this.overviewPosition.copy(direction).multiplyScalar(far).add(this.center);
    this.overviewTarget.copy(this.center);
  }
  skip(): void {
    this.skipped = true;
  }
  overview(held: boolean): void {
    this.held = held;
    if (held) this.skip();
  }
  shake(): void {
    this.impact = 0.035;
  }
  frame(
    x: number,
    z: number,
    facing: Direction,
    time: number,
    dt: number,
    reduced: boolean,
  ): number {
    const lead = 0.55;
    this.wanted.set(
      x + (facing === 'LEFT' ? -lead : facing === 'RIGHT' ? lead : 0),
      0.65,
      z + (facing === 'UP' ? -lead : facing === 'DOWN' ? lead : 0),
    );
    const blend = reduced || !this.initialized ? 1 : 1 - Math.exp(-dt * 6);
    this.target.lerp(this.wanted, blend);
    const distance = this.camera.aspect < 1 ? 9.4 : 6.5;
    this.closePosition.copy(behind).multiplyScalar(distance).add(this.target);
    const age = Math.max(0, (time - this.start) / 2500);
    const progress = this.skipped || reduced ? 1 : Math.min(1, age);
    const eased = progress * progress * (3 - 2 * progress);
    this.mode = this.held ? 'overview' : progress < 1 ? 'flyover' : 'follow';
    if (this.mode === 'flyover') {
      this.camera.position.lerpVectors(
        this.overviewPosition,
        this.closePosition,
        eased,
      );
      this.wanted.lerpVectors(this.overviewTarget, this.target, eased);
      this.camera.lookAt(this.wanted);
    } else if (this.held) {
      this.camera.position.lerp(this.overviewPosition, blend);
      this.wanted.copy(this.overviewTarget);
      this.camera.lookAt(this.wanted);
    } else {
      this.camera.position.lerp(this.closePosition, blend);
      this.camera.lookAt(this.target);
    }
    if (!reduced && this.impact > 0.001) {
      this.camera.position.x += Math.sin(time * 0.09) * this.impact;
      this.camera.position.y += Math.cos(time * 0.07) * this.impact * 0.5;
    }
    this.impact *= Math.exp(-dt * 12);
    this.camera.updateMatrixWorld();
    this.initialized = true;
    return progress;
  }
  pixels(height: number): number {
    return (
      (2 *
        this.camera.position.distanceTo(this.target) *
        Math.tan((this.camera.fov * Math.PI) / 360)) /
      Math.max(1, height)
    );
  }
}
