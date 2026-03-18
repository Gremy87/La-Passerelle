/**
 * routes/agents.js — API REST pour la gestion des agents
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { events } = require('../websocket');

/**
 * GET /api/agents
 * Lister tous les agents avec leur mission en cours
 */
router.get('/', (req, res) => {
  try {
    const agents = db.prepare(`
      SELECT a.*, m.titre as mission_titre, m.statut as mission_statut
      FROM agents a
      LEFT JOIN missions m ON a.mission_id = m.id
      ORDER BY a.statut ASC, a.nom ASC
    `).all();
    
    res.json(agents);
  } catch (err) {
    console.error('❌ GET /agents:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/agents/:id
 * Détail d'un agent
 */
router.get('/:id', (req, res) => {
  try {
    const agent = db.prepare(`
      SELECT a.*, m.titre as mission_titre, m.statut as mission_statut, m.description as mission_description
      FROM agents a
      LEFT JOIN missions m ON a.mission_id = m.id
      WHERE a.id = ?
    `).get(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent introuvable' });
    }
    
    res.json(agent);
  } catch (err) {
    console.error('❌ GET /agents/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agents
 * Créer un nouvel agent
 */
router.post('/', (req, res) => {
  try {
    const { nom, hook_endpoint } = req.body;
    
    if (!nom) {
      return res.status(400).json({ error: 'nom est requis' });
    }
    
    const result = db.prepare(`
      INSERT INTO agents (nom, statut, hook_endpoint)
      VALUES (?, 'libre', ?)
    `).run(nom, hook_endpoint || null);
    
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(result.lastInsertRowid);
    
    events.agentStatus(agent);
    
    res.status(201).json(agent);
  } catch (err) {
    console.error('❌ POST /agents:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/agents/:id
 * Mettre à jour un agent (statut, mission assignée, etc.)
 */
router.patch('/:id', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent introuvable' });
    }
    
    const { nom, statut, mission_id, pid, hook_endpoint } = req.body;
    
    const updates = [];
    const params = [];
    
    if (nom !== undefined)           { updates.push('nom = ?');           params.push(nom); }
    if (statut !== undefined)        { updates.push('statut = ?');         params.push(statut); }
    if (mission_id !== undefined)    { updates.push('mission_id = ?');     params.push(mission_id); }
    if (pid !== undefined)           { updates.push('pid = ?');            params.push(pid); }
    if (hook_endpoint !== undefined) { updates.push('hook_endpoint = ?'); params.push(hook_endpoint); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }
    
    updates.push("last_seen = datetime('now')");
    params.push(req.params.id);
    
    db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const updatedAgent = db.prepare(`
      SELECT a.*, m.titre as mission_titre
      FROM agents a
      LEFT JOIN missions m ON a.mission_id = m.id
      WHERE a.id = ?
    `).get(req.params.id);
    
    events.agentStatus(updatedAgent);
    
    res.json(updatedAgent);
  } catch (err) {
    console.error('❌ PATCH /agents/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/agents/:id
 * Supprimer un agent
 */
router.delete('/:id', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent introuvable' });
    }
    
    db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
    
    res.json({ ok: true, message: 'Agent supprimé' });
  } catch (err) {
    console.error('❌ DELETE /agents/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
