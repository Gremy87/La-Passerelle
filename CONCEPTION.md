# La Passerelle — Document de Conception

## Vision

Dashboard de supervision d'agents IA pour un développeur solo. L'Amiral (Jérémy) pilote son Escadron de Claude Code depuis la Salle des Opérations sans jamais perdre le fil de ce qui se passe.

---

## Fonctionnalités MVP

### 1. Lancer une mission

Deux modes au lancement :

**Mode Raffinement** (sujet flou)
- L'Amiral décrit une idée vague
- Un agent de refinement ouvre une discussion interactive
- L'Amiral valide → mission transformée en exécution

**Mode Exécution** (tâche claire)
- L'Amiral décrit la tâche précisément
- Un agent est lancé directement
- Worktree créé automatiquement si repo concerné

### 2. Hangar (Todo personnel)
- L'Amiral crée des tâches pour lui-même ou à déléguer plus tard
- Chaque tâche peut être :
  - Marquée "faite" manuellement
  - Transformée en mission et déléguée à un agent

### 3. Salle des Opérations (Vue principale)
- **Colonne Escadron** : agents actifs avec statut temps réel
- **Colonne Missions en cours** : progression, dernière action de l'agent
- **Colonne Intervention requise** : missions bloquées en attente de l'Amiral
- **Colonne Objectifs atteints** : historique des missions terminées

### 4. Détail d'une mission
- Log temps réel de ce que fait l'agent (tools utilisés, fichiers modifiés)
- Possibilité d'envoyer un message à l'agent en cours
- Reprendre une session existante (contexte réutilisable)
- Voir la branche/worktree associée

### 5. Notifications Intervention Requise
- Badge dans le dashboard
- Notification Telegram via bot dédié
- L'Amiral peut répondre par Telegram pour débloquer l'agent
- Ou répondre depuis le dashboard

---

## Maquette UI (description)

### Layout général
```
┌─────────────────────────────────────────────────────┐
│  🚀 LA PASSERELLE          [Nouvelle Mission] [Auth] │
├──────────────┬──────────────┬───────────────┬────────┤
│  ESCADRON    │ EN MISSION   │ INTERVENTION  │ HANGAR │
│              │              │  REQUISE 🚨   │        │
│  ● Claude-1  │ [Mission 42] │ [Mission 38]  │ □ Todo1│
│    bkov2     │ En cours...  │ Attends input │ □ Todo2│
│    ████░░ 67%│              │               │ □ Todo3│
│              │ [Mission 43] │               │        │
│  ● Claude-2  │ Analyse...   │               │ [+ New]│
│    bidder    │              │               │        │
│    ██░░░░ 30%│              │               │        │
│              │              │               │        │
│  ○ Libre     │              │               │        │
└──────────────┴──────────────┴───────────────┴────────┘
```

### Vue détail mission (panel latéral ou page dédiée)
```
┌─────────────────────────────────────────┐
│ Mission 42 — Refactoring auth BKO       │
│ Vaisseau: Claude-1 | Repo: bkov2        │
│ Branche: passerelle/mission-42          │
├─────────────────────────────────────────┤
│ [Log temps réel]                        │
│ ✅ Read: src/Auth/AuthController.php    │
│ ✅ Read: src/Auth/JwtService.php        │
│ 🔧 Edit: src/Auth/AuthController.php   │
│   Refactoring injection dépendances...  │
│ ⏳ Bash: php artisan test --filter Auth │
├─────────────────────────────────────────┤
│ [Envoyer un message à l'agent]     [→]  │
└─────────────────────────────────────────┘
```

---

## Architecture technique détaillée

### Backend (server/)

**API REST :**
- `POST /api/missions` — Créer une mission
- `GET /api/missions` — Lister les missions
- `GET /api/missions/:id` — Détail mission
- `PATCH /api/missions/:id` — Modifier statut
- `POST /api/missions/:id/message` — Envoyer message à l'agent
- `GET /api/agents` — Lister les agents actifs
- `POST /api/hangar` — Créer todo
- `PATCH /api/hangar/:id` — Modifier todo
- `POST /api/auth/login` — Login
- `POST /api/hooks/*` — Réception hooks Claude Code

**WebSocket events :**
- `mission:update` — Mise à jour statut mission
- `agent:log` — Nouveau log d'un agent
- `agent:status` — Changement statut agent
- `intervention:new` — Nouvelle demande d'intervention

### Worktree management

```javascript
async function createWorktree(repoPath, missionId) {
  const branch = `passerelle/mission-${missionId}`;
  const worktreePath = `/tmp/la-passerelle/mission-${missionId}`;
  await exec(`git -C ${repoPath} worktree add ${worktreePath} -b ${branch}`);
  return { branch, worktreePath };
}

async function cleanupWorktree(repoPath, missionId) {
  const worktreePath = `/tmp/la-passerelle/mission-${missionId}`;
  await exec(`git -C ${repoPath} worktree remove ${worktreePath} --force`);
}
```

### Telegram Bot (dédié)

Bot séparé de Max (OpenClaw). Uniquement pour les interventions.

**Flow :**
1. Agent bloqué → hook `Notification` → serveur → Telegram bot
2. Message envoyé à l'Amiral : "🚨 Mission 42 attend votre décision : [question]"
3. L'Amiral répond par Telegram
4. Le serveur reçoit la réponse → l'injecte dans la session Claude Code

### Auth JWT

```javascript
// Login
POST /api/auth/login { password: "..." }
→ Vérifie bcrypt → Génère JWT → Cookie httpOnly

// Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.passerelle_token;
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Non autorisé' });
    next();
  });
};
```

---

## Thème visuel

**Dark space ambience :**
- Fond : `#0a0e1a` (bleu nuit très sombre)
- Panels : `#111827`
- Accent : `#3b82f6` (bleu électrique)
- Succès : `#10b981` (vert émeraude)
- Danger/Intervention : `#ef4444` (rouge)
- Texte : `#e2e8f0`
- Texte secondaire : `#64748b`
- Font : `JetBrains Mono` ou `Space Mono` (monospace, ambiance terminal)

**Éléments visuels :**
- Barres de progression façon "bouclier de vaisseau"
- Petits points animés pour les agents actifs
- Grid layout façon écran de commandement

---

## Phases de développement

### Phase 1 — Fondations
- [x] Repo GitHub créé
- [ ] Setup Node.js + SQLite + Express
- [ ] Modèle de données
- [ ] API REST de base
- [ ] WebSocket

### Phase 2 — Interface
- [ ] Vue 3 + Tailwind setup
- [ ] Layout Salle des Opérations
- [ ] Composant Mission card
- [ ] Log temps réel

### Phase 3 — Agents
- [ ] Intégration Claude Agent SDK
- [ ] Hooks HTTP
- [ ] Worktree management
- [ ] Lancement/arrêt agents

### Phase 4 — Notifications
- [ ] Bot Telegram dédié
- [ ] Flow intervention requise
- [ ] Réponse via Telegram

### Phase 5 — Polish
- [ ] Auth JWT
- [ ] Mode raffinement
- [ ] Réutilisation contexte
- [ ] README + deploy doc

---

## Questions ouvertes

- Comment identifier une "session Claude Code" existante pour la reprendre ? (via `--resume` flag du SDK ?)
- Le bot Telegram dédié nécessite un token séparé → à créer via BotFather
- Faut-il supporter plusieurs Amiraux (multi-user) ? → Non pour le MVP

---

*Document rédigé par Max ⚡ — Mars 2026*
