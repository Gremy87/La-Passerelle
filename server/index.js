/**
 * index.js — Point d'entrée du serveur La Passerelle
 * Node.js + Express + WebSocket + SQLite
 * Port : 3717
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// DB et routes (db.init() est async — voir bootstrap() plus bas)
const db = require('./db');

// Routes
const missionsRouter = require('./routes/missions');
const agentsRouter   = require('./routes/agents');
const hangarRouter   = require('./routes/hangar');
const authRouter     = require('./routes/auth');
const hooksRouter    = require('./hooks');

// WebSocket
const { initWebSocket } = require('./websocket');

const app = express();
const server = http.createServer(app);

// ─── Middlewares ──────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logs des requêtes en développement
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`→ ${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes API ───────────────────────────────────────────────────────────────

// Auth (pas de middleware JWT ici, c'est le point d'entrée)
app.use('/api/auth', authRouter);

// Hooks Claude Code (pas d'auth — appelés par les agents locaux)
app.use('/hooks', hooksRouter);

// Routes protégées par JWT
// Note : pour le MVP, les routes API ne requièrent pas d'auth
// (l'interface tourne en local, pas exposée publiquement)
app.use('/api/missions', missionsRouter);
app.use('/api/agents',   agentsRouter);
app.use('/api/hangar',   hangarRouter);

// ─── Route de santé ───────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const agentsCount  = db.prepare('SELECT COUNT(*) as n FROM agents').get().n;
  const missionsCount = db.prepare('SELECT COUNT(*) as n FROM missions').get().n;
  
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    agents: agentsCount,
    missions: missionsCount,
    timestamp: new Date().toISOString()
  });
});

// ─── Servir le client Vue en production ───────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  
  // SPA fallback — toutes les routes non-API servent index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/hooks')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// ─── Gestion des erreurs ──────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3717;

async function bootstrap() {
  // Initialiser la base de données (sql.js est async au démarrage)
  await db.init();

  // Initialiser le WebSocket sur le même serveur HTTP
  initWebSocket(server);

  server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║     🚀 LA PASSERELLE — En ligne      ║');
    console.log(`║     Port : ${PORT}                     ║`);
    console.log('║     Prêt à recevoir l\'Escadron ⚡    ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
  });
}

bootstrap().catch(err => {
  console.error('❌ Erreur au démarrage :', err);
  process.exit(1);
});

// Arrêt propre
process.on('SIGTERM', () => {
  console.log('📴 Arrêt de La Passerelle...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

module.exports = { app, server };
