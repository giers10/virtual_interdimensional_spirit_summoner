const express = require('express');
const http = require('http');
const ws = require('ws');
const path = require('path');
const fs = require('fs');

// --- Server Setup ---
const app = express();
const server = http.createServer(app);
const wss = new ws.Server({ server });

let spiritPos = 0;
const SPIRIT_INTERVAL_MS = 18000; // 20 Sekunden
let lastSpiritSpawn = Date.now();
let spiritTimer = null;

app.use(express.static(path.join(__dirname, 'public')));

const SPIRITS_PATH = path.join(__dirname, '.', 'spirits', 'spirit_list.json');
let spirits = [];
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

try {
  spirits = JSON.parse(fs.readFileSync(SPIRITS_PATH, 'utf8'));
  if (!Array.isArray(spirits) || spirits.length === 0) throw 'Spirit-Liste leer oder ungültig!';
  shuffleArray(spirits);
} catch (e) {
  console.error('Fehler beim Laden der Spirits:', e);
  process.exit(1);
}

// --- Helper ---
function nextSpirit() {
  spiritPos++;
  if (spiritPos >= spirits.length) {
    shuffleArray(spirits);
    spiritPos = 0;
  }
  lastSpiritSpawn = Date.now();
}

// --- WebSocket Logik ---
function pushSpiritToAllClients() {
  const spirit = spirits[spiritPos];
  lastSpiritSpawn = Date.now();
  const payload = JSON.stringify({
    type: 'spirit',
    data: spirit,
    timeSinceSpawnMs: 0,
    spiritIntervalMs: SPIRIT_INTERVAL_MS
  });
  wss.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(payload);
    }
  });
  console.log(`[Server] Spirit "${spirit.Name}" gesendet (${spiritPos + 1}/${spirits.length})`);
}

// --- Timer ---
function startSpiritTimer() {
  if (!spiritTimer) {
    spiritTimer = setInterval(() => {
      // Vorher weiterzählen, DANN pushen!
      nextSpirit();
      pushSpiritToAllClients();
    }, SPIRIT_INTERVAL_MS);
    console.log('[Server] Spirit-Timer gestartet');
  }
}

// Timer stoppen
function stopSpiritTimer() {
  if (spiritTimer) {
    clearInterval(spiritTimer);
    spiritTimer = null;
    console.log('[Server] Spirit-Timer gestoppt');
    nextSpirit(); // Rotiert für Singleuser wie gewünscht
  }
}

// Helper: Gibt es noch offene Clients?
function hasOpenClients() {
  let found = false;
  wss.clients.forEach(client => {
    if (client.readyState === ws.OPEN) found = true;
  });
  return found;
}

// --- WebSocket Logik ---
wss.on('connection', (socket) => {
  console.log('[Server] Neuer Client verbunden');

  // Zeit seit letztem Spirit-Spawn:
  const now = Date.now();
  const timeSinceSpawnMs = now - lastSpiritSpawn;
  const spirit = spirits[spiritPos];

  // Sende Spirit, Zeitdifferenz und Intervall an neuen Client
  socket.send(JSON.stringify({
    type: 'spirit',
    data: spirit,
    timeSinceSpawnMs,
    spiritIntervalMs: SPIRIT_INTERVAL_MS
  }));

  // KEIN nextSpirit() hier!

  // Timer starten, falls es der erste Client ist:
  if (wss.clients.size === 1) {
    // NICHT doppelt senden!
    // NUR starten, nicht noch mal pushen!
    startSpiritTimer();
  }

  // Verbindung verloren: Timer ggf. stoppen
  socket.on('close', () => {
    setTimeout(() => {
      if (!hasOpenClients()) {
        stopSpiritTimer();
      }
    }, 100);
  });
});

// --- Server Start, initialen Spirit pushen (optional, für "Demo" ohne Client)
pushSpiritToAllClients();

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Server] Läuft auf http://localhost:${PORT}`);
});