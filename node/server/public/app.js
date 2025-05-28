// public/app.js

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
  // Optional: Entferne bisherigen Spirit aus Szene
  if (currentSpiritGroup) {
    scene.remove(currentSpiritGroup);
    // Dispose-Logik, falls notwendig
  }

  // Spirit-Modell laden (GLTF)
  const gltfLoader = new THREE.GLTFLoader();
  // Wenn du DRACO verwendest:
  // const draco = new THREE.DRACOLoader(); draco.setDecoderPath(...); gltfLoader.setDRACOLoader(draco);

  const { scene: spiritObj } = await gltfLoader.loadAsync(spirit.modelUrl);

  // Optionale Anpassungen (Schatten, Material etc.)
  spiritObj.traverse(mesh => {
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // ... weitere Material-Settings wie du möchtest
    }
  });

  // In Szene einfügen
  spiritObj.position.set(0, 0, 0); // ggf. gewünschte Position
  scene.add(spiritObj);
  currentSpiritGroup = spiritObj;

  // Zeige Name/Beschreibung im Overlay
  updateSpiritOverlay(spirit);
}

// Overlay: Spirit-Infos einblenden (optional)
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
  el.innerHTML = `<b>${spirit.name}</b><br><small>${spirit.desc || ""}</small>`;
}