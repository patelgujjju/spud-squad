import {
  NoToneMapping,
  DirectionalLight,
  HemisphereLight,
  PCFShadowMap,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type {
  GameEvent,
  Level,
  PlayerView,
  ServerMessage,
  SpudView,
} from '@spud-squad/shared';
import { RESPAWN_MS } from '@spud-squad/shared';
import type { GameRenderer, RendererContext } from '../renderer.js';
import { getQuality } from '../quality.js';
import type { QualityMode } from '../quality.js';
import { AdaptiveQuality } from './performance.js';
import { FollowCamera } from './camera.js';
import { Resources } from './resources.js';
import { SpudModel } from './spud.js';
import { FactoryWorld } from './world.js';
import { FactoryParticles } from './particles.js';
import { exitConfetti } from '../celebrate.js';
import { ToyBloom } from './bloom.js';
import { PressHands3D } from './hands.js';

export class ThreeLevelRenderer implements GameRenderer {
  private gpu: WebGLRenderer | null = null;
  private scene = new Scene();
  private resources = new Resources();
  private avatar = new SpudModel(this.resources);
  private view = new FollowCamera();
  private particles = new FactoryParticles();
  private hands = new PressHands3D(this.resources);
  private bloom = new ToyBloom();
  private world: FactoryWorld | null = null;
  private light = new DirectionalLight(0xfff1d6, 1.3);
  private quality = new AdaptiveQuality(getQuality());
  private state: SpudView | null = null;
  private players: PlayerView[] = [];
  private startTime = 0;
  private factor = 1;
  private observer: ResizeObserver | null = null;
  private abort = new AbortController();
  private raf = 0;
  private lastFrame = 0;
  private frameCount = 0;
  private sawRaised: boolean | null = null;
  private destroyed = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private point = new Vector3();
  constructor(private readonly context: RendererContext) {}
  async init(): Promise<void> {
    if (this.destroyed) return;
    await document.fonts.ready;
    const host = this.context.host;
    this.gpu = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.gpu.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.gpu.setClearColor(0x000000, 0);
    this.gpu.toneMapping = NoToneMapping;
    this.gpu.toneMappingExposure = 1.0;
    this.gpu.shadowMap.enabled = true;
    this.gpu.shadowMap.type = PCFShadowMap;
    this.gpu.shadowMap.autoUpdate = false;
    this.gpu.info.autoReset = false;
    this.gpu.domElement.setAttribute('aria-hidden', 'true');
    host.append(this.gpu.domElement);
    const ambient = new HemisphereLight(0xffffff, 0x9bd2e7, 1.35);
    ambient.layers.enable(1);
    const fill = new DirectionalLight(0xb5e6ff, 0.5);
    fill.position.set(5, 4, -4);
    fill.layers.enable(1);
    const rim = new DirectionalLight(0xffffff, 0.45);
    rim.position.set(-2, 4, -5);
    rim.layers.enable(1);
    this.light.layers.enable(1);
    this.scene.add(ambient, fill, rim);
    this.avatar.root.scale.setScalar(1.3);
    this.light.position.set(-3, 9, 5);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.camera.left = -8;
    this.light.shadow.camera.right = 8;
    this.light.shadow.camera.top = 8;
    this.light.shadow.camera.bottom = -8;
    this.light.shadow.camera.near = 0.1;
    this.light.shadow.camera.far = 28;
    this.light.shadow.normalBias = 0.035;
    this.light.shadow.bias = -0.0003;
    this.scene.add(
      this.light,
      this.light.target,
      this.avatar.root,
      this.particles.node,
      this.hands.root,
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    window.addEventListener(
      'spud-quality-change',
      (event) => {
        this.quality.setMode((event as CustomEvent<QualityMode>).detail);
        this.applyQuality();
      },
      { signal: this.abort.signal },
    );
    this.reduced.addEventListener('change', () => this.applyQuality(), {
      signal: this.abort.signal,
    });
    host.dataset.renderer = 'three';
    this.resize();
    this.applyQuality();
    this.visibility();
  }
  setLevel(
    level: Level,
    start: Extract<ServerMessage, { type: 'levelStart' }>,
  ): void {
    if (this.world) {
      this.scene.remove(this.world.root);
      this.world.dispose();
    }
    this.world = new FactoryWorld(level, this.resources);
    this.scene.add(this.world.root);
    this.view.setLevel(level);
    this.startTime = start.startTime;
    this.factor = start.groupFactor;
    this.state = null;
    this.avatar.root.visible = false;
    this.hands.clear();
    this.frameCount = 0;
    this.sawRaised = null;
    this.context.host.dataset.ready = 'false';
    this.resize();
  }
  setPlayers(players: PlayerView[]): void {
    this.players = players;
  }
  setState(state: SpudView): void {
    if (state.status === 'dead' && this.state?.status !== 'dead')
      this.avatar.die(
        (state.respawnAt ?? state.time + RESPAWN_MS) - RESPAWN_MS,
      );
    if (this.state?.status === 'dead' && state.status === 'playing')
      this.avatar.respawn(state.time);
    this.state = state;
    this.context.host.dataset.position = state.position.join(',');
    this.context.host.dataset.status = state.status;
    this.context.host.setAttribute(
      'aria-label',
      `3D factory grid. Spud at column ${state.position[0]}, row ${state.position[1]}. ${state.status === 'dead' ? 'Respawning.' : `${state.deaths} deaths.`}`,
    );
  }
  event(event: GameEvent): void {
    const audio = this.context.audio;
    if (event.type === 'hop') {
      audio.play('step');
      if (!this.reduced.matches) {
        this.point.set(event.hop.from[0], 0.12, event.hop.from[1]);
        this.particles.burst('puff', this.point, 7);
      }
    }
    if (event.type === 'checkpoint') audio.play('checkpoint');
    if (event.type === 'goldenChip' && !this.reduced.matches) {
      this.point.set(event.at[0], 0.6, event.at[1]);
      this.particles.burst('chip', this.point, 28);
    }
    if (event.type === 'finish') {
      audio.play('win');
      const exit = this.world?.props.find((prop) => prop.symbol === 'E');
      if (exit && !this.reduced.matches) {
        this.point.set(exit.at[0], 0.5, exit.at[1]);
        this.particles.burst('confetti', this.point, 65);
        const bounds = this.context.host.getBoundingClientRect();
        this.point.project(this.view.camera);
        exitConfetti(
          bounds.left + ((this.point.x + 1) * bounds.width) / 2,
          bounds.top + ((1 - this.point.y) * bounds.height) / 2,
        );
      }
    }
    if (event.type === 'death') {
      audio.play('death');
      this.avatar.die(event.t);
      if (!this.reduced.matches) this.view.shake();
      if (!this.reduced.matches) {
        const flash = document.createElement('div');
        flash.className = 'death-flash';
        this.context.host.append(flash);
        void flash
          .animate([{ opacity: 0.25 }, { opacity: 0 }], { duration: 180 })
          .finished.then(() => flash.remove());
      }
      if (!this.reduced.matches) {
        this.point.set(event.at[0], 0.38, event.at[1]);
        this.particles.burst('spark', this.point, 17);
        this.particles.burst('puff', this.point, 13);
      }
    }
    if (event.type === 'respawn' && !this.reduced.matches) {
      this.point.set(event.at[0], 0.22, event.at[1]);
      this.particles.burst('puff', this.point, 16);
    }
    if (event.type === 'press' && this.state) {
      const player = this.players.find(
        (member) => member.id === event.playerId,
      );
      if (player)
        this.hands.add(
          player.nickname,
          player.color,
          event.button,
          performance.now(),
        );
    }
  }
  private applyQuality(): void {
    if (!this.gpu) return;
    this.gpu.shadowMap.enabled = this.quality.detailed;
    this.gpu.shadowMap.needsUpdate = true;
    this.particles.node.visible =
      this.quality.detailed && !this.reduced.matches;
    this.context.host.dataset.quality = this.quality.detailed ? 'high' : 'low';
  }
  private resize(): void {
    if (!this.gpu || this.destroyed) return;
    const width = Math.max(1, this.context.host.clientWidth);
    const height = Math.max(1, this.context.host.clientHeight);
    this.gpu.setSize(width, height);
    this.view.resize(width, height);
    this.particles.resize(height, this.gpu.getPixelRatio());
    this.bloom.resize(
      width * this.gpu.getPixelRatio(),
      height * this.gpu.getPixelRatio(),
    );
  }
  private frame = (timestamp: number): void => {
    this.raf = 0;
    if (this.destroyed || document.hidden || !this.gpu) return;
    const rawDt = this.lastFrame ? (timestamp - this.lastFrame) / 1000 : 1 / 60;
    this.lastFrame = timestamp;
    const dt = Math.min(0.08, rawDt);
    if (this.state && this.world) {
      const now = Math.max(0, this.context.clock.now() - this.startTime);
      const state = this.state;
      const hop = state.hop;
      const reduced = this.reduced.matches;
      const progress =
        hop && !reduced
          ? Math.min(
              1,
              Math.max(0, (now - hop.startT) / (hop.endT - hop.startT)),
            )
          : 1;
      const x = hop
        ? hop.from[0] + (hop.to[0] - hop.from[0]) * progress
        : state.position[0];
      const z = hop
        ? hop.from[1] + (hop.to[1] - hop.from[1]) * progress
        : state.position[1];
      this.avatar.root.visible = true;
      this.avatar.root.position.set(x, 0.045, z);
      const panic = this.world.level.objects.some(
        (object) =>
          object.type === 'slicer' &&
          Math.abs(object.at[0] - state.position[0]) +
            Math.abs(object.at[1] - state.position[1]) <=
            1,
      );
      this.avatar.frame(
        now,
        hop && progress < 1 ? progress : 0,
        state.facing,
        panic,
        state.status === 'dead',
        reduced,
      );
      this.world.frame(
        state,
        now,
        dt,
        this.factor,
        reduced,
        this.particles,
        () => this.context.audio.play('slicer'),
      );
      const raised = this.world.props.some(
        (prop) =>
          prop.symbol === 'S' &&
          prop.active &&
          (prop.moving?.position.y ?? 0) > 0.3,
      );
      if (raised !== this.sawRaised) {
        this.sawRaised = raised;
        this.context.host.dataset.sawRaised = String(raised);
      }
      this.view.frame(x, z, dt, reduced);
      this.hands.frame(
        timestamp,
        reduced,
        x,
        z,
        this.view.worldUnitsPerPixel(this.context.host.clientHeight),
      );
      this.point.set(x, 0, z);
      this.particles.frame(dt, now, this.point);
      this.light.target.position.set(x, 0, z);
      this.light.position.set(x - 3, 9, z + 5);
      if (this.quality.detailed && this.frameCount % 2 === 0)
        this.gpu.shadowMap.needsUpdate = true;
      if (this.frameCount > 3 && this.quality.frame(rawDt)) this.applyQuality();
      this.gpu.info.reset();
      this.gpu.render(this.scene, this.view.camera);
      if (this.quality.detailed)
        this.bloom.render(this.gpu, this.scene, this.view.camera);
      this.frameCount++;
      if (this.frameCount === 3 || this.frameCount % 30 === 0) {
        this.context.host.dataset.roomBounds = JSON.stringify(
          this.view.bounds(),
        );
        this.context.host.dataset.ready = 'true';
      }
      if (this.frameCount % 60 === 0) {
        this.context.host.dataset.fps = this.quality.fps.toFixed(0);
        this.context.host.dataset.drawCalls = String(
          this.gpu.info.render.calls,
        );
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  visibility(): void {
    if (this.destroyed || !this.gpu) return;
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastFrame = 0;
      this.quality.resetSample();
    } else if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }
  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.abort.abort();
    this.hands.clear();
    this.world?.dispose();
    this.particles.dispose();
    this.bloom.dispose();
    this.resources.dispose();
    this.scene.clear();
    this.light.shadow.dispose();
    this.gpu?.dispose();
    this.gpu?.forceContextLoss();
    this.gpu?.domElement.remove();
    this.gpu = null;
  }
}
