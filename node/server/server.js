// server/server.js
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');

// --- Grundlegende Config ---
const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SPIRITS_DIR = path.join(__dirname, 'spirits');

// --- Webserver (Express) ---
const app = express();
app.use(express.static(PUBLIC_DIR));

// API: Liste aller Spirits (mit Name, Beschreibung, Model-URL etc.)
app.get('/api/spirits', (req, res) => {
  // z.B. spirit_list.json mit Array aus [{name,desc,modelUrl,...}]
  const spiritsMeta = fs.readFileSync(path.join(SPIRITS_DIR, 'spirit_list.json'), 'utf-8');
  res.json(JSON.parse(spiritsMeta));
});

// (Optional) Models/Bilder auch direkt serven:
app.use('/models', express.static(path.join(SPIRITS_DIR, 'models')));
app.use('/images', express.static(path.join(SPIRITS_DIR, 'images')));

// --- HTTP Server + WebSocket ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = [];
let currentSpirit = null;
let nextSpiritTimeout = null;

wss.on('connection', (ws) => {
  clients.push(ws);
  console.log('Client connected:', clients.length, 'total');
  // Beim Connect sofort aktuellen Spirit senden:
  if (currentSpirit) ws.send(JSON.stringify({ type: 'spirit', data: currentSpirit }));

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

// Helper: Broadcast an alle
function broadcastSpirit(spiritObj) {
  const msg = JSON.stringify({ type: 'spirit', data: spiritObj });
  clients.forEach(ws => { try { ws.send(msg); } catch {} });
}

// --- Spirit-Steuerung ---
function chooseRandomSpirit() {
  const spirits = JSON.parse(fs.readFileSync(path.join(SPIRITS_DIR, 'spirit_list.json'), 'utf-8'));
  return spirits[Math.floor(Math.random()*spirits.length)];
}

function scheduleNextSpirit() {
  const spirit = chooseRandomSpirit();
  currentSpirit = spirit;
  broadcastSpirit(spirit);
  // Alle 10 Sekunden neues Spirit:
  nextSpiritTimeout = setTimeout(scheduleNextSpirit, 10000);
}

// Starte Zyklus
scheduleNextSpirit();

// --- Server Start ---
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});