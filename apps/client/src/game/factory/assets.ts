import { SRGBColorSpace, NoColorSpace } from 'three';
import type {
  CompressedTexture,
  Object3D,
  Texture,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { QualityTier } from '../three/performance.js';

const base = '/assets/factory/';
export interface FactoryMaps {
  color: CompressedTexture;
  normal: CompressedTexture;
  orm: CompressedTexture;
}
export interface FactoryPack {
  maps: FactoryMaps;
  models: Object3D;
  environment: Texture | null;
}

export class FactoryAssets {
  private ktx: KTX2Loader;
  private models: Promise<Object3D> | null = null;
  private textures = new Map<QualityTier, Promise<FactoryMaps>>();
  private environment: Promise<Texture> | null = null;
  constructor(gpu: WebGLRenderer) {
    this.ktx = new KTX2Loader()
      .setTranscoderPath(base)
      .setWorkerLimit(1)
      .detectSupport(gpu);
  }
  async load(
    tier: QualityTier,
    progress: (fraction: number, label: string) => void = () => {},
  ): Promise<FactoryPack> {
    let completed = 0;
    const total = tier === 'low' ? 4 : 5;
    const done = (label: string): void => {
      completed++;
      progress(completed / total, label);
    };
    if (!this.models)
      this.models = new GLTFLoader()
        .setMeshoptDecoder(MeshoptDecoder)
        .loadAsync(base + 'props.glb')
        .then((gltf) => gltf.scene);
    if (!this.textures.has(tier))
      this.textures.set(
        tier,
        Promise.all(
          ['color', 'normal', 'orm'].map(async (kind) => {
            const texture = await this.ktx.loadAsync(
              base + 'atlas-' + tier + '-' + kind + '.ktx2',
            );
            texture.colorSpace =
              kind === 'color' ? SRGBColorSpace : NoColorSpace;
            texture.anisotropy =
              tier === 'high' ? 4 : tier === 'medium' ? 2 : 1;
            done('Loading room surfaces');
            return texture;
          }),
        ).then(([color, normal, orm]) => ({
          color: color!,
          normal: normal!,
          orm: orm!,
        })),
      );
    if (tier !== 'low' && !this.environment)
      this.environment = new HDRLoader().loadAsync(base + 'warehouse.hdr');
    const [models, maps, environment] = await Promise.all([
      this.models.then((model) => {
        done('Bringing in the machinery');
        return model;
      }),
      this.textures.get(tier)!,
      tier === 'low'
        ? Promise.resolve(null)
        : this.environment!.then((texture) => {
            done('Filtering industrial reflections');
            return texture;
          }),
    ]);
    progress(1, 'Building room lighting');
    return { models, maps, environment };
  }
  dispose(): void {
    this.ktx.dispose();
    for (const maps of this.textures.values())
      void maps.then((value) =>
        Object.values(value).forEach((texture) => texture.dispose()),
      );
    if (this.environment)
      void this.environment.then((texture) => texture.dispose());
    if (this.models)
      void this.models.then((root) =>
        root.traverse((node) => {
          if (
            'geometry' in node &&
            node.geometry &&
            typeof node.geometry === 'object' &&
            'dispose' in node.geometry
          ) {
            (node.geometry as { dispose(): void }).dispose();
          }
        }),
      );
  }
}
