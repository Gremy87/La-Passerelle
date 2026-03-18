# La Passerelle — CLAUDE.md

## Contexte du projet

**La Passerelle** est un dashboard de supervision d'agents IA (Claude Code) développé pour Jérémy (Gremy87).
Il permet de piloter plusieurs instances Claude Code depuis une interface centrale appelée **"Salle des Opérations"**.

## Vocabulaire du projet

| Terme | Définition |
|-------|-----------|
| **La Passerelle** | Nom du projet |
| **Salle des Opérations** | Le dashboard principal |
| **L'Amiral** | L'utilisateur (Jérémy) |
| **Escadron** | Les agents Claude Code |
| **Vaisseau** | Une instance d'agent Claude Code |
| **Mission** | Une tâche assignée à un agent |
| **Objectif atteint** | Mission terminée avec succès |
| **Intervention requise** | L'agent a besoin de l'Amiral |
| **Hangar** | Liste des missions en attente (todo) |

## Architecture technique

### Stack
- **Backend** : Node.js + Express + WebSocket (ws)
- **Frontend** : Vue 3 + Tailwind CSS (dark theme)
- **Base de données** : SQLite (via better-sqlite3)
- **Intégration Claude Code** : Claude Agent SDK + Hooks HTTP
- **Notifications** : Bot Telegram dédié (@LaPasserelleBot)
- **Auth** : JWT simple (token stocké en cookie httpOnly)

### Structure des dossiers
```
La-Passerelle/
├── server/               # Backend Node.js
│   ├── index.js          # Point d'entrée
│   ├── db.js             # SQLite setup
│   ├── routes/           # API REST
│   ├── websocket.js      # Temps réel
│   ├── hooks.js          # Réception hooks Claude Code
│   └── telegram.js       # Bot Telegram
├── client/               # Frontend Vue 3
│   ├── src/
│   │   ├── views/        # Pages principales
│   │   ├── components/   # Composants UI
│   │   └── stores/       # Pinia stores
│   └── vite.config.js
├── agents/               # Scripts de lancement agents
│   └── launch-agent.js   # Lance un Claude Code via SDK
├── CLAUDE.md             # Ce fichier
├── CONCEPTION.md         # Doc de conception détaillée
└── README.md
```

### Gestion des conflits de repo (Worktrees)
Chaque agent qui travaille sur un repo reçoit son propre **git worktree** :
```bash
git worktree add /tmp/la-passerelle/mission-42 -b passerelle/mission-42
```
Les worktrees sont créés automatiquement au lancement d'une mission et supprimés après merge/abandon.

## Modèle de données (SQLite)

### Table `missions`
```sql
id, titre, description, statut, type, repo_path, worktree_path,
agent_id, created_at, updated_at, completed_at
```

**Statuts** : `hangar` | `refinement` | `en_cours` | `intervention` | `terminee` | `abandonnee`
**Types** : `execution` | `refinement` | `todo_personnel`

### Table `agents`
```sql
id, nom, statut, mission_id, pid, hook_endpoint, created_at, last_seen
```

### Table `messages`
```sql
id, mission_id, agent_id, role, contenu, type, created_at
```

## Intégration Claude Code

### Hooks configurés (settings.json de Claude Code)
```json
{
  "hooks": {
    "SessionStart": [{"type": "http", "url": "http://localhost:3717/hooks/session-start"}],
    "SessionEnd": [{"type": "http", "url": "http://localhost:3717/hooks/session-end"}],
    "PostToolUse": [{"type": "http", "url": "http://localhost:3717/hooks/tool-use"}],
    "TaskCompleted": [{"type": "http", "url": "http://localhost:3717/hooks/task-completed"}],
    "Notification": [{"type": "http", "url": "http://localhost:3717/hooks/notification"}]
  }
}
```

### Lancement d'un agent via SDK
```javascript
const { query } = require('@anthropic-ai/claude-agent-sdk');

for await (const message of query({
  prompt: mission.description,
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    cwd: mission.worktree_path
  }
})) {
  // Stream vers WebSocket → Salle des Opérations
}
```

## Bot Telegram

Bot dédié séparé de Max. Utilisé uniquement pour les notifications **"Intervention requise"**.
L'Amiral peut répondre directement via Telegram pour débloquer l'agent.

## Sécurité / Auth

Token JWT stocké en cookie httpOnly. Simple login par mot de passe (hash bcrypt).
Pas d'inscription — seul l'Amiral a accès.

## Port

Serveur sur **:3717** (La Passerelle = 3717... bon ok c'était random 😄)

## Commandes utiles

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Lancer en production
npm start

# Initialiser la base de données
npm run db:init
```

## Contact développeur principal

**Max ⚡** — assistant IA de Jérémy, développe ce projet depuis le VPS OpenClaw.
Pour contribuer ou prendre le relai : lire CONCEPTION.md en entier avant de toucher au code.
