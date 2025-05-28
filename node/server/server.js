const express = require('express');
const http = require('http');
const ws = require('ws');
const path = require('path');
const fs = require('fs');

// --- Server Setup ---
const app = express();
const server = http.createServer(app);
const wss = new ws.Server({ server });

// Statisches Hosting von /public
app.use(express.static(path.join(__dirname, 'public')));

// --- Spirits laden ---
const SPIRITS_PATH = path.join(__dirname, '.', 'spirits', 'spirit_list.json');
let spirits = [];
try {
  spirits = JSON.parse(fs.readFileSync(SPIRITS_PATH, 'utf8'));
  if (!Array.isArray(spirits) || spirits.length === 0) throw 'Spirit-Liste leer oder ungültig!';
} catch (e) {
  console.error('Fehler beim Laden der Spirits:', e);
  process.exit(1);
}

// --- WebSocket Logik mit Timer-Steuerung ---
let spiritTimer = null;
let currentSpiritIndex = Math.floor(Math.random() * spirits.length);

function pushSpiritToAllClients() {
  const spirit = spirits[currentSpiritIndex];
  const payload = JSON.stringify({ type: 'spirit', data: spirit });
  wss.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(payload);
    }
  });
  console.log(`Spirit "${spirit.Name}" wurde an alle Clients gepusht.`);
}

// Timer starten, falls noch nicht läuft
function startSpiritTimer() {
  if (!spiritTimer) {
    spiritTimer = setInterval(() => {
      currentSpiritIndex = Math.floor(Math.random() * spirits.length);
      pushSpiritToAllClients();
    }, 20000);
    console.log('Spirit-Timer gestartet');
  }
}

// Timer stoppen
function stopSpiritTimer() {
  if (spiritTimer) {
    clearInterval(spiritTimer);
    spiritTimer = null;
    console.log('Spirit-Timer gestoppt');
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
  console.log('Neuer Client verbunden');

  // Starte Timer falls das der erste Client ist
  if (wss.clients.size === 1) {
    startSpiritTimer();
    // Sende sofort einen Spirit an den neuen Client
    socket.send(JSON.stringify({ type: 'spirit', data: spirits[currentSpiritIndex] }));
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
  console.log(`Server läuft auf http://localhost:${PORT}`);
});