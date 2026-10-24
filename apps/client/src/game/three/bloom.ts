import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type { PerspectiveCamera, WebGLRenderer } from 'three';

/** Quarter-resolution selective bloom. Only objects on layer 1 can glow. */
export class ToyBloom {
  private source = new WebGLRenderTarget(1, 1);
  private horizontal = new WebGLRenderTarget(1, 1);
  private vertical = new WebGLRenderTarget(1, 1);
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private geometry = new PlaneGeometry(2, 2);
  private blur = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      image: { value: this.source.texture },
      step: { value: new Vector2() },
    },
    vertexShader:
      'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `varying vec2 vUv; uniform sampler2D image; uniform vec2 step;
      void main(){gl_FragColor=texture2D(image,vUv)*.227027;
      gl_FragColor+=(texture2D(image,vUv+step*1.384615)+texture2D(image,vUv-step*1.384615))*.316216;
      gl_FragColor+=(texture2D(image,vUv+step*3.230769)+texture2D(image,vUv-step*3.230769))*.070270;}`,
  });
  private overlay = new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { image: { value: this.vertical.texture } },
    vertexShader:
      'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `varying vec2 vUv; uniform sampler2D image;
      void main(){vec4 glow=texture2D(image,vUv);gl_FragColor=vec4(glow.rgb,min(.25,glow.a*.25));}`,
  });
  private quad = new Mesh(this.geometry, this.blur);
  constructor() {
    this.scene.add(this.quad);
  }
  resize(width: number, height: number): void {
    const w = Math.max(1, Math.ceil(width / 4));
    const h = Math.max(1, Math.ceil(height / 4));
    for (const target of [this.source, this.horizontal, this.vertical])
      target.setSize(w, h);
  }
  render(gpu: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void {
    const mask = camera.layers.mask;
    camera.layers.set(1);
    gpu.setRenderTarget(this.source);
    gpu.render(scene, camera);
    camera.layers.mask = mask;
    this.quad.material = this.blur;
    this.blur.uniforms.image!.value = this.source.texture;
    this.blur.uniforms.step!.value.set(1 / this.source.width, 0);
    gpu.setRenderTarget(this.horizontal);
    gpu.render(this.scene, this.camera);
    this.blur.uniforms.image!.value = this.horizontal.texture;
    this.blur.uniforms.step!.value.set(0, 1 / this.source.height);
    gpu.setRenderTarget(this.vertical);
    gpu.render(this.scene, this.camera);
    this.quad.material = this.overlay;
    gpu.setRenderTarget(null);
    gpu.autoClear = false;
    gpu.render(this.scene, this.camera);
    gpu.autoClear = true;
  }
  dispose(): void {
    for (const target of [this.source, this.horizontal, this.vertical])
      target.dispose();
    this.blur.dispose();
    this.overlay.dispose();
    this.geometry.dispose();
  }
}
