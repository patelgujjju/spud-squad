export type QualityMode = 'auto' | 'high' | 'low';

/** A sustained low frame rate, not one shader-compilation spike, lowers quality. */
export class AdaptiveQuality {
  private seconds = 0;
  private frames = 0;
  private slowSeconds = 0;
  degraded = false;
  fps = 60;
  constructor(public mode: QualityMode = 'auto') {}
  setMode(mode: QualityMode): void {
    this.mode = mode;
    this.degraded = false;
    this.resetSample();
  }
  resetSample(): void {
    this.seconds = this.frames = this.slowSeconds = 0;
  }
  frame(dt: number): boolean {
    if (dt <= 0 || !Number.isFinite(dt)) {
      this.resetSample();
      return false;
    }
    this.seconds += dt;
    this.frames++;
    if (this.seconds < 0.5 - 1e-9) return false;
    this.fps = this.frames / this.seconds;
    if (this.mode === 'auto' && !this.degraded) {
      this.slowSeconds = this.fps < 45 ? this.slowSeconds + this.seconds : 0;
      if (this.slowSeconds >= 3 - 1e-9) {
        this.degraded = true;
        this.seconds = this.frames = 0;
        return true;
      }
    }
    this.seconds = this.frames = 0;
    return false;
  }
  get detailed(): boolean {
    return this.mode === 'high' || (this.mode === 'auto' && !this.degraded);
  }
}
