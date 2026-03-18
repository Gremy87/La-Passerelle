# ⚡ La Passerelle

> Dashboard de supervision d'agents Claude Code — La Salle des Opérations de l'Amiral

![Stack](https://img.shields.io/badge/stack-Node.js%20%2B%20Vue%203%20%2B%20SQLite-blue)
![Port](https://img.shields.io/badge/port-3717-green)

## Lancer en développement

### Prérequis
- Node.js v18+
- npm v9+

### Installation

```bash
# Cloner le repo
git clone git@github.com:Gremy87/La-Passerelle.git
cd La-Passerelle

# Installer les dépendances (server + client)
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Configuration

```bash
# Créer le fichier .env du serveur
cp server/.env.example server/.env
# Éditer server/.env avec vos valeurs (JWT_SECRET, mot de passe, etc.)
```

### Démarrage

**Terminal 1 — Backend (port 3717)**
```bash
cd server
node --watch index.js
```

**Terminal 2 — Frontend (port 5173)**
```bash
cd client
npm run dev
```

L'interface est disponible sur : **http://localhost:5173**
L'API est disponible sur : **http://localhost:3717**

### Production

```bash
# Build du client
cd client && npm run build

# Lancer le serveur (qui sert aussi le client buildé)
NODE_ENV=production node server/index.js
```

L'interface et l'API sont servies sur : **http://localhost:3717**

---

## Architecture

```
La-Passerelle/
├── server/           # Backend Node.js + Express + WebSocket + SQLite
│   ├── index.js      # Point d'entrée (port 3717)
│   ├── db.js         # SQLite (better-sqlite3)
│   ├── websocket.js  # WebSocket temps réel
│   ├── hooks.js      # Réception hooks Claude Code
│   └── routes/       # API REST (missions, agents, hangar, auth)
├── client/           # Frontend Vue 3 + Tailwind CSS
│   ├── src/
│   │   ├── App.vue              # Layout principal
│   │   ├── main.js              # Bootstrap Vue + Pinia + Router
│   │   ├── stores/passerelle.js # Store Pinia (état global + WebSocket)
│   │   ├── views/               # Pages
│   │   │   ├── SalleDesOperations.vue  # Dashboard principal 4 colonnes
│   │   │   ├── MissionDetail.vue       # Détail mission + log temps réel
│   │   │   └── LoginView.vue           # Connexion JWT
│   │   └── components/          # Composants UI
│   │       ├── MissionCard.vue
│   │       ├── AgentStatus.vue
│   │       ├── LogStream.vue
│   │       ├── HangarItem.vue
│   │       ├── ColonneHeader.vue
│   │       ├── NouvelleMissionModal.vue
│   │       ├── AgentModal.vue
│   │       └── HangarModal.vue
│   └── vite.config.js
└── CONCEPTION.md     # Document de conception complet
```

## API REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/health | Santé du serveur |
| GET | /api/missions | Lister les missions |
| POST | /api/missions | Créer une mission |
| GET | /api/missions/:id | Détail mission + messages |
| PATCH | /api/missions/:id | Modifier une mission |
| DELETE | /api/missions/:id | Supprimer une mission |
| POST | /api/missions/:id/message | Envoyer un message à l'agent |
| GET | /api/agents | Lister les agents |
| POST | /api/agents | Créer un agent |
| PATCH | /api/agents/:id | Modifier un agent |
| DELETE | /api/agents/:id | Supprimer un agent |
| GET | /api/hangar | Lister le hangar |
| POST | /api/hangar | Ajouter au hangar |
| PATCH | /api/hangar/:id | Modifier un item |
| DELETE | /api/hangar/:id | Supprimer un item |
| POST | /api/hangar/:id/transformer-mission | Convertir en mission |
| POST | /api/auth/login | Connexion Amiral |
| POST | /api/auth/logout | Déconnexion |

## Hooks Claude Code

Configurer dans `~/.claude/settings.json` :

```json
{
  "hooks": {
    "SessionStart":   [{"type": "http", "url": "http://localhost:3717/hooks/session-start"}],
    "SessionEnd":     [{"type": "http", "url": "http://localhost:3717/hooks/session-end"}],
    "PostToolUse":    [{"type": "http", "url": "http://localhost:3717/hooks/tool-use"}],
    "TaskCompleted":  [{"type": "http", "url": "http://localhost:3717/hooks/task-completed"}],
    "Notification":   [{"type": "http", "url": "http://localhost:3717/hooks/notification"}]
  }
}
```

## WebSocket Events

| Event | Description |
|-------|-------------|
| `mission:update` | Mise à jour statut/données mission |
| `agent:log` | Nouveau log d'agent (tool use, message) |
| `agent:status` | Changement statut agent |
| `intervention:new` | Nouvelle demande d'intervention |
| `hangar:update` | Mise à jour du hangar |

---

*Développé par Max ⚡ — Assistant de Jérémy — Mars 2026*
