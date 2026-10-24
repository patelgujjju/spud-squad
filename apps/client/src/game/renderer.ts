import { Application, Container, Graphics } from 'pixi.js';
import { slicerAt } from '@spud-squad/shared';
import type {
  GameEvent,
  Level,
  PlayerView,
  ServerMessage,
  SpudView,
} from '@spud-squad/shared';
import type { GameAudio } from '../audio.js';
import type { ServerClock } from '../clock.js';
import { makeBoard, makeSpud, TILE, updateDevices } from './art.js';
import type { Device } from './art.js';
import { PressHands } from './hands.js';

export class LevelRenderer {
  private app = new Application();
  private world = new Container();
  private board: Container | null = null;
  private devices: Device[] = [];
  private spud = makeSpud();
  private shadow = new Graphics()
    .ellipse(0, 0, 22, 9)
    .fill({ color: 0x173c40, alpha: 0.22 });
  private hands = new PressHands();
  private state: SpudView | null = null;
  private level: Level | null = null;
  private startTime = 0;
  private factor = 1;
  private deathAt = 0;
  private respawnAt = 0;
  private players: PlayerView[] = [];
  private observer: ResizeObserver | null = null;
  private initialized = false;
  private destroyed = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  constructor(
    private readonly host: HTMLElement,
    private readonly clock: ServerClock,
    private readonly audio: GameAudio,
  ) {}
  async init(): Promise<void> {
    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      preference: 'webgl',
      width: this.host.clientWidth || 1,
      height: this.host.clientHeight || 1,
      powerPreference: 'low-power',
    });
    this.initialized = true;
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.host.append(this.app.canvas);
    this.app.stage.addChild(this.world, this.hands.node);
    this.world.addChild(
      this.shadow,
      this.spud.node,
      this.spud.fries,
      this.spud.poof,
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.host);
    this.app.ticker.add(() => this.frame());
    this.visibility();
  }
  setLevel(
    level: Level,
    message: Extract<ServerMessage, { type: 'levelStart' }>,
  ): void {
    if (this.board) {
      this.world.removeChild(this.board);
      this.board.destroy({ children: true });
    }
    const art = makeBoard(level);
    this.board = art.node;
    this.devices = art.devices;
    this.world.addChildAt(this.board, 0);
    this.level = level;
    this.startTime = message.startTime;
    this.factor = message.groupFactor;
    this.state = null;
    this.spud.node.visible = false;
    this.spud.fries.visible = false;
    this.spud.poof.visible = false;
    this.resize();
  }
  setPlayers(players: PlayerView[]): void {
    this.players = players;
  }
  setState(state: SpudView): void {
    if (state.status === 'dead' && this.state?.status !== 'dead')
      this.deathAt = (state.respawnAt ?? state.time + 1500) - 1500;
    if (this.state?.status === 'dead' && state.status === 'playing')
      this.respawnAt = state.time;
    this.state = state;
    updateDevices(this.devices, state);
    this.host.dataset.position = state.position.join(',');
    this.host.dataset.status = state.status;
    this.host.setAttribute(
      'aria-label',
      `Factory grid. Spud at column ${state.position[0]}, row ${state.position[1]}. ${state.status === 'dead' ? 'Respawning.' : `${state.deaths} deaths.`}`,
    );
  }
  event(event: GameEvent): void {
    if (event.type === 'hop') this.audio.play('step');
    if (event.type === 'death') this.audio.play('death');
    if (event.type === 'checkpoint') this.audio.play('checkpoint');
    if (event.type === 'finish') this.audio.play('win');
    if (event.type === 'press' && this.state) {
      const player = this.players.find(
        (member) => member.id === event.playerId,
      );
      if (player) {
        const scale = this.world.scale.x;
        this.hands.add(
          player.nickname,
          player.color,
          event.button,
          performance.now(),
          this.world.x + (this.state.position[0] * TILE + 32) * scale,
          this.world.y + (this.state.position[1] * TILE + 32) * scale,
          this.host.clientWidth,
          this.host.clientHeight,
        );
      }
    }
  }
  private resize(): void {
    if (!this.initialized || this.destroyed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.app.renderer.resize(width, height);
    if (!this.level) return;
    const mapWidth = this.level.map[0]!.length * TILE;
    const mapHeight = this.level.map.length * TILE;
    const scale = Math.min(
      (width - 20) / mapWidth,
      (height - 16) / mapHeight,
      1.65,
    );
    this.world.scale.set(Math.max(0.1, scale));
    this.world.position.set(
      (width - mapWidth * scale) / 2,
      (height - mapHeight * scale) / 2,
    );
  }
  private frame(): void {
    if (!this.state || !this.level || this.destroyed) return;
    const now = Math.max(0, this.clock.now() - this.startTime);
    const reduced = this.reduced.matches;
    const state = this.state;
    const hop = state.hop;
    const progress =
      hop && !reduced
        ? Math.min(1, Math.max(0, (now - hop.startT) / (hop.endT - hop.startT)))
        : 1;
    const x = hop
      ? hop.from[0] + (hop.to[0] - hop.from[0]) * progress
      : state.position[0];
    const y = hop
      ? hop.from[1] + (hop.to[1] - hop.from[1]) * progress
      : state.position[1];
    const airborne = reduced || !hop ? 0 : Math.sin(progress * Math.PI);
    this.shadow.position.set(x * TILE + 32, y * TILE + 46);
    this.spud.node.position.set(x * TILE + 32, y * TILE + 30 - airborne * 13);
    const rebirth = reduced ? 0 : Math.max(0, 1 - (now - this.respawnAt) / 250);
    this.spud.node.scale.set(
      1 - airborne * 0.12 + rebirth * 0.13,
      1 + airborne * 0.16 - rebirth * 0.13,
    );
    const danger = this.level.objects.some(
      (object) =>
        object.type === 'slicer' &&
        Math.abs(object.at[0] - state.position[0]) +
          Math.abs(object.at[1] - state.position[1]) <=
          1,
    );
    this.spud.eyes.scale.set(danger ? 1.15 : 1);
    this.spud.pupils.position.set(
      state.facing === 'LEFT' ? -3 : state.facing === 'RIGHT' ? 1 : 0,
      state.facing === 'UP' ? -3 : state.facing === 'DOWN' ? 3 : 0,
    );
    const dead = state.status === 'dead';
    this.spud.node.visible = !dead;
    this.spud.fries.visible = dead;
    this.spud.fries.position.set(
      state.position[0] * TILE + 32,
      state.position[1] * TILE + 32,
    );
    const poofAge = now - this.deathAt;
    this.spud.poof.visible = dead && !reduced && poofAge < 230;
    this.spud.poof.position.copyFrom(this.spud.fries.position);
    this.spud.poof.scale.set(0.5 + poofAge / 200);
    this.spud.poof.alpha = Math.max(0, 1 - poofAge / 230);
    for (const device of this.devices) {
      if (device.symbol !== 'S') continue;
      const slicer = this.level.objects.find(
        (object) =>
          object.type === 'slicer' &&
          object.at[0] === device.at[0] &&
          object.at[1] === device.at[1],
      );
      if (slicer?.type !== 'slicer') continue;
      const phase = slicerAt(
        slicer,
        Math.floor(now),
        this.factor,
        device.enabled,
      );
      if (phase.active && !device.active && device.phase)
        this.audio.play('slicer');
      device.active = phase.active;
      device.phase = phase.active
        ? 'active'
        : phase.warning
          ? 'warning'
          : 'safe';
      if (device.blade) {
        device.blade.rotation = reduced || !phase.active ? 0 : now / 100;
        device.blade.tint = phase.active ? 0xf4f6f6 : 0xb1c0c1;
      }
      if (device.warning) {
        device.warning.visible = phase.warning || phase.active;
        device.warning.alpha = phase.warning
          ? reduced
            ? 0.6
            : 0.4 + Math.sin(now / 80) * 0.2
          : 0.18;
      }
    }
    this.hands.frame(performance.now(), reduced);
  }
  visibility(): void {
    if (this.initialized && !this.destroyed) {
      if (document.hidden) this.app.stop();
      else this.app.start();
    }
  }
  destroy(): void {
    this.destroyed = true;
    this.observer?.disconnect();
    if (this.initialized) this.app.destroy(true, { children: true });
  }
}
