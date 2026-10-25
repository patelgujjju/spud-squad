import { MeshStandardMaterial, MeshPhysicalMaterial } from 'three';
import type { Material, Texture } from 'three';
import type { FactoryMaps } from './assets.js';
import type { QualityTier } from '../three/performance.js';

export interface Visibility {
  value: number;
}
export function dither(material: Material, visibility: Visibility): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.factoryVisibility = visibility;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
      uniform float factoryVisibility; varying float vFactoryVisibility;
      #ifdef USE_INSTANCING
      attribute float instanceVisibility;
      #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vFactoryVisibility=instanceVisibility;
      #else
      vFactoryVisibility=factoryVisibility;
      #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vFactoryVisibility;',
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
      if(vFactoryVisibility<.999){
        float mask=fract(dot(gl_FragCoord.xy,vec2(.754877666,.569840296)));
        if(mask>vFactoryVisibility)discard;
      }`,
      );
  };
  material.customProgramCacheKey = () => 'factory-visibility-v1';
}
const slots: Record<string, number> = {
  ceramic: 0,
  concrete: 1,
  steel: 2,
  wood: 3,
  enamel: 4,
  burlap: 5,
  dark: 6,
  metal: 7,
  paint: 7,
};
const colors: Record<string, number> = {
  ceramic: 0xd0d7d1,
  concrete: 0x9eafae,
  steel: 0xc4d0d6,
  wood: 0xd6c2a8,
  enamel: 0xe3e8df,
  burlap: 0xc7b696,
  dark: 0x4b5358,
  metal: 0xa8b7c1,
  paint: 0xa2bbc1,
  yellow: 0xc2a147,
  red: 0x9f3026,
  green: 0x568c67,
  gold: 0xe0b752,
  glass: 0x1b303a,
};
export class FactoryMaterials {
  private cache = new Map<string, MeshStandardMaterial>();
  private instances: { name: string; material: MeshStandardMaterial }[] = [];
  private textureClones: Texture[] = [];
  constructor(
    private maps: FactoryMaps,
    private tier: QualityTier,
  ) {}
  private tile(texture: Texture, slot: number): Texture {
    const copy = texture.clone();
    const pad = 0.003;
    // KTX2 preserves the encoder's top-left rows; Three's geometry UVs are bottom-up.
    copy.repeat.set(0.25 - pad * 2, -0.5 + pad * 2);
    copy.offset.set(
      (slot % 4) * 0.25 + pad,
      (Math.floor(slot / 4) + 1) * 0.5 - pad,
    );
    this.textureClones.push(copy);
    return copy;
  }
  private assign(name: string, material: MeshStandardMaterial): void {
    const slot = slots[name];
    if (slot !== undefined) {
      material.map = this.tile(this.maps.color, slot);
      material.normalMap = this.tile(this.maps.normal, slot);
      material.roughnessMap = this.tile(this.maps.orm, slot);
      material.aoMap = this.tile(this.maps.orm, slot);
      material.aoMapIntensity = 1.15;
      material.normalScale.setScalar(name === 'concrete' ? 0.65 : 0.45);
    }
    material.envMapIntensity =
      this.tier === 'low'
        ? 0
        : name === 'ceramic'
          ? 0.7
          : name === 'glass'
            ? 1.2
            : 0.45;
    material.needsUpdate = true;
  }
  get(name: string): MeshStandardMaterial {
    if (this.cache.has(name)) return this.cache.get(name)!;
    const m =
      name === 'glass'
        ? new MeshPhysicalMaterial({
            color: colors[name]!,
            roughness: 0.14,
            metalness: 0.15,
            clearcoat: 0.8,
          })
        : new MeshStandardMaterial({
            color: colors[name] ?? 0x89979c,
            roughness:
              name === 'ceramic'
                ? 0.52
                : name === 'metal' || name === 'steel'
                  ? 0.55
                  : name === 'gold'
                    ? 0.25
                    : 0.85,
            metalness: ['steel', 'metal', 'gold'].includes(name)
              ? 0.72
              : name === 'paint'
                ? 0.25
                : 0,
          });
    m.name = name;
    this.assign(name, m);
    dither(m, { value: 1 });
    this.instances.push({ name, material: m });
    this.cache.set(name, m);
    return m;
  }
  unique(name: string, visibility: Visibility): MeshStandardMaterial {
    const m = this.get(name).clone();
    dither(m, visibility);
    this.instances.push({ name, material: m });
    return m;
  }
  update(maps: FactoryMaps, tier: QualityTier): void {
    for (const texture of this.textureClones) texture.dispose();
    this.textureClones = [];
    this.maps = maps;
    this.tier = tier;
    for (const { name, material } of this.instances)
      this.assign(name, material);
  }
  dispose(): void {
    this.instances.forEach(({ material }) => material.dispose());
    this.textureClones.forEach((texture) => texture.dispose());
    this.cache.clear();
  }
}
