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
    const winW = window.innerWidth, winH = window.innerHeight;
    const aspect = 3/2;

    let renderW, renderH;
    if (winW / winH > aspect) {
        // Fenster ist breiter → passe an Breite an, Höhe reicht nicht aus → Höhe muss „überragen“
        renderW = winW;
        renderH = winW / aspect;
    } else {
        // Fenster ist höher/schmaler → passe an Höhe an, Breite reicht nicht aus → Breite muss „überragen“
        renderH = winH;
        renderW = winH * aspect;
    }
    renderer.setSize(renderW, renderH, false);
    composer.setSize(renderW, renderH);

    renderer.domElement.style.width = `${renderW}px`;
    renderer.domElement.style.height = `${renderH}px`;
    renderer.domElement.style.left = '50%';
    renderer.domElement.style.top = '50%';
    renderer.domElement.style.transform = 'translate(-50%, -50%)';

    renderer.setScissorTest(false);

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


// Virtuelles Interdimensionales Geisterteleportationsgerät
class SpinnerController {
    constructor(scene) {
        this.scene = scene;
        this.spinnerRed = null;
        this.spinnerBlue = null;
        this.lights = [];
        this.counterLights = [];
        this.center = new THREE.Vector3(0, 16.55, 1.5);
        this.LIGHT_RADIUS = 1;
        this.baseY = 16.55;
        this.clock = new THREE.Clock();
        this.ws = null;
        this.reconnectDelay = 2000;
        this.connected = false; // Verbindungsstatus

        // Werte für sanften Übergang
        this.transition = {
            emission: 3.0, targetEmission: 3.0,
            bobMult: 0.5, targetBobMult: 0.5,
            rotSpeed: 1.2, targetRotSpeed: 1.2,
            lightIntensity: 5, targetLightIntensity: 5,
            lerpSpeed: 1/3  // 1/x Sekunden bis Ziel (hier: ca. 3s)
        };

        this.init();
    }

    async init() {
        this.spinnerRed = await this.loadSpinner('assets/models/spinner_red.glb', [0, 16.55, 0.88], [90, 0, 0], "#ff3333", 0.2);
        this.spinnerBlue = await this.loadSpinner('assets/models/spinner_blue.glb', [0, 16.55, 0.88], [90, 0, 0], "#3380ff", 0.2);

        for (let i = 0; i < 3; i++) {
            const L = new THREE.PointLight(0xFFA230, 5, 30);
            L.castShadow = true;
            this.lights.push(L);
            this.scene.add(L);

            const L2 = new THREE.PointLight(0xFFA230, 5, 30);
            L2.castShadow = true;
            this.counterLights.push(L2);
            this.scene.add(L2);
        }

        this.connectWebSocket();
    }

    async loadSpinner(path, pos, rotDeg, color, opacity) {
        const { scene: obj } = await gltfLoader.loadAsync(path);
        obj.position.set(...pos);
        obj.rotation.set(
            THREE.MathUtils.degToRad(rotDeg[0]),
            THREE.MathUtils.degToRad(rotDeg[1]),
            THREE.MathUtils.degToRad(rotDeg[2])
        );
        obj.traverse(c => {
            c.visible = true;
            if (c.isMesh && c.material && c.material.isMeshStandardMaterial) {
                c.material.transparent = true;
                c.material.opacity = opacity;
                c.material.emissive = new THREE.Color(color);
                c.material.emissiveIntensity = 3.0;
                c.material.vertexColors = true;
                c.castShadow = true;
            }
        });
        this.scene.add(obj);
        return obj;
    }

    // --- Werte sanft angleichen ---
    smoothTransition(dt) {
        let T = this.transition;
        // Zielwerte setzen
        if (this.connected) {
            T.targetEmission = 3.0;
            T.targetBobMult = 0.5;
            T.targetRotSpeed = 1.2;
            T.targetLightIntensity = 5;
        } else {
            T.targetEmission = 0.0;
            T.targetBobMult = 0.12;
            T.targetRotSpeed = 0.08;
            T.targetLightIntensity = 0;
        }
        // Lerp (sanft angleichen)
        const s = T.lerpSpeed * dt; // kleiner dt → smooth
        T.emission += (T.targetEmission - T.emission) * s;
        T.bobMult += (T.targetBobMult - T.bobMult) * s;
        T.rotSpeed += (T.targetRotSpeed - T.rotSpeed) * s;
        T.lightIntensity += (T.targetLightIntensity - T.lightIntensity) * s;
    }

