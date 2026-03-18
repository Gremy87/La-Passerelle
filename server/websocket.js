/**
 * websocket.js — Gestion des connexions WebSocket temps réel
 * Diffuse les événements missions/agents aux clients connectés
 */

const { WebSocketServer } = require('ws');

let wss = null;

// Ensemble des clients connectés
const clients = new Set();

/**
 * Initialise le serveur WebSocket sur le serveur HTTP existant
 * @param {http.Server} server — serveur HTTP Express
 */
function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log(`🔌 Nouveau client WebSocket connecté (${req.socket.remoteAddress})`);
    clients.add(ws);

    // Envoyer un message de bienvenue
    ws.send(JSON.stringify({
      type: 'connexion',
      message: 'Bienvenue sur La Passerelle ⚡',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log('📨 Message WebSocket reçu:', msg.type);
        // Pour l'instant, on ne traite pas les messages entrants côté WS
        // (la communication se fait via REST)
      } catch (err) {
        console.error('❌ Message WebSocket invalide:', err.message);
      }
    });

    ws.on('close', () => {
      console.log('🔌 Client WebSocket déconnecté');
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('❌ Erreur WebSocket:', err.message);
      clients.delete(ws);
    });
  });

  console.log('🚀 Serveur WebSocket initialisé sur /ws');
  return wss;
}

/**
 * Diffuse un événement à tous les clients connectés
 * @param {string} type — type de l'événement
 * @param {object} data — données de l'événement
 */
function broadcast(type, data) {
  const payload = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  });

  let count = 0;
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
      count++;
    }
  }

  if (count > 0) {
    console.log(`📡 Broadcast [${type}] → ${count} client(s)`);
  }
}

/**
 * Événements disponibles pour le broadcast
 */
const events = {
  // Mise à jour du statut d'une mission
  missionUpdate: (mission) => broadcast('mission:update', mission),
  // Nouveau log d'agent
  agentLog: (missionId, message) => broadcast('agent:log', { missionId, message }),
  // Changement de statut d'un agent
  agentStatus: (agent) => broadcast('agent:status', agent),
  // Nouvelle demande d'intervention
  interventionNew: (mission) => broadcast('intervention:new', mission),
  // Mise à jour du hangar
  hangarUpdate: (item) => broadcast('hangar:update', item),
};

module.exports = { initWebSocket, broadcast, events };
