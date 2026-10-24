import {
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';

const COUNT = 160;
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
}
export class FactoryParticles {
  private positions = new Float32Array(COUNT * 3);
  private colors = new Float32Array(COUNT * 3);
  private sizes = new Float32Array(COUNT);
  private alpha = new Float32Array(COUNT);
  private particles: Particle[] = [];
  private cursor = 0;
  private geometry = new BufferGeometry();
  private material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { viewport: { value: 500 } },
    vertexShader:
      'attribute vec3 tint; attribute float size; attribute float opacity; varying vec3 vTint; varying float vOpacity; uniform float viewport; void main(){ vTint=tint; vOpacity=opacity; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,size*viewport*projectionMatrix[1][1]/max(.1,-mv.z)); }',
    fragmentShader:
      'varying vec3 vTint; varying float vOpacity; void main(){float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard; gl_FragColor=vec4(vTint,vOpacity*(1.-smoothstep(.25,1.,d)));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  readonly node = new Points(this.geometry, this.material);
  constructor() {
    this.geometry.setAttribute(
      'position',
      new BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute('tint', new BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('opacity', new BufferAttribute(this.alpha, 1));
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
      });
  }
  resize(height: number, pixelRatio: number): void {
    this.material.uniforms.viewport!.value = height * pixelRatio;
  }
  burst(kind: 'puff' | 'spark' | 'chip', origin: Vector3, count: number): void {
    if (!this.node.visible) return;
    for (let i = 0; i < count; i++) {
      const index = (this.cursor++ % (COUNT - 40)) + 40;
      const angle = i * 2.39996 + this.cursor;
      const puff = kind === 'puff';
      const speed = puff ? 0.5 : kind === 'spark' ? 1.5 : 0.35;
      this.particles[index] = {
        age: 0,
        life: puff ? 0.52 : 0.65,
        x: origin.x,
        y: origin.y,
        z: origin.z,
        vx: Math.cos(angle) * speed,
        vy: puff ? 0.6 + (i % 3) * 0.15 : 0.8 + (i % 4) * 0.25,
        vz: Math.sin(angle) * speed,
        size: puff ? 0.22 : 0.055,
        color: puff
          ? [0.95, 0.86, 0.67]
          : kind === 'spark'
            ? [1, 0.49, 0.12]
            : [1, 0.8, 0.2],
        gravity: puff ? 0 : 2.8,
      };
    }
  }
  frame(dt: number, now: number, center: Vector3): void {
    if (!this.node.visible) return;
    for (let i = 0; i < COUNT; i++) {
      const p = this.particles[i]!;
      if (i < 40) {
        p.x = center.x + Math.sin(i * 78.4) * 5;
        p.z = center.z + Math.cos(i * 43.7) * 4;
        p.y = 0.6 + ((i * 0.173 + now * 0.00004) % 2.8);
        p.size = 0.027;
        p.color[0] = 0.9;
        p.color[1] = 0.88;
        p.color[2] = 0.72;
        this.alpha[i] = 0.27;
      } else {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= p.gravity * dt;
        this.alpha[i] = Math.max(0, 1 - p.age / Math.max(0.01, p.life));
      }
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.colors.set(p.color, i * 3);
      this.sizes[i] = p.size;
    }
    for (const attribute of ['position', 'tint', 'size', 'opacity'])
      this.geometry.getAttribute(attribute).needsUpdate = true;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