    animate(dt, t) {
        this.smoothTransition(dt);

        const T = this.transition;
        const bob = Math.sin(t * 1.2) * T.bobMult;
        const baseY = this.baseY + bob;

        // Spinner
        if (this.spinnerRed && this.spinnerBlue) {
            this.spinnerRed.position.y = baseY + 0.8;
            this.spinnerBlue.position.y = baseY;
            this.spinnerRed.rotation.y -= T.rotSpeed * dt;
            this.spinnerBlue.rotation.y += T.rotSpeed * dt;

            // Emission auf beide Spinner anwenden
            this.spinnerRed.traverse(c => {
                if (c.isMesh && c.material && c.material.isMeshStandardMaterial)
                    c.material.emissiveIntensity = T.emission;
            });
            this.spinnerBlue.traverse(c => {
                if (c.isMesh && c.material && c.material.isMeshStandardMaterial)
                    c.material.emissiveIntensity = T.emission;
            });
        }

        // Rotierende Lichter (jetzt mit smooth intensity und Speed)
        for (let i = 0; i < this.lights.length; i++) {
            const ang = t * 0.8 + i * 2 * Math.PI / 3;
            this.lights[i].position.set(
                this.center.x + Math.cos(ang) * this.LIGHT_RADIUS,
                this.center.y + Math.sin(ang) * this.LIGHT_RADIUS,
                this.center.z
            );
            this.lights[i].intensity = T.lightIntensity;
        }
        for (let i = 0; i < this.counterLights.length; i++) {
            const ang = -t * 0.8 + i * 2 * Math.PI / 3;
            this.counterLights[i].position.set(
                this.center.x + Math.cos(ang) * this.LIGHT_RADIUS,
                this.center.y + Math.sin(ang) * this.LIGHT_RADIUS,
                this.center.z
            );
            this.counterLights[i].intensity = T.lightIntensity;
        }
    }

    connectWebSocket() {
        if (this.ws) this.ws.close();
        this.ws = new WebSocket(`ws://${location.host}`);
        this.ws.addEventListener('open', () => {
            this.connected = true;
            console.log("WebSocket connected!");
        });
        this.ws.addEventListener('message', async (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'spirit') {
                spawnSpirit(msg.data);
            }
        });
        this.ws.addEventListener('close', () => {
            this.connected = false;
            console.warn("WebSocket closed. Reconnecting in " + this.reconnectDelay / 1000 + "s...");
            setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
        });
        this.ws.addEventListener('error', (e) => {
            this.connected = false;
            console.error("WebSocket error", e);
            this.ws.close();
        });
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
        this.lifeTime = 30; // Sekunden
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
        this.grp.position.y -= 0.5 * dt;
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
    let spawnPos = { x: 0, y: spinnerController && spinnerController.spinnerRed ? spinnerController.spinnerRed.position.y - 1.5 : 15, z: 0.88 };
    const modelUrl = spiritData['Model URL'] || spiritData.modelUrl; // Fallback!
    const { scene: gltfScene } = await gltfLoader.loadAsync(modelUrl);
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
          position:absolute; right:40px; bottom:40px; color:white;
          background:rgba(0,0,0,0.6); padding:10px 18px; border-radius:10px;
          font-family: sans-serif; z-index:10; max-width: 360px;
        `;
        document.body.appendChild(el);
    }
    el.innerHTML = `
      <h2 style='padding:0; margin:0;'>${spirit.Name || 'Spirit'}</h2>
      <b>${spirit.Kategorie || ''}</b><br><br>
      <b>Mythos:</b> ${spirit["Mythos/Legende"] || ''}<br><br>
      <b>Rolle:</b> ${spirit["Funktion/Rolle"] || ''}<br>
      <b>Charakter:</b> ${spirit.Charakter || ''}<br><br>
      ${spirit.Herkunft ? ' <i>' + spirit.Herkunft : ''}</i>

    `;
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