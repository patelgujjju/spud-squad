export class LevelWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private active = false;
  private pending = false;
  setActive(active: boolean): void {
    this.active = active;
    void this.update();
  }
  async update(): Promise<void> {
    if (!this.active || document.hidden) {
      try {
        await this.sentinel?.release();
      } catch {
        /* optional */
      }
      this.sentinel = null;
      return;
    }
    if (
      (this.sentinel && !this.sentinel.released) ||
      this.pending ||
      !('wakeLock' in navigator)
    )
      return;
    this.pending = true;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (!this.active || document.hidden) await sentinel.release();
      else this.sentinel = sentinel;
    } catch {
      /* Unsupported, insecure context or low battery: continue playing. */
    } finally {
      this.pending = false;
    }
  }
}
