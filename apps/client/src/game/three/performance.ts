export type QualityTier = 'high' | 'medium' | 'low';
export type QualityMode = 'auto' | QualityTier;

/** Downgrade one tier after each three continuous seconds below 45 fps. */
export class AdaptiveQuality {
  private seconds = 0;
  private frames = 0;
  private slowSeconds = 0;
  private automaticTier = 0;
  fps = 60;
  constructor(public mode: QualityMode = 'auto') {}
  setMode(mode: QualityMode): void {
    this.mode = mode;
    this.automaticTier = 0;
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
    if (this.mode === 'auto' && this.automaticTier < 2) {
      this.slowSeconds = this.fps < 45 ? this.slowSeconds + this.seconds : 0;
      if (this.slowSeconds >= 3 - 1e-9) {
        this.automaticTier++;
        this.resetSample();
        return true;
      }
    }
    this.seconds = this.frames = 0;
    return false;
  }
  get tier(): QualityTier {
    return this.mode === 'auto'
      ? (['high', 'medium', 'low'] as const)[this.automaticTier]!
      : this.mode;
  }
  get degraded(): boolean {
    return this.automaticTier > 0;
  }
  get detailed(): boolean {
    return this.tier !== 'low';
  }
}
