/**
 * db.js — Configuration et initialisation de la base de données SQLite
 * Utilise sql.js (SQLite pur JS, compatible Mac ARM64 / Node v24)
 * API compatible avec better-sqlite3 : .prepare().get() / .all() / .run()
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Chemin vers le fichier SQLite (racine du serveur)
const DB_PATH = path.join(__dirname, 'passerelle.db');

// Instance sql.js interne (initialisée par db.init())
let _sqlDb = null;

/**
 * Persiste la base mémoire sur disque
 */
function saveDb() {
  if (!_sqlDb) return;
  const data = _sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Crée les tables et triggers si absents
 */
function initTables() {
  _sqlDb.exec(`
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

  saveDb();
  console.log('✅ Base de données initialisée');
}

/**
 * Wrapper compatible better-sqlite3
 * Expose : .prepare(sql) → { get, all, run }
 *           .exec(sql)
 *           .pragma(expr)
 *           .close()
 *           .init()   ← async, à appeler une fois au démarrage
 */
const db = {
  /**
   * Prépare un statement et retourne un objet avec get/all/run
   * (synchrone côté appelant, comme better-sqlite3)
   */
  prepare(sql) {
    return {
      /** Retourne la première ligne ou undefined */
      get(...args) {
        const params = args.flat();
        const stmt = _sqlDb.prepare(sql);
        if (params.length) stmt.bind(params);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row;
      },

      /** Retourne toutes les lignes */
      all(...args) {
        const params = args.flat();
        const stmt = _sqlDb.prepare(sql);
        if (params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },

      /**
       * Exécute une écriture (INSERT / UPDATE / DELETE)
       * Retourne { lastInsertRowid, changes }
       */
      run(...args) {
        const params = args.flat();
        _sqlDb.run(sql, params.length ? params : undefined);
        const lastId = _sqlDb.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? null;
        const changes = _sqlDb.getRowsModified();
        saveDb();
        return { lastInsertRowid: lastId, changes };
      }
    };
  },

  /**
   * Exécute du SQL multi-instructions (sans paramètres)
   * Compatible avec better-sqlite3's db.exec()
   */
  exec(sql) {
    _sqlDb.exec(sql);
    saveDb();
  },

  /**
   * Exécute un PRAGMA (better-sqlite3 accepte juste l'expression, ex : 'foreign_keys = ON')
   */
  pragma(expr) {
    _sqlDb.run(`PRAGMA ${expr}`);
  },

  /** Ferme proprement la base */
  close() {
    saveDb();
    if (_sqlDb) {
      _sqlDb.close();
      _sqlDb = null;
    }
  },

  /**
   * Initialise sql.js et ouvre/crée la base de données.
   * Doit être appelé (et attendu) AVANT tout accès à la DB.
   */
  async init() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      _sqlDb = new SQL.Database(fileBuffer);
    } else {
      _sqlDb = new SQL.Database();
    }

    // Foreign keys (WAL non supporté par sql.js en mémoire, inutile ici)
    _sqlDb.run('PRAGMA foreign_keys = ON');

    initTables();
    return db;
  }
};

// Si lancé directement (npm run db:init)
if (require.main === module) {
  db.init().then(() => {
    console.log('🗄️  Passerelle DB prête :', DB_PATH);
    db.close();
    process.exit(0);
  }).catch(err => {
    console.error('❌ Erreur init DB :', err);
    process.exit(1);
  });
}

module.exports = db;
