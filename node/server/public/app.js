import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';
import { DRACOLoader } from 'DRACOLoader';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GammaCorrectionShader } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { VignetteShader } from "https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/shaders/VignetteShader.js";

// ---- Deine komplette Three.js Szenen-Logik hier! ----
// Szene, Kamera, Renderer, Lights, Landscape, Spinner, Trees, usw.
// Foliage-Shader wie bisher
// ...

// Ab hier NUR noch das WebSocket-System für die Spirits!
let currentSpiritGroup = null;

// --- WebSocket verbinden ---
const ws = new WebSocket(`ws://${location.host}`);

// --- WebSocket: Bei neuer Spirit-Anweisung ---
ws.addEventListener('message', async (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'spirit') {
    await showSpirit(msg.data);
  }
});

async function showSpirit(spirit) {
  if (currentSpiritGroup) {
    scene.remove(currentSpiritGroup);
    // Dispose-Logik, falls notwendig
  }

  const gltfLoader = new GLTFLoader();
  // Draco Loader, falls gebraucht: ...
  const { scene: spiritObj } = await gltfLoader.loadAsync(spirit.modelUrl);
  spiritObj.traverse(mesh => {
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // ... weitere Material-Settings
    }
  });

  spiritObj.position.set(0, 0, 0); // ggf. gewünschte Position
  scene.add(spiritObj);
  currentSpiritGroup = spiritObj;

  updateSpiritOverlay(spirit);
}

// ... restlicher Code ...