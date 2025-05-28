import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';
import { DRACOLoader } from 'DRACOLoader';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GammaCorrectionShader } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { VignetteShader } from "https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/shaders/VignetteShader.js";

// ---- Basis Three.js Szene ----
const scene = new THREE.Scene();
const ASPECT = 3 / 2, SCALE = 15;
const hw = SCALE / 2, hh = (SCALE / ASPECT) / 2;
const camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 1000);
camera.position.set(0, -14.424, 20);
camera.rotation.set(THREE.MathUtils.degToRad(55), 0, 0);

const container = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// ---- Postprocessing ----
const foliageTexture = new THREE.TextureLoader().load('assets/sprites/foliage.png');
foliageTexture.colorSpace = THREE.SRGBColorSpace;
const FoliageOverlayShader = {
    uniforms: { 'tDiffuse': { value: null }, 'tFoliage': { value: foliageTexture }, 'opacity': { value: 1.0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tFoliage; uniform float opacity; varying vec2 vUv;
      void main() { vec4 base = texture2D(tDiffuse, vUv); vec4 foliage = texture2D(tFoliage, vUv); gl_FragColor = mix(base, vec4(foliage.rgb, base.a), foliage.a * opacity); }`
};
const foliageOverlayPass = new ShaderPass(FoliageOverlayShader);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(foliageOverlayPass);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.8, 0.2, 0.4));
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms['offset'].value = 0.3;
vignettePass.uniforms['darkness'].value = 1.35;
composer.addPass(vignettePass);
composer.addPass(new ShaderPass(GammaCorrectionShader));

// ---- Resize Handler ----
function onResize() {
    const W = container.clientWidth, H = container.clientHeight, winA = W / H;
    let vw, vh, vx, vy;
    if (winA > ASPECT) { vh = H; vw = H * ASPECT; vx = (W - vw) / 2; vy = 0; }
    else { vw = W; vh = W / ASPECT; vx = 0; vy = (H - vh) / 2; }
    renderer.setSize(W, H);
    renderer.setViewport(vx, vy, vw, vh);
    renderer.setScissor(vx, vy, vw, vh);
    renderer.setScissorTest(true);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    composer.setSize(W, H);
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(dpr);
    composer.setPixelRatio(dpr);
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// ---- Environment ----
const texLoader = new THREE.TextureLoader();
const pmremGen = new THREE.PMREMGenerator(renderer);
texLoader.load('assets/hdri/environment.jpg', tex => {
    const envRT = pmremGen.fromEquirectangular(tex).texture;
    scene.environment = envRT;
    scene.background = envRT;
    tex.dispose();
    pmremGen.dispose();
});

// ---- Licht, Shadow-Only-Material, Loader ----
const sun = new THREE.DirectionalLight(0xFFA230, 2);
sun.position.set(21, -25, 30);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

const shadowOnlyMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.01, transparent: true, depthWrite: false });

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

// ---- SpinnerController ----
class SpinnerController {
  constructor(scene) {
    // Grundobjekte
    this.scene = scene;
    this.spinnerRed = null;
    this.spinnerBlue = null;
    this.rotatingLights = [];
    this.counterRotatingLights = [];
    this.LIGHT_RADIUS = 1;
    this.baseY = 16.55;
    this.connected = false;
    this.connectionLostSince = null;

    // Create Spinner, Lights etc.
    this.init();
    // Setup WebSocket (mit reconnect)
    this.connect();
  }

  async init() {
    // Spinner laden
    this.spinnerRed = await loadSpinner(
      'assets/models/spinner_red.glb', [0, this.baseY, 0.88], [90, 0, 0], "#ff3333", 0.2
    );
    this.spinnerBlue = await loadSpinner(
      'assets/models/spinner_blue.glb', [0, this.baseY, 0.88], [90, 0, 0], "#3380ff", 0.2
    );
    // 6 Lichter
    for (let i = 0; i < 3; i++) {
      const L = new THREE.PointLight(0xFFA230, 5, 30);
      L.castShadow = true;
      this.rotatingLights.push(L);
      scene.add(L);

      const L2 = new THREE.PointLight(0xFFA230, 5, 30);
      L2.castShadow = true;
      this.counterRotatingLights.push(L2);
      scene.add(L2);
    }
  }

  connect() {
    if (this.ws) this.ws.close();
    const ws = new WebSocket(`ws://${location.host}`);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.connectionLostSince = null;
      // Spinner wird wieder "schnell und hell"
    };
    ws.onclose = () => {
      this.connected = false;
      this.connectionLostSince = Date.now();
      // Versuche nach 2 Sekunden erneut zu verbinden
      setTimeout(() => this.connect(), 2000);
    };
    ws.onerror = () => {
      ws.close();
    };
    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'spirit') {
        spawnSpirit(msg.data); // neue Funktion, siehe unten!
      }
    };
  }

  update(dt, t) {
    // Werte je nach Connection
    let bobFactor    = this.connected ? 0.5 : 0.13;
    let spinSpeed    = this.connected ? 1.2 : 0.25;
    let lightSpeed   = this.connected ? 0.8 : 0.18;
    let lightInt     = this.connected ? 5   : 0.7;
    let emissiveInt  = this.connected ? 3.0 : 0.15;

    // Spinner Bobbing
    const bob = Math.sin(t * 1.2) * bobFactor;
    const yRed = this.baseY + bob + 0.8;
    const yBlue = this.baseY + bob;

    if (this.spinnerRed && this.spinnerBlue) {
      this.spinnerRed.position.y = yRed;
      this.spinnerBlue.position.y = yBlue;
      this.spinnerRed.rotation.y  -= spinSpeed * dt;
      this.spinnerBlue.rotation.y += spinSpeed * dt;
      // Emissive dunkler/heller
      this.spinnerRed.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.isMeshStandardMaterial) {
          obj.material.emissiveIntensity = emissiveInt;
        }
      });
      this.spinnerBlue.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.isMeshStandardMaterial) {
          obj.material.emissiveIntensity = emissiveInt;
        }
      });
    }

    // Rotierende Lichter
    const center = new THREE.Vector3(0, this.baseY, 1.5);
    const lightZ = center.z;
    for (let i = 0; i < this.rotatingLights.length; i++) {
      const ang = t * lightSpeed + i * 2 * Math.PI / 3;
      const L = this.rotatingLights[i];
      L.intensity = lightInt;
      L.position.set(
        center.x + Math.cos(ang) * this.LIGHT_RADIUS,
        center.y + Math.sin(ang) * this.LIGHT_RADIUS,
        lightZ
      );
    }
    for (let i = 0; i < this.counterRotatingLights.length; i++) {
      const ang = -t * lightSpeed + i * 2 * Math.PI / 3;
      const L2 = this.counterRotatingLights[i];
      L2.intensity = lightInt;
      L2.position.set(
        center.x + Math.cos(ang) * this.LIGHT_RADIUS,
        center.y + Math.sin(ang) * this.LIGHT_RADIUS,
        lightZ
      );
    }
  }
}

