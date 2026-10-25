import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PCFShadowMap,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { WebGLRenderTarget } from 'three';
import type {
  GameEvent,
  Level,
  PlayerView,
  ServerMessage,
  SpudView,
} from '@spud-squad/shared';
import { RESPAWN_MS } from '@spud-squad/shared';
import type { GameRenderer, RendererContext } from '../renderer.js';
import { Resources } from '../three/resources.js';
import { SpudModel } from '../three/spud.js';
import { PressHands3D } from '../three/hands.js';
import { FactoryParticles } from '../three/particles.js';
import { ToyBloom } from '../three/bloom.js';
import { AdaptiveQuality } from '../three/performance.js';
import type { QualityMode, QualityTier } from '../three/performance.js';
import { getQuality } from '../quality.js';
import { FactoryAssets } from './assets.js';
import { FactoryRoom } from './room.js';
import { FactoryCamera } from './camera.js';
import { PotatoMaterials } from './spud-materials.js';

export class FactoryRenderer implements GameRenderer {
  private gpu: WebGLRenderer | null = null;
  private scene = new Scene();
  private resources = new Resources();
  private spud = new SpudModel(this.resources);
  private skin = new PotatoMaterials(this.spud.root);
  private hands = new PressHands3D(this.resources);
  private particles = new FactoryParticles();
  private bloom = new ToyBloom();
  private view = new FactoryCamera();
  private quality = new AdaptiveQuality(getQuality());
  private assets: FactoryAssets | null = null;
  private room: FactoryRoom | null = null;
  private reflection: WebGLRenderTarget | null = null;
  private key = new DirectionalLight(0xc9e5f3, 3.2);
  private state: SpudView | null = null;
  private players: PlayerView[] = [];
  private startTime = 0;
  private factor = 1;
  private observer: ResizeObserver | null = null;
  private abort = new AbortController();
  private frameId = 0;
  private lastFrame = 0;
  private frameCount = 0;
  private destroyed = false;
  private generation = 0;
  private appliedTier: QualityTier | null = null;
  private sceneReady = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private point = new Vector3();
  private loading = document.createElement('div');
  private intro = document.createElement('div');
  private introTitle = document.createElement('h1');
  private introLabel = document.createElement('p');
  private introTrack = document.createElement('i');
  constructor(private readonly context: RendererContext) {}
  async init(): Promise<void> {
    if (this.destroyed) return;
    const host = this.context.host;
    this.gpu = new WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.gpu.setClearColor(0x172129);
    this.gpu.toneMapping = ACESFilmicToneMapping;
    this.gpu.toneMappingExposure = 1.2;
    this.gpu.shadowMap.type = PCFShadowMap;
    this.gpu.shadowMap.autoUpdate = false;
    this.gpu.info.autoReset = false;
    this.gpu.domElement.setAttribute('aria-hidden', 'true');
    host.append(this.gpu.domElement);
    this.scene.background = new Color(0x172129);
    this.scene.fog = new FogExp2(0x1a2932, 0.027);
    this.scene.add(new HemisphereLight(0xc7e0e7, 0x473e33, 0.8));
    this.key.castShadow = true;
    this.key.shadow.camera.left = -7;
    this.key.shadow.camera.right = 7;
    this.key.shadow.camera.top = 7;
    this.key.shadow.camera.bottom = -7;
    this.key.shadow.camera.near = 0.1;
    this.key.shadow.camera.far = 28;
    this.key.shadow.normalBias = 0.025;
    this.key.shadow.bias = -0.0002;
    this.scene.add(
      this.key,
      this.key.target,
      this.spud.root,
      this.hands.root,
      this.particles.node,
    );
    this.spud.root.scale.setScalar(1.12);
    this.spud.root.visible = false;
    this.assets = new FactoryAssets(this.gpu);
    this.loading.className = 'world-loading';
    this.loading.setAttribute('role', 'status');
    host.append(this.loading);
    this.intro.className = 'factory-intro';
    this.introLabel.className = 'factory-intro-label';
    const skip = document.createElement('p');
    skip.className = 'factory-intro-skip';
    skip.textContent = 'Any press skips the fly-over';
    this.intro.append(this.introLabel, this.introTitle, skip, this.introTrack);
    host.append(this.intro);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    const signal = this.abort.signal;
    window.addEventListener(
      'spud-quality-change',
      (event) => {
        this.quality.setMode((event as CustomEvent<QualityMode>).detail);
        void this.applyQuality();
      },
      { signal },
    );
    window.addEventListener('pointerdown', () => this.skipIntro(), {
      signal,
      capture: true,
    });
    window.addEventListener(
      'keydown',
      (event) => {
        this.skipIntro();
        if (event.code === 'KeyV') this.setOverview(true);
      },
      { signal },
    );
    window.addEventListener(
      'keyup',
      (event) => {
        if (event.code === 'KeyV') this.setOverview(false);
      },
      { signal },
    );
    window.addEventListener('blur', () => this.setOverview(false), { signal });
    this.reduced.addEventListener(
      'change',
      () => {
        void this.applyQuality();
      },
      { signal },
    );
    host.dataset.renderer = 'factory';
    host.dataset.ready = 'false';
    this.resize();
    this.visibility();
  }
  async setLevel(
    level: Level,
    start: Extract<ServerMessage, { type: 'levelStart' }>,
  ): Promise<void> {
    if (!this.gpu || !this.assets || this.destroyed) return;
    const token = ++this.generation;
    this.sceneReady = false;
    this.context.host.dataset.ready = 'false';
    this.loading.hidden = false;
    this.loading.textContent =
      'LOADING ' + (level.world === 1 ? 'WASH & SORT' : 'SLICER HALL') + '…';
    const pack = await this.assets.load(
      this.quality.tier,
      (fraction, label) => {
        if (token === this.generation && !this.destroyed)
          this.loading.textContent =
            'LOADING FACTORY · ' + Math.round(fraction * 100) + '%\n' + label;
      },
    );
    if (token !== this.generation || this.destroyed) return;
    if (this.room) {
      this.scene.remove(this.room.root);
      this.room.dispose();
    }
    this.room = new FactoryRoom(level, start.seed, pack, this.quality.tier);
    this.scene.add(this.room.root);
    this.startTime = start.startTime;
    this.factor = start.groupFactor;
    this.frameCount = 0;
    this.view.configure(level, this.room.bounds, performance.now());
    // Place the daylight source just inside the opening, so the lintel does not
    // shadow the entire playable floor on small rooms.
    this.key.position.copy(this.room.window).add(new Vector3(-0.5, 2.2, 1.5));
    this.key.target.position.set(level.start[0] + 1, 0, level.start[1] + 2);
    this.introTitle.textContent = level.id + ' / ' + level.name;
    this.introLabel.textContent =
      'CRISPY CO. — ' + (level.world === 1 ? 'WASH AND SORT' : 'SLICER HALL');
    this.resize();
    await this.applyQuality(pack.environment);
    const position = this.state?.position ?? level.start;
    this.spud.root.visible = true;
    this.spud.root.position.set(position[0], 0.012, position[1]);
    this.view.frame(
      position[0],
      position[1],
      this.state?.facing ?? 'RIGHT',
      performance.now(),
      1 / 60,
      true,
    );
    this.loading.textContent = 'PREPARING FACTORY LIGHTING';
    await this.gpu.compileAsync(this.scene, this.view.camera);
    if (this.destroyed || token !== this.generation) return;
    this.gpu.shadowMap.needsUpdate = true;
    this.gpu.render(this.scene, this.view.camera);
    if (this.quality.tier === 'high')
      this.bloom.render(this.gpu, this.scene, this.view.camera);
    this.view.configure(level, this.room.bounds, performance.now());
    this.sceneReady = true;
    this.loading.hidden = true;
    this.visibility();
  }
  setPlayers(players: PlayerView[]): void {
    this.players = players;
  }
  setState(state: SpudView): void {
    if (state.status === 'dead' && this.state?.status !== 'dead')
      this.spud.die((state.respawnAt ?? state.time + RESPAWN_MS) - RESPAWN_MS);
    if (state.status === 'playing' && this.state?.status === 'dead')
      this.spud.respawn(state.time);
    this.state = state;
    const host = this.context.host;
    host.dataset.position = state.position.join(',');
    host.dataset.status = state.status;
    host.setAttribute(
      'aria-label',
      'Factory room. Spud at ' +
        state.position.join(',') +
        '. ' +
        state.deaths +
        ' deaths.',
    );
  }
  event(event: GameEvent): void {
    const audio = this.context.audio;
    if (event.type === 'press') {
      this.skipIntro();
      const player = this.players.find((value) => value.id === event.playerId);
      if (player)
        this.hands.add(
          player.nickname,
          player.color,
          event.button,
          performance.now(),
        );
    }
    if (event.type === 'hop') {
      audio.play('step');
      if (!this.reduced.matches) {
        this.point.set(event.hop.from[0], 0.1, event.hop.from[1]);
        this.particles.burst('puff', this.point, 4);
      }
    }
    if (event.type === 'checkpoint') audio.play('checkpoint');
    if (event.type === 'finish') audio.play('win');
    if (event.type === 'death') {
      audio.play('death');
      this.spud.die(event.t);
      if (!this.reduced.matches) {
        this.view.shake();
        this.point.set(event.at[0], 0.4, event.at[1]);
        this.particles.burst('spark', this.point, 12);
      }
    }
    if (event.type === 'respawn' && !this.reduced.matches) {
      this.point.set(event.at[0], 0.15, event.at[1]);
      this.particles.burst('puff', this.point, 12);
    }
    if (event.type === 'goldenChip' && !this.reduced.matches) {
      this.point.set(event.at[0], 0.4, event.at[1]);
      this.particles.burst('chip', this.point, 20);
    }
  }
  skipIntro(): void {
    this.view.skip();
  }
  setOverview(active: boolean): void {
    this.view.overview(active);
  }
  private async applyQuality(
    environment?: import('three').Texture | null,
  ): Promise<void> {
    if (!this.gpu || this.destroyed) return;
    const tier = this.quality.tier;
    this.gpu.setPixelRatio(
      Math.min(
        devicePixelRatio,
        tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1,
      ),
    );
    this.gpu.shadowMap.enabled = tier !== 'low';
    this.key.shadow.mapSize.set(
      tier === 'high' ? 1024 : 512,
      tier === 'high' ? 1024 : 512,
    );
    this.key.shadow.map?.dispose();
    this.key.shadow.map = null;
    this.gpu.shadowMap.needsUpdate = true;
    this.particles.node.visible = tier !== 'low' && !this.reduced.matches;
    this.skin.reflections(tier !== 'low');
    this.context.host.dataset.quality = tier;
    if (this.room && this.assets && this.appliedTier !== tier) {
      this.appliedTier = tier;
      const pack = await this.assets.load(tier);
      if (this.destroyed || this.quality.tier !== tier) return;
      this.room.quality(pack, tier);
      environment = pack.environment;
    }
    if (tier === 'low') this.scene.environment = null;
    else if (environment && !this.reflection) {
      const generator = new PMREMGenerator(this.gpu);
      this.reflection = generator.fromEquirectangular(environment);
      generator.dispose();
    }
    if (tier !== 'low' && this.reflection) {
      this.scene.environment = this.reflection.texture;
      this.scene.environmentIntensity = 0.65;
    }
    this.resize();
  }
  private resize(): void {
    if (!this.gpu || this.destroyed) return;
    const width = Math.max(1, this.context.host.clientWidth),
      height = Math.max(1, this.context.host.clientHeight);
    this.gpu.setSize(width, height);
    this.view.resize(width, height);
    this.particles.resize(height, this.gpu.getPixelRatio());
    this.bloom.resize(
      width * this.gpu.getPixelRatio(),
      height * this.gpu.getPixelRatio(),
    );
  }
  private frame = (timestamp: number): void => {
    this.frameId = 0;
    if (this.destroyed || document.hidden || !this.gpu) return;
    const rawDt = this.lastFrame ? (timestamp - this.lastFrame) / 1000 : 1 / 60;
    this.lastFrame = timestamp;
    const dt = Math.min(0.08, rawDt);
    if (this.sceneReady && this.room && this.state) {
      const state = this.state,
        now = Math.max(0, this.context.clock.now() - this.startTime),
        hop = state.hop,
        reduced = this.reduced.matches;
      const p =
        hop && !reduced
          ? Math.min(
              1,
              Math.max(0, (now - hop.startT) / (hop.endT - hop.startT)),
            )
          : 1;
      const x = hop
        ? hop.from[0] + (hop.to[0] - hop.from[0]) * p
        : state.position[0];
      const z = hop
        ? hop.from[1] + (hop.to[1] - hop.from[1]) * p
        : state.position[1];
      this.spud.root.visible = true;
      this.spud.root.position.set(x, 0.012, z);
      const panic = this.room.level.objects.some(
        (value) =>
          value.type === 'slicer' &&
          Math.abs(value.at[0] - state.position[0]) +
            Math.abs(value.at[1] - state.position[1]) <=
            1,
      );
      this.spud.frame(
        now,
        hop && p < 1 ? p : 0,
        state.facing,
        panic,
        state.status === 'dead',
        reduced,
      );
      const intro = this.view.frame(x, z, state.facing, timestamp, dt, reduced);
      this.intro.hidden = this.view.mode !== 'flyover';
      this.introTrack.style.transform = 'scaleX(' + intro + ')';
      this.room.frame(state, now, dt, this.factor, this.particles, () =>
        this.context.audio.play('slicer'),
      );
      const faded = this.room.occlusion(this.view.camera, x, z, dt);
      this.hands.frame(
        timestamp,
        reduced,
        x,
        z,
        this.view.pixels(this.context.host.clientHeight),
      );
      this.point.set(x, 0, z);
      this.particles.frame(dt, now, this.point);
      if (this.frameCount % 2 === 0 && this.quality.tier !== 'low')
        this.gpu.shadowMap.needsUpdate = true;
      if (this.frameCount > 3 && this.quality.frame(rawDt))
        void this.applyQuality();
      this.gpu.info.reset();
      this.gpu.render(this.scene, this.view.camera);
      if (this.quality.tier === 'high')
        this.bloom.render(this.gpu, this.scene, this.view.camera);
      this.frameCount++;
      if (this.frameCount >= 3) {
        this.context.host.dataset.ready = 'true';
        this.context.host.dataset.camera = this.view.mode;
        this.context.host.dataset.faded = String(faded);
        this.context.host.dataset.sawRaised = String(
          this.room.devices.some(
            (device) => device.symbol === 'S' && device.active,
          ),
        );
        this.point.set(x, 0.65, z).project(this.view.camera);
        this.context.host.dataset.heroVisible = String(
          Math.abs(this.point.x) < 0.95 && Math.abs(this.point.y) < 0.95,
        );
      }
      if (this.frameCount % 30 === 0) {
        this.context.host.dataset.fps = this.quality.fps.toFixed(0);
        this.context.host.dataset.drawCalls = String(
          this.gpu.info.render.calls,
        );
      }
    }
    this.frameId = requestAnimationFrame(this.frame);
  };
  visibility(): void {
    if (this.destroyed || !this.gpu) return;
    if (document.hidden) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.lastFrame = 0;
      this.quality.resetSample();
    } else if (!this.frameId) this.frameId = requestAnimationFrame(this.frame);
  }
  destroy(): void {
    this.destroyed = true;
    this.generation++;
    cancelAnimationFrame(this.frameId);
    this.abort.abort();
    this.observer?.disconnect();
    this.hands.clear();
    this.room?.dispose();
    this.skin.dispose();
    this.resources.dispose();
    this.particles.dispose();
    this.bloom.dispose();
    this.reflection?.dispose();
    this.assets?.dispose();
    this.key.shadow.dispose();
    this.scene.clear();
    this.loading.remove();
    this.intro.remove();
    this.gpu?.dispose();
    this.gpu?.forceContextLoss();
    this.gpu?.domElement.remove();
    this.gpu = null;
  }
}
