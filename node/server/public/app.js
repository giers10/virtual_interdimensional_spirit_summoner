import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';
import { DRACOLoader } from 'DRACOLoader';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GammaCorrectionShader } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { VignetteShader } from "https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/shaders/VignetteShader.js";

// ---- BASIS Three.js Szene ----
const scene = new THREE.Scene();
const ASPECT = 3/2, SCALE = 15;
const hw = SCALE/2, hh = (SCALE/ASPECT)/2;
const camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 1000);
camera.position.set(0, -14.424, 20);
camera.rotation.set(THREE.MathUtils.degToRad(55), 0, 0);

const container = document.getElementById('viewer');
const renderer  = new THREE.WebGLRenderer({ antialias:true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// ---- POSTPROCESSING
const foliageTexture = new THREE.TextureLoader().load('assets/sprites/foliage.png');
foliageTexture.colorSpace = THREE.SRGBColorSpace;
const FoliageOverlayShader = {
  uniforms: {
    'tDiffuse':    { value: null },
    'tFoliage':    { value: foliageTexture },
    'opacity':     { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tFoliage;
    uniform float opacity;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec4 foliage = texture2D(tFoliage, vUv);
      gl_FragColor = mix(base, vec4(foliage.rgb, base.a), foliage.a * opacity);
    }
  `
};
const foliageOverlayPass = new ShaderPass(FoliageOverlayShader);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(foliageOverlayPass);
composer.addPass(new UnrealBloomPass(
  new THREE.Vector2(container.clientWidth, container.clientHeight),
  0.8, 0.2, 0.4
));
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms['offset'].value = 0.3;
vignettePass.uniforms['darkness'].value = 1.35;
composer.addPass(vignettePass);
composer.addPass(new ShaderPass(GammaCorrectionShader));

// ---- Resize
function onResize(){
  const W=container.clientWidth, H=container.clientHeight, winA=W/H;
  let vw,vh,vx,vy;
  if(winA>ASPECT){
    vh=H; vw=H*ASPECT; vx=(W-vw)/2; vy=0;
  } else {
    vw=W; vh=W/ASPECT; vx=0; vy=(H-vh)/2;
  }
  renderer.setSize(W,H);
  renderer.setViewport(vx,vy,vw,vh);
  renderer.setScissor(vx,vy,vw,vh);
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
window.addEventListener('resize',onResize);
onResize();

// ---- Environment Map
const texLoader = new THREE.TextureLoader();
const pmremGen  = new THREE.PMREMGenerator(renderer);
texLoader.load('assets/hdri/environment.jpg', tex => {
  const envRT = pmremGen.fromEquirectangular(tex).texture;
  scene.environment = envRT;
  scene.background  = envRT;
  tex.dispose();
  pmremGen.dispose();
});

// ---- Directional Sun ----
const sun = new THREE.DirectionalLight(0xFFA230, 2);
sun.position.set(21, -25, 30);
sun.castShadow = true;
sun.shadow.mapSize.width  = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near    = 1;
sun.shadow.camera.far     = 100;
sun.shadow.camera.left    = -30;
sun.shadow.camera.right   = 30;
sun.shadow.camera.top     = 30;
sun.shadow.camera.bottom  = -30;
scene.add(sun);

// ---- GLTF/DRACO Loader ----
const draco      = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

// ---- Utility: GLBs laden (für Grundszene) ----
async function loadGLB(path, pos, rotDeg, {receiveShadow=false, castShadow=false, emissive=null, visible=true, shadowOnly=false} = {}) {
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
      if (shadowOnly) c.material = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.01, transparent: true, depthWrite: false });
      if (emissive && c.material && c.material.isMeshStandardMaterial) {
        c.material.emissive = new THREE.Color(emissive);
        c.material.emissiveIntensity = 1.0;
      }
    }
  });
  scene.add(obj);
  return obj;
}

async function loadSpinner(path, pos, rotDeg, color, opacity) {
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
  scene.add(obj);
  return obj;
}

// ---- Grundszene initialisieren
let spinnerRed, spinnerBlue, torigate, landscape, shadowTree;
const rotatingLights = [], counterRotatingLights = [];
const LIGHT_RADIUS = 1;
const clock = new THREE.Clock();

(async()=>{
  landscape = await loadGLB(
    'assets/models/landscape.glb',
    [0,0,0], [90,0,0],
    {receiveShadow:true, castShadow:true}
  );
  torigate = await loadGLB(
    'assets/models/tori.glb',
    [0,6.59,0.375], [90,0,0],
    {receiveShadow:true, castShadow:true}
  );
  spinnerRed = await loadSpinner(
    'assets/models/spinner_red.glb', [0,16.55,0.88], [90,0,0], "#ff3333", 0.2
  );
  spinnerBlue = await loadSpinner(
    'assets/models/spinner_blue.glb', [0,16.55,0.88], [90,0,0], "#3380ff", 0.2
  );
  shadowTree = await loadGLB(
    'assets/models/tree_low.glb',
    [0.0,0.0,0.0], [90,0,0],
    {receiveShadow:false, castShadow:true, shadowOnly: true}
  );
  for(let i=0;i<3;i++){
    const L = new THREE.PointLight(0xFFA230, 5, 30);
    L.castShadow = true;
    rotatingLights.push(L);
    scene.add(L);

    const L2 = new THREE.PointLight(0xFFA230, 5, 30);
    L2.castShadow = true;
    counterRotatingLights.push(L2);
    scene.add(L2);
  }
  animate();
})();

// ---- SPIRIT-KLASSE (aus alter Version, leicht adaptiert)
const MOVE_SPEED = 1; // wie im Original
class Spirit {
  constructor(obj3d, info) {
    this.clock = new THREE.Clock();
    this.grp = new THREE.Group();
    this.spiritMeshes = [];
    this.isFading = true;
    this.info = info || {};
    this.grp.add(obj3d);

    // Positionierung + Drehung wie im Original
    obj3d.rotation.x = -Math.PI;
    // Setze Position unterhalb Spinner (nutze aktuelle Spinner-Position)
    let y = spinnerRed ? spinnerRed.position.y - 1.5 : 15;
    this.grp.position.set(0, y, 0.88 - 0.6);

    obj3d.traverse(mesh => {
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.originalMaterial = mesh.material.clone();
        mesh.material = mesh.material.clone();
        mesh.material.color.set(0xffffcc);
        mesh.material.opacity = 0.0;
        mesh.material.transparent = true;
        mesh.material.emissive?.set(0xffffcc);
        mesh.material.emissiveIntensity = 2.0;
        this.spiritMeshes.push(mesh);
      }
    });
    scene.add(this.grp);
  }

  update(dt) {
    const t = this.clock.getElapsedTime();
    if(this.spiritMeshes && this.isFading){
      for(const mesh of this.spiritMeshes){
        if(t < 0.5){
          mesh.material.opacity = 1;
          mesh.material.color.lerp(mesh.userData.originalMaterial.color, t/0.5);
          if(mesh.material.emissive)
            mesh.material.emissive.lerp(mesh.userData.originalMaterial.emissive || new THREE.Color(0x000000), t/0.5);
          mesh.material.emissiveIntensity = 2.0 * (1-t/0.5) + (mesh.userData.originalMaterial.emissiveIntensity||1.0)*(t/0.5);
        } else {
          mesh.material.opacity = mesh.userData.originalMaterial.opacity ?? 1.0;
          mesh.material.color.copy(mesh.userData.originalMaterial.color);
          if(mesh.material.emissive)
            mesh.material.emissive.copy(mesh.userData.originalMaterial.emissive || new THREE.Color(0x000000));
          mesh.material.emissiveIntensity = mesh.userData.originalMaterial.emissiveIntensity ?? 1.0;
          this.isFading = false;
        }
      }
    }
    // Bewegung nach unten
    this.grp.position.y -= MOVE_SPEED * dt;
    if (t > 15) {
      scene.remove(this.grp);
      return false;
    }
    return true;
  }

  dispose() {
    scene.remove(this.grp);
    this.grp.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      }
    });
  }
}

// ---- Render-Loop ----
let currentSpirit = null;
window.currentSpirit = null;

function animate(){
  const dt = clock.getDelta(), t = clock.getElapsedTime();
  // Spinner Animation
  const bob = Math.sin(t*1.2)*0.5;
  const baseY = 16.55 + bob;
  if (spinnerRed && spinnerBlue) {
    spinnerRed.position.y = baseY + 0.8;
    spinnerBlue.position.y = baseY;
    spinnerRed.rotation.y  -= 1.2 * dt;
    spinnerBlue.rotation.y += 1.2 * dt;
  }
  // Rotierende Lichter
  const center = new THREE.Vector3(0, 16.55, 1.5);
  const lightZ = center.z;
  for(let i=0; i<rotatingLights.length; i++){
    const ang = t * 0.8 + i * 2 * Math.PI / 3;
    rotatingLights[i].position.set(
      center.x + Math.cos(ang) * LIGHT_RADIUS,
      center.y + Math.sin(ang) * LIGHT_RADIUS,
      lightZ
    );
  }
  for(let i=0; i<counterRotatingLights.length; i++){
    const ang = -t * 0.8 + i * 2 * Math.PI / 3;
    counterRotatingLights[i].position.set(
      center.x + Math.cos(ang) * LIGHT_RADIUS,
      center.y + Math.sin(ang) * LIGHT_RADIUS,
      lightZ
    );
  }
  // Spirit animieren/entfernen
  if (currentSpirit && currentSpirit.update) {
    if (!currentSpirit.update(dt)) {
      currentSpirit = null;
      window.currentSpirit = null;
    }
  }
  composer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---- WebSocket-basierter Spirit Spawn ----
const ws = new WebSocket(`ws://${location.host}`);

ws.addEventListener('message', async (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'spirit') {
    await showSpirit(msg.data);
  }
});

async function showSpirit(spirit) {
  if (currentSpirit) {
    currentSpirit.dispose();
    currentSpirit = null;
    window.currentSpirit = null;
  }
  console.log("Lade Spirit", spirit.modelUrl);

  // Modell laden
  const { scene: spiritObj } = await gltfLoader.loadAsync(spirit.modelUrl);

  // Spirit-Objekt mit Animation/Fading/Motion erzeugen!
  currentSpirit = new Spirit(spiritObj, spirit);
  window.currentSpirit = currentSpirit;

  updateSpiritOverlay(spirit);
}

// Overlay für Spirit-Infos
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