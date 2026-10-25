import {
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
const COUNT = 180;
const DUST = 12;
interface Particle {
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: [number, number, number];
  gravity: number;
  shape: number;
  opacity: number;
}
export class FactoryParticles {
  private positions = new Float32Array(COUNT * 3);
  private colors = new Float32Array(COUNT * 3);
  private sizes = new Float32Array(COUNT);
  private alpha = new Float32Array(COUNT);
  private shapes = new Float32Array(COUNT);
  private particles: Particle[] = [];
  private cursor = 0;
  private geometry = new BufferGeometry();
  private material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { viewport: { value: 500 } },
    vertexShader:
      'attribute vec3 tint;attribute float size;attribute float opacity;attribute float shape;varying vec3 vTint;varying float vOpacity;varying float vShape;uniform float viewport;void main(){vTint=tint;vOpacity=opacity;vShape=shape;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=max(1.,size*viewport*projectionMatrix[1][1]/max(.1,-mv.z));}',
    fragmentShader: `varying vec3 vTint;varying float vOpacity;varying float vShape;
      void main(){vec2 p=gl_PointCoord-.5;float d=length(p)*2.;float a=1.;
      if(vShape>1.5){if(abs(p.x)>.44||abs(p.y)>.22)discard;}
      else if(vShape>.5){float edge=.58+.30*cos(atan(p.y,p.x)*4.);if(d>edge)discard;}
      else{if(d>1.)discard;a=1.-smoothstep(.25,1.,d);}
      gl_FragColor=vec4(vTint,vOpacity*a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  readonly node = new Points(this.geometry, this.material);
  constructor() {
    for (const [name, array, size] of [
      ['position', this.positions, 3],
      ['tint', this.colors, 3],
      ['size', this.sizes, 1],
      ['opacity', this.alpha, 1],
      ['shape', this.shapes, 1],
    ] as const)
      this.geometry.setAttribute(name, new BufferAttribute(array, size));
    this.node.frustumCulled = false;
    for (let i = 0; i < COUNT; i++)
      this.particles.push({
        age: 100,
        life: 0,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0,
        color: [1, 1, 1],
        gravity: 0,
        shape: 0,
        opacity: 1,
      });
  }
  resize(height: number, ratio: number): void {
    this.material.uniforms.viewport!.value = height * ratio;
  }
  burst(
    kind: 'puff' | 'steam' | 'spark' | 'chip' | 'confetti',
    origin: Vector3,
    count: number,
  ): void {
    if (!this.node.visible) return;
    const candy: [number, number, number][] = [
      [1, 0.19, 0.19],
      [0.08, 0.55, 1],
      [1, 0.73, 0.06],
      [0.08, 0.8, 0.5],
      [0.65, 0.26, 1],
    ];
    for (let i = 0; i < count; i++) {
      const index = (this.cursor++ % (COUNT - DUST)) + DUST;
      const angle = i * 2.39996 + this.cursor;
      const puff = kind === 'puff';
      const steam = kind === 'steam';
      const confetti = kind === 'confetti';
      const speed = steam
        ? 0.05
        : puff
          ? 0.48
          : confetti
            ? 1.65
            : kind === 'spark'
              ? 1.5
              : 0.6;
      this.particles[index] = {
        age: 0,
        life: steam ? 2.6 : confetti ? 1.7 : puff ? 0.45 : 0.8,
        x: origin.x,
        y: origin.y,
        z: origin.z,
        vx: Math.cos(angle) * speed,
        vy: steam
          ? 0.19
          : puff
            ? 0.4 + (i % 3) * 0.1
            : confetti
              ? 2 + (i % 5) * 0.2
              : 1 + (i % 4) * 0.2,
        vz: Math.sin(angle) * speed,
        size: steam ? 0.42 : puff ? 0.2 : confetti ? 0.1 : 0.11,
        color: steam
          ? [0.77, 0.85, 0.87]
          : puff
            ? [1, 0.98, 0.9]
            : confetti
              ? candy[i % candy.length]!
              : kind === 'spark'
                ? [1, 0.25, 0.15]
                : [1, 0.82, 0.15],
        gravity: steam || puff ? 0 : confetti ? 2.6 : 2.2,
        shape: confetti ? 2 : steam || puff ? 0 : 1,
        opacity: steam ? 0.18 : 1,
      };
    }
  }
  frame(dt: number, now: number, center: Vector3): void {
    if (!this.node.visible) return;
    for (let i = 0; i < COUNT; i++) {
      const p = this.particles[i]!;
      if (i < DUST) {
        p.x = center.x + Math.sin(i * 78.4) * 5;
        p.z = center.z + Math.cos(i * 43.7) * 4;
        p.y = 0.8 + ((i * 0.173 + now * 0.00004) % 2);
        p.size = 0.018;
        p.color[0] = 1;
        p.color[1] = 1;
        p.color[2] = 1;
        this.alpha[i] = 0.12;
      } else {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= p.gravity * dt;
        this.alpha[i] =
          Math.max(0, 1 - p.age / Math.max(0.01, p.life)) * p.opacity;
        if (p.life > 2) p.size += dt * 0.11;
      }
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.colors.set(p.color, i * 3);
      this.sizes[i] = p.size;
      this.shapes[i] = p.shape;
    }
    for (const attribute of ['position', 'tint', 'size', 'opacity', 'shape'])
      this.geometry.getAttribute(attribute).needsUpdate = true;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
