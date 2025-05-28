const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// --- App & HTTP-Server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- Static files aus /public
app.use(express.static(path.join(__dirname, 'public')));

// --- WebSocket: simple Broadcast Demo
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'spirit', data: { name: 'Demo', modelUrl: '/assets/models/spirits/Yuki_Onna.glb', desc: 'Testdesc.' } }));
});

// --- Server starten
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server läuft auf http://localhost:' + PORT);
});