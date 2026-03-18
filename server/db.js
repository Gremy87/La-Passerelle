/**
 * db.js — Configuration et initialisation de la base de données SQLite
 * Utilise better-sqlite3 pour des opérations synchrones performantes
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Chemin vers le fichier SQLite (racine du serveur)
const DB_PATH = path.join(__dirname, 'passerelle.db');

// Création/ouverture de la base de données
const db = new Database(DB_PATH);

// Activation des foreign keys et du WAL mode (performances)
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

/**
 * Initialise les tables si elles n'existent pas encore
 */
function initDb() {
  db.exec(`
    -- Table des missions (tâches assignées aux agents)
    CREATE TABLE IF NOT EXISTS missions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      titre       TEXT    NOT NULL,
      description TEXT    NOT NULL,
      statut      TEXT    NOT NULL DEFAULT 'hangar'
                          CHECK(statut IN ('hangar','refinement','en_cours','intervention','terminee','abandonnee')),
      type        TEXT    NOT NULL DEFAULT 'execution'
                          CHECK(type IN ('execution','refinement','todo_personnel')),
      repo_path   TEXT,
      worktree_path TEXT,
      agent_id    INTEGER REFERENCES agents(id) ON DELETE SET NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- Table des agents (instances Claude Code)
    CREATE TABLE IF NOT EXISTS agents (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nom           TEXT    NOT NULL,
      statut        TEXT    NOT NULL DEFAULT 'libre'
                            CHECK(statut IN ('libre','en_mission','intervention','hors_ligne')),
      mission_id    INTEGER REFERENCES missions(id) ON DELETE SET NULL,
      pid           INTEGER,
      hook_endpoint TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      last_seen     TEXT
    );

    -- Table des messages (logs des échanges avec les agents)
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      agent_id   INTEGER REFERENCES agents(id) ON DELETE SET NULL,
      role       TEXT    NOT NULL CHECK(role IN ('agent','amiral','systeme')),
      contenu    TEXT    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'texte'
                         CHECK(type IN ('texte','tool_use','tool_result','erreur','info')),
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Table du hangar (todos personnels de l'Amiral)
    CREATE TABLE IF NOT EXISTS hangar (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      titre       TEXT    NOT NULL,
      description TEXT,
      priorite    TEXT    NOT NULL DEFAULT 'normale'
                          CHECK(priorite IN ('basse','normale','haute','urgente')),
      statut      TEXT    NOT NULL DEFAULT 'en_attente'
                          CHECK(statut IN ('en_attente','en_cours','fait','abandonne')),
      mission_id  INTEGER REFERENCES missions(id) ON DELETE SET NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Trigger pour mettre à jour updated_at sur les missions
    CREATE TRIGGER IF NOT EXISTS missions_updated_at
      AFTER UPDATE ON missions
      BEGIN
        UPDATE missions SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

    -- Trigger pour mettre à jour updated_at sur le hangar
    CREATE TRIGGER IF NOT EXISTS hangar_updated_at
      AFTER UPDATE ON hangar
      BEGIN
        UPDATE hangar SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
  `);

  console.log('✅ Base de données initialisée');
}

// Initialisation automatique au chargement du module
initDb();

// Si lancé directement (npm run db:init), afficher un message
if (require.main === module) {
  console.log('🗄️  Passerelle DB prête :', DB_PATH);
  db.close();
}

module.exports = db;
