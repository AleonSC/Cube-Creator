import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ENVIRONMENTS } from './environments.js';

/** Scene, camera, lights, environment and post-processing. */
export class Viewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
    this.camera.position.set(2.4, 1.7, 3.1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 20;
    this.controls.target.set(0, 0, 0);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envCache = new Map();

    // lights
    this.ambient = new THREE.AmbientLight('#ffffff', 0.25);
    this.key = new THREE.DirectionalLight('#ffffff', 2.2);
    this.key.position.set(3, 5, 2.5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 20;
    Object.assign(this.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
    this.key.shadow.bias = -0.0005;
    this.key.shadow.radius = 6;
    this.rim = new THREE.DirectionalLight('#7aa2ff', 1.2);
    this.rim.position.set(-3, 2, -4);
    this.scene.add(this.ambient, this.key, this.rim);

    // ground shadow catcher + grid
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.35 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.85;
    this.ground.receiveShadow = true;
    this.grid = new THREE.GridHelper(10, 20, 0x445066, 0x262c3a);
    this.grid.position.y = -0.849;
    this.scene.add(this.ground, this.grid);

    // post-processing
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.pixelPass = new RenderPixelatedPass(4, this.scene, this.camera, { normalEdgeStrength: 0.3, depthEdgeStrength: 0.4 });
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.4, 0.85);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.pixelPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);

    this.resize = this.resize.bind(this);
    new ResizeObserver(this.resize).observe(container);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  applyScene(scene, post) {
    // background
    this.bgStyle = scene.bgStyle;
    if (scene.bgStyle === 'transparent') this.scene.background = null;
    else if (scene.bgStyle === 'solid') this.scene.background = new THREE.Color(scene.bgBottom);
    else this.scene.background = this.gradientTexture(scene.bgTop, scene.bgBottom);

    // environment
    this.scene.environment = this.envMap(scene.environment);
    this.scene.environmentIntensity = scene.envIntensity;
    this.renderer.toneMappingExposure = scene.exposure;

    this.ambient.intensity = scene.ambient;
    this.key.intensity = scene.keyLight;
    this.key.color.set(scene.keyColor);
    this.rim.intensity = scene.rimLight;
    this.rim.color.set(scene.rimColor);
    this.ground.visible = scene.ground;
    this.ground.material.opacity = scene.shadowOpacity;
    this.grid.visible = scene.grid;
    this.controls.autoRotate = scene.autoRotate;
    this.controls.autoRotateSpeed = 1.5;

    // post
    this.bloomPass.enabled = post.bloom;
    this.bloomPass.strength = post.bloomStrength;
    this.bloomPass.radius = post.bloomRadius;
    this.bloomPass.threshold = post.bloomThreshold;
    const pix = post.pixelate > 0;
    this.pixelPass.enabled = pix;
    this.renderPass.enabled = !pix;
    if (pix) this.pixelPass.setPixelSize(post.pixelate);
  }

  setGroundLevel(y) {
    this.ground.position.y = y;
    this.grid.position.y = y + 0.001;
  }

  envMap(id) {
    if (this.envCache.has(id)) return this.envCache.get(id);
    const def = ENVIRONMENTS[id];
    let tex = null;
    if (def?.build) {
      const envScene = def.build();
      tex = this.pmrem.fromScene(envScene, 0.04).texture;
    }
    this.envCache.set(id, tex);
    return tex;
  }

  gradientTexture(top, bottom) {
    const key = top + bottom;
    if (this.bgKey === key) return this.bgTex;
    this.bgTex?.dispose();
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, top);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fillRect(0, 0, 2, 256);
    this.bgTex = new THREE.CanvasTexture(c);
    this.bgTex.colorSpace = THREE.SRGBColorSpace;
    this.bgKey = key;
    return this.bgTex;
  }

  render() {
    this.controls.update();
    if (this.bgStyle === 'transparent') {
      // the bloom chain does not preserve alpha; render directly for transparency
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }
  }

  resetCamera() {
    this.camera.position.set(2.4, 1.7, 3.1);
    this.controls.target.set(0, 0, 0);
  }

  /**
   * Render `frames` images at a fixed size. beforeFrame(i) can pose the scene.
   * Returns ImageBitmaps (pixel ratio forced to 1 so sizes are exact).
   */
  async capture({ width, height, transparent = false, frames = 1, beforeFrame } = {}) {
    const prev = {
      bg: this.scene.background,
      ground: this.ground.visible,
      grid: this.grid.visible,
      style: this.bgStyle,
      ratio: this.renderer.getPixelRatio(),
      size: this.renderer.getSize(new THREE.Vector2()),
    };
    const w = width || prev.size.x;
    const h = height || prev.size.y;
    this.renderer.setPixelRatio(1);
    this.composer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (transparent) {
      this.scene.background = null;
      this.ground.visible = this.grid.visible = false;
      this.bgStyle = 'transparent';
    }
    const out = [];
    try {
      for (let i = 0; i < frames; i++) {
        beforeFrame?.(i);
        this.render();
        out.push(await createImageBitmap(this.renderer.domElement));
      }
    } finally {
      this.scene.background = prev.bg;
      this.ground.visible = prev.ground;
      this.grid.visible = prev.grid;
      this.bgStyle = prev.style;
      this.renderer.setPixelRatio(prev.ratio);
      this.composer.setPixelRatio(prev.ratio);
      this.resize();
    }
    return out;
  }

  /** PNG snapshot of the current view. */
  async screenshot(opts = {}) {
    const [bmp] = await this.capture(opts);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }
}
