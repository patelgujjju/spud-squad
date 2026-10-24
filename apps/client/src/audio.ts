export type Sound = 'step' | 'slicer' | 'death' | 'checkpoint' | 'win' | 'buzz';
export class GameAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  constructor(public muted: boolean) {}
  unlock(): void {
    try {
      const Context =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Context) return;
      if (!this.context) {
        this.context = new Context();
        this.gain = this.context.createGain();
        this.gain.gain.value = this.muted ? 0 : 0.18;
        this.gain.connect(this.context.destination);
        this.note(200, 200, 0.01, 0, 0);
      }
      void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.gain) this.gain.gain.value = muted ? 0 : 0.18;
  }
  visibility(): void {
    if (document.hidden) void this.context?.suspend().catch(() => {});
    else void this.context?.resume().catch(() => {});
  }
  private note(
    from: number,
    to: number,
    duration: number,
    delay = 0,
    volume = 0.5,
    type: OscillatorType = 'sine',
  ): void {
    if (!this.context || !this.gain) return;
    const time = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, to),
      time + duration,
    );
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.gain);
    oscillator.start(time);
    oscillator.stop(time + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  play(sound: Sound): void {
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    if (sound === 'step') this.note(250, 120, 0.055, 0, 0.35, 'triangle');
    if (sound === 'death') this.note(1100, 80, 0.28, 0, 0.7, 'sawtooth');
    if (sound === 'checkpoint') {
      this.note(880, 880, 0.15);
      this.note(1320, 1320, 0.25, 0.1);
    }
    if (sound === 'win')
      [523, 659, 784, 1047].forEach((frequency, i) =>
        this.note(frequency, frequency, 0.24, i * 0.11),
      );
    if (sound === 'buzz') this.note(90, 70, 0.07, 0, 0.25, 'triangle');
    if (sound === 'slicer') {
      this.noise ??= this.context.createBuffer(
        1,
        Math.floor(this.context.sampleRate * 0.18),
        this.context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      const t = this.context.currentTime;
      source.buffer = this.noise;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2000, t);
      filter.frequency.exponentialRampToValueAtTime(250, t + 0.18);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.gain!);
      source.start();
      source.stop(t + 0.18);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    }
  }
}
