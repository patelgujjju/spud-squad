import {
  Box3,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RGBADepthPacking,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import type { Material, Object3D, PerspectiveCamera } from 'three';
import type { Level, SpudView } from '@spud-squad/shared';
import { slicerAt } from '@spud-squad/shared';
import { Resources } from '../three/resources.js';
import type { FactoryParticles } from '../three/particles.js';
import type { QualityTier } from '../three/performance.js';
import { RoomBatches } from './batches.js';
import { dither, FactoryMaterials } from './materials.js';
import { furnish, hash } from './variants.js';
import type { FactoryPack } from './assets.js';

interface Device {
  symbol: string;
  at: readonly [number, number];
  root: Object3D;
  rotor?: Object3D;
  beacon?: MeshStandardMaterial[];
  active: boolean;
  seen: boolean;
}
export class FactoryRoom {
  readonly root = new Group();
  readonly bounds: Box3;
  readonly window = new Vector3();
  readonly lamps: PointLight[] = [];
  readonly beaconLight = new PointLight(0xff3023, 0, 3, 2);
  readonly devices: Device[] = [];
  readonly materials: FactoryMaterials;
  readonly batches: RoomBatches;
  private geometry = new Resources();
  private extraMaterials: Material[] = [];
  private textures: CanvasTexture[] = [];
  private puddles: MeshPhysicalMaterial[] = [];
  private washers: Vector3[] = [];
  private point = new Vector3();
  private sightPoints: Vector3[] = [];
  private atmosphere = new Group();
  private steamAt = 0;
  private tier: QualityTier;
  constructor(
    readonly level: Level,
    seed: number,
    pack: FactoryPack,
    tier: QualityTier,
  ) {
    this.tier = tier;
    this.materials = new FactoryMaterials(pack.maps, tier);
    this.batches = new RoomBatches(this.materials);
    const w = level.map[0]!.length,
      d = level.map.length;
    this.bounds = new Box3(
      new Vector3(-2.5, 0, -2.5),
      new Vector3(w + 1.5, 5.6, d + 2.5),
    );
    this.window.set(3, 2, -2.35);
    const transform = (
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0,
    ): Matrix4 => {
      const q = new Quaternion().setFromEuler(new Euler(rx, ry, rz));
      return new Matrix4().compose(
        new Vector3(x, y, z),
        q,
        new Vector3(1, 1, 1),
      );
    };
    const box = (
      name: string,
      bw: number,
      bh: number,
      bd: number,
      x: number,
      y: number,
      z: number,
      occludes = false,
      rx = 0,
      ry = 0,
      rz = 0,
    ): void => {
      const matrix = transform(x, y, z, rx, ry, rz);
      const id = occludes
        ? this.batches.occluder(
            new Box3(
              new Vector3(-bw / 2, -bh / 2, -bd / 2),
              new Vector3(bw / 2, bh / 2, bd / 2),
            ).applyMatrix4(matrix),
          )
        : -1;
      this.batches.add(this.geometry.box(bw, bh, bd), name, matrix, id);
    };
    // A continuous room floor and tall walls continue beyond the logical grid.
    for (let z = -2; z <= d + 2; z++)
      for (let x = -2; x <= w + 1; x++) {
        box(
          level.world === 2 ? 'steel' : 'ceramic',
          0.99,
          0.12,
          0.99,
          x,
          -0.06,
          z,
        );
        if (hash(seed, x, z) % 17 === 0) this.puddle(x, z, hash(seed, x, z));
      }
    for (let x = -2; x <= w + 1; x++)
      for (let y = 0.5; y < 5.6; y++) {
        const opening = x >= 2 && x <= 4 && y >= 1 && y < 3;
        if (!opening)
          box(
            y < 1.6 ? 'paint' : 'concrete',
            0.995,
            0.995,
            0.24,
            x,
            y,
            -2.5,
            true,
          );
        box(
          y < 1.6 ? 'paint' : 'concrete',
          0.995,
          0.995,
          0.24,
          x,
          y,
          d + 2.5,
          true,
        );
      }
    for (let z = -2; z <= d + 2; z++)
      for (let y = 0.5; y < 5.6; y++)
        for (const x of [-2.5, w + 1.5])
          box(
            y < 1.6 ? 'paint' : 'concrete',
            0.24,
            0.995,
            0.995,
            x,
            y,
            z,
            true,
          );
    for (const z of [-1, d + 1]) {
      box('metal', w + 4, 0.1, 0.28, (w - 1) / 2, 5.38, z, true);
      box('metal', w + 4, 0.28, 0.07, (w - 1) / 2, 5.2, z, true);
      box('metal', w + 4, 0.08, 0.24, (w - 1) / 2, 5.03, z, true);
    }
    // Door/window details anchor the camera in a physical industrial interior.
    const daylight = this.decal(768, 512, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#d9edf3');
      g.addColorStop(1, '#819da5');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 768, 512);
      ctx.fillStyle = '#71898b';
      ctx.fillRect(0, 390, 768, 122);
      ctx.fillRect(480, 270, 190, 160);
      ctx.fillStyle = '#a4b8ba';
      ctx.fillRect(80, 310, 200, 130);
    });
    const windowMat = new MeshBasicMaterial({ map: daylight, color: 0xcde6f0 });
    this.extraMaterials.push(windowMat);
    const pane = new Mesh(new PlaneGeometry(3, 2), windowMat);
    pane.position.copy(this.window);
    this.root.add(pane);
    for (const dx of [-1.5, -0.5, 0.5, 1.5])
      box('metal', 0.055, 2.1, 0.12, this.window.x + dx, 2, -2.23);
    for (const y of [0.95, 2, 3.05])
      box('metal', 3.1, 0.06, 0.12, this.window.x, y, -2.23);
    this.sign(
      'CRISPY CO.',
      'WASH • SORT • DISPATCH',
      -0.1,
      2.2,
      -2.32,
      2.5,
      0.7,
    );
    for (const x of [-1.65, w + 0.75]) {
      box('metal', 0.075, 4.6, 0.075, x, 2.3, -2.29);
      for (const y of [0.5, 1.8, 3.4])
        box('dark', 0.19, 0.06, 0.12, x, y, -2.24);
      const valve = new Mesh(
        new TorusGeometry(0.14, 0.018, 6, 18),
        this.materials.get('red'),
      );
      valve.position.set(x, 1.65, -2.12);
      this.root.add(valve);
      box('red', 0.28, 0.026, 0.035, x, 1.65, -2.1, false, 0, 0, 0.6);
    }
    for (const [x, z] of [
      [1.1, 0.1],
      [w - 2, d - 0.4],
    ])
      this.lamp(x!, 3.65, z!);
    for (const entry of furnish(level, seed)) {
      const prototype = pack.models.getObjectByName(entry.variant);
      if (!prototype)
        throw new Error('Missing compressed prop: ' + entry.variant);
      this.batches.model(
        prototype,
        transform(entry.x, 0, entry.z, 0, entry.rotation),
      );
      if (entry.variant === 'washer')
        this.washers.push(new Vector3(entry.x + 0.25, 1.1, entry.z - 0.2));
    }
    level.map.forEach((row, z) =>
      [...row].forEach((symbol, x) => {
        if (symbol === '#') return;
        this.sightPoints.push(new Vector3(x, 0.08, z));
        // Safety paint follows the actual walkable topology without changing it.
        for (const [dx, dz] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          if (level.map[z + dz!]?.[x + dx!] === '#')
            box(
              'yellow',
              dx ? 0.045 : 0.91,
              0.006,
              dz ? 0.045 : 0.91,
              x + dx! * 0.455,
              0.004,
              z + dz! * 0.455,
            );
        }
        if (hash(seed + 17, x, z) % 7 === 0) this.drain(x, z);
        if (['S', 'E', 'C'].includes(symbol)) this.device(symbol, x, z, pack);
        if ('><^v'.includes(symbol)) {
          const model = pack.models.getObjectByName('conveyor');
          if (model)
            this.batches.model(
              model,
              transform(
                x,
                0,
                z,
                0,
                symbol === '^'
                  ? Math.PI / 2
                  : symbol === 'v'
                    ? -Math.PI / 2
                    : symbol === '<'
                      ? Math.PI
                      : 0,
              ),
            );
        }
      }),
    );
    if (level.goldenChip)
      this.device('G', level.goldenChip[0], level.goldenChip[1], pack);
    this.batches.build(this.root);
    this.contactOcclusion(seed);
    this.lightShafts();
    this.atmosphere.visible = tier !== 'low';
    this.root.add(this.atmosphere);
    this.root.add(this.beaconLight);
  }
  // Static contact AO is baked into a shared mask, independent of dynamic shadows.
  private contactOcclusion(seed: number): void {
    const mask = this.decal(64, 64, (ctx) => {
      const gradient = ctx.createRadialGradient(32, 32, 8, 32, 32, 32);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.65, '#aaaaaa');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    });
    const material = new MeshBasicMaterial({
      color: 0x101716,
      alphaMap: mask,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    this.extraMaterials.push(material);
    const entries = furnish(this.level, seed);
    const pads = new InstancedMesh(
      new PlaneGeometry(1.28, 1.28),
      material,
      entries.length,
    );
    const rotation = new Quaternion().setFromEuler(
      new Euler(-Math.PI / 2, 0, 0),
    );
    entries.forEach((entry, index) => {
      pads.setMatrixAt(
        index,
        new Matrix4().compose(
          new Vector3(entry.x, 0.002, entry.z),
          rotation,
          new Vector3(1, 1, 1),
        ),
      );
    });
    pads.computeBoundingSphere();
    this.root.add(pads);
  }
  private lightShafts(): void {
    const mask = this.decal(64, 128, (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 128);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 128);
    });
    const material = new MeshBasicMaterial({
      color: 0xb6d8e6,
      alphaMap: mask,
      transparent: true,
      opacity: 0.045,
      side: DoubleSide,
      depthWrite: false,
    });
    this.extraMaterials.push(material);
    for (const dx of [-0.65, 0.65]) {
      const shaft = new Mesh(new PlaneGeometry(0.9, 3.4), material);
      shaft.position.set(this.window.x + dx, 1.1, this.window.z + 1.2);
      shaft.rotation.x = -0.8;
      this.atmosphere.add(shaft);
    }
  }
  private decal(
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d')!);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.textures.push(texture);
    return texture;
  }
  private sign(
    title: string,
    subtitle: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
  ): void {
    const texture = this.decal(1024, 256, (ctx) => {
      ctx.fillStyle = '#233a40';
      ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = '#a6b3aa';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 1008, 240);
      ctx.fillStyle = '#dacfac';
      ctx.textAlign = 'center';
      ctx.font = '800 108px Arial';
      ctx.fillText(title, 512, 137);
      ctx.font = '24px Arial';
      ctx.fillText(subtitle, 512, 198);
      for (let i = 0; i < 800; i++) {
        ctx.fillStyle = i % 2 ? '#233a4077' : '#9b9c8833';
        ctx.fillRect(
          hash(71, i, 0) % 1024,
          hash(71, i, 1) % 256,
          (hash(71, i, 2) % 7) + 1,
          2,
        );
      }
    });
    const material = new MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.2,
    });
    this.root.add(
      this.geometry.mesh(
        this.geometry.box(width + 0.08, height + 0.08, 0.065),
        this.materials.get('dark'),
        x,
        y,
        z - 0.035,
      ),
    );
    const sign = new Mesh(new PlaneGeometry(width, height), material);
    sign.position.set(x, y, z);
    this.root.add(sign);
    this.extraMaterials.push(material);
  }
  private lamp(x: number, y: number, z: number): void {
    const cable = new Mesh(
      new CylinderGeometry(0.012, 0.012, 5.25 - y, 6),
      this.materials.get('dark'),
    );
    cable.position.set(x, (5.25 + y) / 2, z);
    const shade = new Mesh(
      new ConeGeometry(0.28, 0.22, 20, 1, true),
      this.materials.get('metal'),
    );
    shade.position.set(x, y, z);
    const material = new MeshBasicMaterial({ color: 0xffcf92 });
    this.extraMaterials.push(material);
    const bulb = new Mesh(new SphereGeometry(0.08, 10, 8), material);
    bulb.position.set(x, y - 0.04, z);
    bulb.layers.enable(1);
    this.root.add(cable, shade, bulb);
    const light = new PointLight(0xffc184, 20, 8, 2);
    light.position.set(x, y - 0.15, z);
    this.root.add(light);
    this.lamps.push(light);
  }
  private puddle(x: number, z: number, seed: number): void {
    const mask = this.decal(64, 64, (ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 64, 64);
      const gradient = ctx.createRadialGradient(31, 31, 12, 32, 32, 29);
      gradient.addColorStop(0, '#ddd');
      gradient.addColorStop(0.7, '#bbb');
      gradient.addColorStop(1, '#000');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const r = 26 + Math.sin(a * 5) * 3;
        if (!i) ctx.moveTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
        else ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    });
    const geometry = new PlaneGeometry(
      0.35 + (seed % 30) / 100,
      0.2 + (seed % 20) / 100,
    );
    const m = new MeshPhysicalMaterial({
      color: 0x899c9e,
      transparent: true,
      opacity: 0.42,
      alphaMap: mask,
      roughness: 0.06,
      metalness: 0.1,
      clearcoat: 1,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, m);
    mesh.rotation.set(-Math.PI / 2, 0, (seed % 60) / 100);
    mesh.position.set(x + 0.14, 0.003, z - 0.12);
    this.root.add(mesh);
    this.puddles.push(m);
    this.extraMaterials.push(m);
  }
  private drain(x: number, z: number): void {
    const back = new Mesh(
      this.geometry.box(0.24, 0.01, 0.24),
      this.materials.get('dark'),
    );
    back.position.set(x, 0.008, z);
    this.root.add(back);
    for (let i = 0; i < 6; i++) {
      const rail = new Mesh(
        this.geometry.box(0.014, 0.012, 0.22),
        this.materials.get('metal'),
      );
      rail.position.set(x - 0.095 + i * 0.038, 0.016, z);
      this.root.add(rail);
    }
  }
  private device(
    symbol: string,
    x: number,
    z: number,
    pack: FactoryPack,
  ): void {
    const name =
      symbol === 'S'
        ? 'slicer'
        : symbol === 'E'
          ? 'exit'
          : symbol === 'G'
            ? 'pedestal'
            : 'pedestal';
    const model = pack.models.getObjectByName(name)?.clone(true);
    if (!model) throw new Error('Missing device: ' + name);
    model.position.set(x, 0, z);
    this.root.add(model);
    model.updateMatrixWorld(true);
    const visibility = this.batches.dynamic(model);
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    dither(depth, visibility);
    this.extraMaterials.push(depth);
    model.traverse((node) => {
      if (node instanceof Mesh) {
        const source = Array.isArray(node.material)
          ? node.material[0]!
          : node.material;
        node.material = this.materials.unique(source.name, visibility);
        node.castShadow = true;
        node.customDepthMaterial = depth;
        node.receiveShadow = true;
      }
    });
    const device: Device = {
      symbol,
      at: [x, z],
      root: model,
      active: false,
      seen: false,
    };
    if (symbol === 'S') {
      const rotor = model.getObjectByName('rotor');
      if (rotor) device.rotor = rotor;
      device.beacon = [];
      model.getObjectByName('beacon')?.traverse((node) => {
        if (
          node instanceof Mesh &&
          node.material instanceof MeshStandardMaterial &&
          node.material.name === 'red'
        ) {
          node.material.emissive.set(0xe92d1d);
          node.material.emissiveIntensity = 0;
          node.layers.enable(1);
          device.beacon!.push(node.material);
        }
      });
      this.beaconLight.position.set(x + 0.34, 1.12, z - 0.24);
    } else if (symbol === 'E') {
      const sign = this.decal(512, 128, (ctx) => {
        ctx.fillStyle = '#12382d';
        ctx.fillRect(0, 0, 512, 128);
        ctx.fillStyle = '#b8f2cf';
        ctx.font = 'bold 76px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', 256, 92);
      });
      const material = new MeshBasicMaterial({ map: sign, color: 0xa9ffcb });
      this.extraMaterials.push(material);
      const plate = new Mesh(new PlaneGeometry(0.79, 0.21), material);
      plate.position.set(0, 2.0, -0.028);
      plate.layers.enable(1);
      model.add(plate);
    } else if (symbol === 'G') {
      const geometry = new SphereGeometry(1, 24, 12);
      const p = geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i),
          py = p.getY(i),
          pz = p.getZ(i);
        p.setXYZ(
          i,
          px * 0.22,
          py * 0.018 + Math.sin(px * 3.5) * Math.sin(pz * 3.3) * 0.045,
          pz * 0.27,
        );
      }
      geometry.computeVertexNormals();
      const material = new MeshStandardMaterial({
        color: 0xdcb55f,
        metalness: 0.35,
        roughness: 0.32,
        emissive: 0xbb7a22,
        emissiveIntensity: 0.18,
      });
      const crisp = new Mesh(geometry, material);
      crisp.position.y = 0.44;
      crisp.rotation.z = 0.3;
      crisp.layers.enable(1);
      model.add(crisp);
      device.rotor = crisp;
      this.extraMaterials.push(material);
      const lamp = new Mesh(
        new CylinderGeometry(0.095, 0.095, 0.014, 20),
        new MeshBasicMaterial({ color: 0xffd88c }),
      );
      lamp.position.y = 0.21;
      model.add(lamp);
    } else {
      const basket = new Mesh(
        new CylinderGeometry(0.29, 0.25, 0.22, 16, 1, true),
        this.materials.get('wood'),
      );
      basket.position.y = 0.22;
      model.add(basket);
      const rim = new Mesh(
        new TorusGeometry(0.285, 0.023, 6, 20),
        this.materials.get('metal'),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.34;
      model.add(rim);
    }
    this.devices.push(device);
  }
  frame(
    state: SpudView,
    now: number,
    dt: number,
    factor: number,
    particles: FactoryParticles,
    whoosh: () => void,
  ): void {
    for (const device of this.devices) {
      const key = device.at.join(',');
      if (device.symbol === 'S') {
        const slicer = this.level.objects.find(
          (value) =>
            value.type === 'slicer' &&
            value.at[0] === device.at[0] &&
            value.at[1] === device.at[1],
        );
        if (slicer?.type !== 'slicer') continue;
        const phase = slicerAt(
          slicer,
          Math.floor(now),
          factor,
          !state.toggledDevices.includes(key),
        );
        if (device.seen && phase.active && !device.active) whoosh();
        device.seen = true;
        device.active = phase.active;
        if (device.rotor) {
          device.rotor.position.y +=
            ((phase.active ? 0.61 : 0.2) - device.rotor.position.y) *
            (1 - Math.exp(-dt * 20));
          device.rotor.rotation.z = phase.active ? now / 65 : 0;
        }
        const strength = phase.warning
          ? 0.8 + Math.sin(now / 35) * 0.2
          : phase.active
            ? 0.2
            : 0;
        device.beacon?.forEach((material) => {
          material.emissiveIntensity = strength * 3;
        });
        this.beaconLight.intensity = strength * 7;
      } else if (device.symbol === 'G' && device.rotor) {
        device.rotor.visible = !state.goldenChip;
        device.rotor.position.y = 0.43 + Math.sin(now / 550) * 0.025;
        device.rotor.rotation.y = now / 1800;
      }
    }
    if (this.tier !== 'low' && now > this.steamAt) {
      this.steamAt = now + 750;
      for (const emitter of this.washers) particles.burst('steam', emitter, 2);
      this.point.set(this.window.x - 0.2, 2.2, this.window.z + 1);
      particles.burst('steam', this.point, 1);
    }
  }
  occlusion(
    camera: PerspectiveCamera,
    x: number,
    z: number,
    dt: number,
  ): number {
    return this.batches.visibility(camera.position, x, z, dt, this.sightPoints);
  }
  quality(pack: FactoryPack, tier: QualityTier): void {
    this.tier = tier;
    this.atmosphere.visible = tier !== 'low';
    this.materials.update(pack.maps, tier);
    this.puddles.forEach((material) => {
      material.envMapIntensity = tier === 'low' ? 0 : 1;
      material.roughness = tier === 'low' ? 0.92 : 0.06;
    });
    this.lamps.forEach((light) => {
      light.intensity = tier === 'low' ? 12 : 20;
    });
  }
  dispose(): void {
    this.batches.dispose();
    this.materials.dispose();
    this.geometry.dispose();
    this.extraMaterials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.root.traverse((node) => {
      if (node instanceof Mesh) node.geometry.dispose();
    });
    this.root.clear();
  }
}
