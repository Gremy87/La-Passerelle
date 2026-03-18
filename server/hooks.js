/**
 * hooks.js — Réception des hooks HTTP de Claude Code
 * Ces endpoints sont appelés par Claude Code lors de ses actions
 */

const express = require('express');
const router = express.Router();
const db = require('./db');
const { events } = require('./websocket');
const { notifyIntervention } = require('./telegram');

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
      const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);

      db.prepare(`
        UPDATE missions 
        SET statut = 'terminee', completed_at = datetime('now')
        WHERE id = ?
      `).run(mission_id);

      // Libérer l'agent assigné
      const agentIdToFree = mission?.agent_id || agent_id;
      if (agentIdToFree) {
        db.prepare(`
          UPDATE agents SET statut = 'libre', mission_id = NULL, pid = NULL WHERE id = ?
        `).run(agentIdToFree);
        const updatedAgent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentIdToFree);
        if (updatedAgent) events.agentStatus(updatedAgent);
      }

      const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
      events.missionUpdate(updatedMission);

      const message = summary || 'Mission accomplie 🎯';
      logMessage(mission_id, agentIdToFree, 'agent', message, 'info');
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

      // Notification Telegram
      notifyIntervention(updatedMission).catch(err => console.error('⚠️  Telegram notify error:', err.message));
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook notification error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /hooks/agent-log
 * Reçoit les logs streamés depuis launch-agent.js
 */
router.post('/agent-log', (req, res) => {
  const { mission_id, type, content } = req.body;

  try {
    if (!mission_id || !content) {
      return res.status(400).json({ error: 'mission_id et content sont requis' });
    }

    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
    const agentId = mission?.agent_id || null;

    // Mapper le type SDK vers le type BDD
    const typeDb = ['texte', 'tool_use', 'tool_result', 'erreur', 'info'].includes(type)
      ? type
      : 'info';

    const result = db.prepare(`
      INSERT INTO messages (mission_id, agent_id, role, contenu, type)
      VALUES (?, ?, 'agent', ?, ?)
    `).run(mission_id, agentId, content, typeDb);

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);

    // Broadcast WebSocket
    events.agentLog(mission_id, message);

    // Détection automatique d'intervention
    const interventionKeywords = [
      'permission', 'autoriser', 'j\'ai besoin', 'peux-tu', 'bloqu',
      'accès refus', 'unable to', 'cannot write', 'denied'
    ];
    const mission_statut = mission?.statut;
    const isIntervention = interventionKeywords.some(kw =>
      content.toLowerCase().includes(kw.toLowerCase())
    );
    if (isIntervention && mission_statut === 'en_cours') {
      db.prepare('UPDATE missions SET statut = ? WHERE id = ?').run('intervention', mission_id);
      const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
      events.missionUpdate(updatedMission);
      console.log(`🚨 Intervention automatique détectée — mission #${mission_id}`);
      // Notification Telegram
      notifyIntervention(updatedMission).catch(err => console.error('⚠️  Telegram notify error:', err.message));
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook agent-log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /hooks/agent-error
 * L'agent a planté — remettre la mission en statut erreur
 */
router.post('/agent-error', (req, res) => {
  const { mission_id, error } = req.body;
  console.error(`❌ Hook agent-error — mission: ${mission_id} — ${error}`);

  try {
    if (mission_id) {
      const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);

      // On n'a pas de statut 'erreur' dans le CHECK — on utilise 'abandonnee'
      // et on logge le message d'erreur pour traçabilité
      db.prepare(`
        UPDATE missions SET statut = 'abandonnee', completed_at = datetime('now') WHERE id = ?
      `).run(mission_id);

      if (mission?.agent_id) {
        db.prepare(`
          UPDATE agents SET statut = 'libre', mission_id = NULL, pid = NULL WHERE id = ?
        `).run(mission.agent_id);

        const updatedAgent = db.prepare('SELECT * FROM agents WHERE id = ?').get(mission.agent_id);
        events.agentStatus(updatedAgent);
      }

      const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
      events.missionUpdate(updatedMission);

      logMessage(mission_id, mission?.agent_id, 'systeme', `❌ Erreur agent : ${error}`, 'erreur');
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook agent-error handler error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /hooks/session-id
 * L'agent informe le serveur du session_id Claude pour permettre --resume
 */
router.post('/session-id', (req, res) => {
  const { mission_id, session_id } = req.body;
  console.log(`🔑 Hook session-id — mission: ${mission_id}, session: ${session_id}`);

  try {
    if (mission_id && session_id) {
      db.prepare('UPDATE missions SET session_id = ? WHERE id = ?').run(session_id, mission_id);
      const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
      events.missionUpdate(updatedMission);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook session-id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /hooks/worktree-created
 * L'agent informe le serveur du chemin du worktree créé
 */
router.post('/worktree-created', (req, res) => {
  const { mission_id, worktree_path } = req.body;

  try {
    if (mission_id && worktree_path) {
      db.prepare('UPDATE missions SET worktree_path = ? WHERE id = ?').run(worktree_path, mission_id);
      const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
      events.missionUpdate(updatedMission);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Hook worktree-created error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
