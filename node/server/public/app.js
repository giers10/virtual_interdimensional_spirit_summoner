// Im Client (public/app.js)
const ws = new WebSocket(`ws://${location.host}`);

ws.addEventListener('message', async (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'spirit') {
    const spirit = msg.data;
    // Lade spirit.modelUrl (GLTF), spirit.name, spirit.desc etc.
    // (Dein Rendercode wie bisher, nur Spirit-Daten dynamisch)
    showSpirit(spirit);
  }
});