// ---- Spirit-Klasse ----
class Spirit {
    constructor(scene, gltfScene, info, spawnPosition) {
        this.scene = scene;
        this.grp = new THREE.Group();
        this.gltf = gltfScene;
        this.info = info || {};
        this.spawnY = spawnPosition.y;
        this.clock = new THREE.Clock();
        this.isFading = true;
        this.lifeTime = 20; // Sekunden
        this.spiritMeshes = [];
        this.grp.add(this.gltf);
        // exakt wie im Original: rotate, platzieren, leicht nach hinten
        this.gltf.rotation.x = -Math.PI;
        this.grp.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z - 0.6);

        this.gltf.traverse((mesh) => {
            if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.originalMaterial = mesh.material.clone();
                mesh.material = mesh.material.clone();
                mesh.material.color.set(0xffffcc);
                mesh.material.opacity = 1.0;
                mesh.material.transparent = true;
                mesh.material.emissive?.set(0xffffcc);
                mesh.material.emissiveIntensity = 2.0;
                this.spiritMeshes.push(mesh);
            }
        });
        this.scene.add(this.grp);
    }

    update(dt) {
        const t = this.clock.getElapsedTime();
        // Fading
        if (this.spiritMeshes && this.isFading) {
            for (const mesh of this.spiritMeshes) {
                if (t < 0.5) {
                    mesh.material.opacity = 1;
                    mesh.material.color.lerp(mesh.userData.originalMaterial.color, t / 0.5);
                    if (mesh.material.emissive)
                        mesh.material.emissive.lerp(mesh.userData.originalMaterial.emissive || new THREE.Color(0x000000), t / 0.5);
                    mesh.material.emissiveIntensity =
                        2.0 * (1 - t / 0.5) +
                        (mesh.userData.originalMaterial.emissiveIntensity || 1.0) * (t / 0.5);
                } else {
                    mesh.material.opacity = mesh.userData.originalMaterial.opacity ?? 1.0;
                    mesh.material.color.copy(mesh.userData.originalMaterial.color);
                    if (mesh.material.emissive)
                        mesh.material.emissive.copy(mesh.userData.originalMaterial.emissive || new THREE.Color(0x000000));
                    mesh.material.emissiveIntensity =
                        mesh.userData.originalMaterial.emissiveIntensity ?? 1.0;
                    this.isFading = false;
                }
            }
        }
        // Vertikales Despawn-Movement
        this.grp.position.y -= 1 * dt;
        // Nach Lebenszeit entfernen
        if (t > this.lifeTime) {
            this.dispose();
            return false;
        }
        return true;
    }

    dispose() {
        this.scene.remove(this.grp);
        this.gltf.traverse((mesh) => {
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
    }
}

// ---- Szene initialisieren ----
let spinnerController;
let landscape, torigate, shadowTree;
const activeSpirits = [];
const clock = new THREE.Clock();

(async () => {
    // Lade statische Models
    landscape = await loadGLB('assets/models/landscape.glb', [0, 0, 0], [90, 0, 0], { receiveShadow: true, castShadow: true });
    torigate = await loadGLB('assets/models/tori.glb', [0, 6.59, 0.375], [90, 0, 0], { receiveShadow: true, castShadow: true });
    shadowTree = await loadGLB('assets/models/tree_low.glb', [0, 0, 0], [90, 0, 0], { receiveShadow: false, castShadow: true, shadowOnly: true });

    spinnerController = new SpinnerController(scene);

    animate();
})();

// ---- Utility: GLBs laden ----
async function loadGLB(path, pos, rotDeg, { receiveShadow = false, castShadow = false, emissive = null, visible = true, shadowOnly = false } = {}) {
    const { scene: obj } = await gltfLoader.loadAsync(path);
    obj.position.set(pos[0], pos[1], pos[2]);
    obj.rotation.set(
        THREE.MathUtils.degToRad(rotDeg[0]),
        THREE.MathUtils.degToRad(rotDeg[1]),
        THREE.MathUtils.degToRad(rotDeg[2])
    );
    obj.traverse(c => {
        c.visible = visible;
        if (c.isMesh) {
            c.castShadow = castShadow;
            c.receiveShadow = receiveShadow;
            if (shadowOnly) c.material = shadowOnlyMaterial;
            if (emissive && c.material && c.material.isMeshStandardMaterial) {
                c.material.emissive = new THREE.Color(emissive);
                c.material.emissiveIntensity = 1.0;
            }
        }
    });
    scene.add(obj);
    return obj;
}

// ---- Spirit spawnen ----
async function spawnSpirit(spiritData) {
    // Exakte Platzierung wie im Original
    let spawnPos = { x: 0, y: spinnerController ? (spinnerController.spinnerRed ? spinnerController.spinnerRed.position.y - 1.5 : 15) : 15, z: 0.88 };
    const { scene: gltfScene } = await gltfLoader.loadAsync(spiritData.modelUrl);
    const spirit = new Spirit(scene, gltfScene, spiritData, spawnPos);
    activeSpirits.push(spirit);
    updateSpiritOverlay(spiritData);
}

// ---- Overlay für Spirit-Infos ----
function updateSpiritOverlay(spirit) {
    let el = document.getElementById('spirit-info');
    if (!el) {
        el = document.createElement('div');
        el.id = 'spirit-info';
        el.style = `
          position:absolute; left:20px; top:20px; color:white;
          background:rgba(0,0,0,0.6); padding:10px 18px; border-radius:10px;
          font-family: sans-serif; z-index:10; max-width: 320px;
        `;
        document.body.appendChild(el);
    }
    el.innerHTML = `<b>${spirit.name || 'Spirit'}</b><br><small>${spirit.desc || ""}</small>`;
}

// ---- Render-Loop ----
function animate() {
    const dt = clock.getDelta(), t = clock.getElapsedTime();
    // Spinner-Animation & Netzwerk
    if (spinnerController) spinnerController.animate(dt, t);

    // Update & remove expired spirits:
    for (let i = activeSpirits.length - 1; i >= 0; i--) {
        if (!activeSpirits[i].update(dt)) {
            activeSpirits.splice(i, 1);
        }
    }

    composer.render(scene, camera);
    requestAnimationFrame(animate);
}