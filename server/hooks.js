/**
 * hooks.js — Réception des hooks HTTP de Claude Code
 * Ces endpoints sont appelés par Claude Code lors de ses actions
 */

const express = require('express');
const router = express.Router();
const db = require('./db');
const { events } = require('./websocket');

/**
 * Trouve une mission active par agent_id ou crée un log orphelin
 */
function logMessage(missionId, agentId, role, contenu, type = 'info') {
  try {
    const stmt = db.prepare(`
      INSERT INTO messages (mission_id, agent_id, role, contenu, type)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(missionId, agentId, role, contenu, type);
    
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
    
    // Diffuser en temps réel
    events.agentLog(missionId, message);
    
    return message;
  } catch (err) {
    console.error('❌ Erreur log message:', err.message);
  }
}

/**
 * POST /hooks/session-start
 * Déclenché quand Claude Code démarre une session
 */
router.post('/session-start', (req, res) => {
  const { session_id, mission_id, agent_nom } = req.body;
  console.log(`🟢 Hook session-start — agent: ${agent_nom}, mission: ${mission_id}`);

  try {
    // Mettre à jour le statut de l'agent si connu
    if (mission_id) {
      const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
      
      if (mission && mission.agent_id) {
        db.prepare(`
          UPDATE agents SET statut = 'en_mission', last_seen = datetime('now')
          WHERE id = ?
        `).run(mission.agent_id);

        db.prepare(`
          UPDATE missions SET statut = 'en_cours' WHERE id = ? AND statut = 'hangar'
        `).run(mission_id);

        const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
        const updatedAgent = db.prepare('SELECT * FROM agents WHERE id = ?').get(mission.agent_id);
        
        events.missionUpdate(updatedMission);
        events.agentStatus(updatedAgent);
        
        logMessage(mission_id, mission.agent_id, 'systeme', `Session démarrée (${session_id})`, 'info');
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook session-start error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /hooks/session-end
 * Déclenché quand Claude Code termine une session
 */
router.post('/session-end', (req, res) => {
  const { session_id, mission_id, statut } = req.body;
  console.log(`🔴 Hook session-end — mission: ${mission_id}, statut: ${statut}`);

  try {
    if (mission_id) {
      const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
      
      if (mission && mission.agent_id) {
        // Libérer l'agent
        db.prepare(`
          UPDATE agents 
          SET statut = 'libre', mission_id = NULL, last_seen = datetime('now')
          WHERE id = ?
        `).run(mission.agent_id);

        // Mettre à jour la mission selon le statut reçu
        const nouveauStatut = statut || 'terminee';
        db.prepare(`
          UPDATE missions 
          SET statut = ?, completed_at = datetime('now'), agent_id = NULL
          WHERE id = ?
        `).run(nouveauStatut, mission_id);

        const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
        const updatedAgent = db.prepare('SELECT * FROM agents WHERE id = ?').get(mission.agent_id);
        
        events.missionUpdate(updatedMission);
        events.agentStatus(updatedAgent);
        
        logMessage(mission_id, mission.agent_id, 'systeme', `Session terminée (${session_id})`, 'info');
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook session-end error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /hooks/tool-use
 * Déclenché après chaque utilisation d'outil par Claude Code
 */
router.post('/tool-use', (req, res) => {
  const { mission_id, agent_id, tool_name, tool_input, tool_result } = req.body;
  
  try {
    if (mission_id) {
      // Formater le message de log pour l'outil
      const contenu = JSON.stringify({
        outil: tool_name,
        input: tool_input,
        result: tool_result
      });

      logMessage(mission_id, agent_id, 'agent', contenu, 'tool_use');

      // Mettre à jour le last_seen de l'agent
      if (agent_id) {
        db.prepare('UPDATE agents SET last_seen = datetime(\'now\') WHERE id = ?').run(agent_id);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook tool-use error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /hooks/task-completed
 * Déclenché quand Claude Code signale la fin d'une tâche
 */
router.post('/task-completed', (req, res) => {
  const { mission_id, agent_id, summary } = req.body;
  console.log(`✅ Hook task-completed — mission: ${mission_id}`);

  try {
    if (mission_id) {
      db.prepare(`
        UPDATE missions 
        SET statut = 'terminee', completed_at = datetime('now')
        WHERE id = ?
      `).run(mission_id);

      const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
      events.missionUpdate(updatedMission);

      const message = summary || 'Mission accomplie 🎯';
      logMessage(mission_id, agent_id, 'agent', message, 'info');
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook task-completed error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /hooks/notification
 * Déclenché quand Claude Code a besoin de l'Amiral
 */
router.post('/notification', (req, res) => {
  const { mission_id, agent_id, message } = req.body;
  console.log(`🚨 Hook notification — mission: ${mission_id}`);

  try {
    if (mission_id) {
      // Passer la mission en mode "intervention requise"
      db.prepare(`
        UPDATE missions SET statut = 'intervention' WHERE id = ?
      `).run(mission_id);

      if (agent_id) {
        db.prepare(`
          UPDATE agents SET statut = 'intervention' WHERE id = ?
        `).run(agent_id);
      }

      const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
      events.interventionNew(updatedMission);

      logMessage(mission_id, agent_id, 'agent', message || 'Intervention requise', 'info');
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook notification error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
