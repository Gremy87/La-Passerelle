/**
 * routes/missions.js — API REST pour la gestion des missions
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { events } = require('../websocket');

/**
 * GET /api/missions
 * Liste toutes les missions avec leurs agents associés
 */
router.get('/', (req, res) => {
  try {
    const { statut, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT m.*, a.nom as agent_nom, a.statut as agent_statut
      FROM missions m
      LEFT JOIN agents a ON m.agent_id = a.id
    `;
    const params = [];
    
    if (statut) {
      query += ' WHERE m.statut = ?';
      params.push(statut);
    }
    
    query += ' ORDER BY m.updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const missions = db.prepare(query).all(...params);
    res.json(missions);
  } catch (err) {
    console.error('❌ GET /missions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/missions/:id
 * Détail d'une mission avec ses messages
 */
router.get('/:id', (req, res) => {
  try {
    const mission = db.prepare(`
      SELECT m.*, a.nom as agent_nom, a.statut as agent_statut
      FROM missions m
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.id = ?
    `).get(req.params.id);
    
    if (!mission) {
      return res.status(404).json({ error: 'Mission introuvable' });
    }
    
    // Charger les messages de la mission
    const messages = db.prepare(`
      SELECT msg.*, a.nom as agent_nom
      FROM messages msg
      LEFT JOIN agents a ON msg.agent_id = a.id
      WHERE msg.mission_id = ?
      ORDER BY msg.created_at ASC
    `).all(req.params.id);
    
    res.json({ ...mission, messages });
  } catch (err) {
    console.error('❌ GET /missions/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/missions
 * Créer une nouvelle mission
 */
router.post('/', (req, res) => {
  try {
    const { titre, description, type = 'execution', repo_path } = req.body;
    
    if (!titre || !description) {
      return res.status(400).json({ error: 'titre et description sont requis' });
    }
    
    const result = db.prepare(`
      INSERT INTO missions (titre, description, type, repo_path, statut)
      VALUES (?, ?, ?, ?, 'hangar')
    `).run(titre, description, type, repo_path || null);
    
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(result.lastInsertRowid);
    
    // Notifier les clients WebSocket
    events.missionUpdate(mission);
    
    res.status(201).json(mission);
  } catch (err) {
    console.error('❌ POST /missions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/missions/:id
 * Modifier une mission (statut, assignation agent, etc.)
 */
router.patch('/:id', (req, res) => {
  try {
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
    
    if (!mission) {
      return res.status(404).json({ error: 'Mission introuvable' });
    }
    
    const { titre, description, statut, agent_id, repo_path, worktree_path } = req.body;
    
    // Construire la mise à jour dynamiquement
    const updates = [];
    const params = [];
    
    if (titre !== undefined)         { updates.push('titre = ?');         params.push(titre); }
    if (description !== undefined)   { updates.push('description = ?');   params.push(description); }
    if (statut !== undefined)        { updates.push('statut = ?');         params.push(statut); }
    if (agent_id !== undefined)      { updates.push('agent_id = ?');       params.push(agent_id); }
    if (repo_path !== undefined)     { updates.push('repo_path = ?');      params.push(repo_path); }
    if (worktree_path !== undefined) { updates.push('worktree_path = ?'); params.push(worktree_path); }
    
    // Marquer comme terminée si le statut le demande
    if (statut === 'terminee' || statut === 'abandonnee') {
      updates.push("completed_at = datetime('now')");
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }
    
    params.push(req.params.id);
    db.prepare(`UPDATE missions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const updatedMission = db.prepare(`
      SELECT m.*, a.nom as agent_nom
      FROM missions m
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.id = ?
    `).get(req.params.id);
    
    events.missionUpdate(updatedMission);
    
    res.json(updatedMission);
  } catch (err) {
    console.error('❌ PATCH /missions/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/missions/:id
 * Supprimer une mission (et ses messages en cascade)
 */
router.delete('/:id', (req, res) => {
  try {
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
    
    if (!mission) {
      return res.status(404).json({ error: 'Mission introuvable' });
    }
    
    db.prepare('DELETE FROM missions WHERE id = ?').run(req.params.id);
    
    res.json({ ok: true, message: 'Mission supprimée' });
  } catch (err) {
    console.error('❌ DELETE /missions/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/missions/:id/message
 * Envoyer un message à l'agent en cours (réponse de l'Amiral)
 */
router.post('/:id/message', (req, res) => {
  try {
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
    
    if (!mission) {
      return res.status(404).json({ error: 'Mission introuvable' });
    }
    
    const { contenu } = req.body;
    
    if (!contenu) {
      return res.status(400).json({ error: 'contenu est requis' });
    }
    
    const result = db.prepare(`
      INSERT INTO messages (mission_id, agent_id, role, contenu, type)
      VALUES (?, NULL, 'amiral', ?, 'texte')
    `).run(req.params.id, contenu);
    
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
    
    // Diffuser en temps réel
    events.agentLog(req.params.id, message);
    
    // Si la mission était en intervention, la remettre en cours
    if (mission.statut === 'intervention') {
      db.prepare("UPDATE missions SET statut = 'en_cours' WHERE id = ?").run(req.params.id);
      
      if (mission.agent_id) {
        db.prepare("UPDATE agents SET statut = 'en_mission' WHERE id = ?").run(mission.agent_id);
      }
      
      const updatedMission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
      events.missionUpdate(updatedMission);
    }
    
    res.status(201).json(message);
  } catch (err) {
    console.error('❌ POST /missions/:id/message:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
