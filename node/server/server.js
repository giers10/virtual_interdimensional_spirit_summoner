const express = require('express');
const http = require('http');
const ws = require('ws');
const path = require('path');
const fs = require('fs');

// --- Server Setup ---
const app = express();
const server = http.createServer(app);
const wss = new ws.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// --- Spirits laden & shufflen ---
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

const SPIRITS_PATH = path.join(__dirname, '.', 'spirits', 'spirit_list.json');
let spirits = [];
try {
  spirits = JSON.parse(fs.readFileSync(SPIRITS_PATH, 'utf8'));
  if (!Array.isArray(spirits) || spirits.length === 0) throw 'Spirit-Liste leer oder ungültig!';
  shuffleArray(spirits);
} catch (e) {
  console.error('Fehler beim Laden der Spirits:', e);
  process.exit(1);
}

let spiritPos = 0;

// --- Helper für die Rotation ---
function nextSpirit() {
  spiritPos++;
  if (spiritPos >= spirits.length) {
    shuffleArray(spirits);
    spiritPos = 0;
  }
}

// --- WebSocket Logik mit Timer-Steuerung ---
let spiritTimer = null;

function pushSpiritToAllClients() {
  const spirit = spirits[spiritPos];
  const payload = JSON.stringify({ type: 'spirit', data: spirit });
  wss.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(payload);
    }
  });
  // Konsole ruhig etwas ausführlicher
  console.log(`[Server] Spirit "${spirit.Name}" gesendet (${spiritPos + 1}/${spirits.length})`);
  nextSpirit();
}

// Timer starten, falls noch nicht läuft
function startSpiritTimer() {
  if (!spiritTimer) {
    spiritTimer = setInterval(() => {
      pushSpiritToAllClients();
    }, 20000);
    console.log('[Server] Spirit-Timer gestartet');
  }
}

// Timer stoppen
function stopSpiritTimer() {
  if (spiritTimer) {
    clearInterval(spiritTimer);
    spiritTimer = null;
    console.log('[Server] Spirit-Timer gestoppt');
    // Wenn keine Clients mehr da, trotzdem nächsten Spirit vorwählen,
    // damit beim nächsten Reload/Join ein anderer kommt!
    nextSpirit();
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

  // Sende sofort den aktuellen Spirit an neuen Client

  // Starte Timer falls das der erste Client ist
  if (wss.clients.size === 1) {
    startSpiritTimer();
    socket.send(JSON.stringify({ type: 'spirit', data: spirits[spiritPos] }));
  }

  // Verbindung verloren: Timer ggf. stoppen
  socket.on('close', () => {
    setTimeout(() => {
      if (!hasOpenClients()) {
        stopSpiritTimer();
      }
    }, 100); // etwas warten, falls kurzzeitig mehrere Clients disconnecten/reconnecten
  });
});

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Server] Läuft auf http://localhost:${PORT}`);
});