/**
 * routes/hangar.js — API REST pour le hangar (todos personnels de l'Amiral)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { events } = require('../websocket');

/**
 * GET /api/hangar
 * Lister tous les items du hangar
 */
router.get('/', (req, res) => {
  try {
    const { statut } = req.query;
    
    let query = `
      SELECT h.*, m.titre as mission_titre, m.statut as mission_statut
      FROM hangar h
      LEFT JOIN missions m ON h.mission_id = m.id
    `;
    const params = [];
    
    if (statut) {
      query += ' WHERE h.statut = ?';
      params.push(statut);
    } else {
      // Par défaut, exclure les items complètement terminés/abandonnés
      query += " WHERE h.statut != 'abandonne'";
    }
    
    query += ' ORDER BY CASE h.priorite WHEN \'urgente\' THEN 1 WHEN \'haute\' THEN 2 WHEN \'normale\' THEN 3 ELSE 4 END, h.created_at DESC';
    
    const items = db.prepare(query).all(...params);
    res.json(items);
  } catch (err) {
    console.error('❌ GET /hangar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/hangar/:id
 * Détail d'un item du hangar
 */
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare(`
      SELECT h.*, m.titre as mission_titre
      FROM hangar h
      LEFT JOIN missions m ON h.mission_id = m.id
      WHERE h.id = ?
    `).get(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item introuvable' });
    }
    
    res.json(item);
  } catch (err) {
    console.error('❌ GET /hangar/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/hangar
 * Créer un nouvel item dans le hangar
 */
router.post('/', (req, res) => {
  try {
    const { titre, description, priorite = 'normale' } = req.body;
    
    if (!titre) {
      return res.status(400).json({ error: 'titre est requis' });
    }
    
    const result = db.prepare(`
      INSERT INTO hangar (titre, description, priorite, statut)
      VALUES (?, ?, ?, 'en_attente')
    `).run(titre, description || null, priorite);
    
    const item = db.prepare('SELECT * FROM hangar WHERE id = ?').get(result.lastInsertRowid);
    
    events.hangarUpdate(item);
    
    res.status(201).json(item);
  } catch (err) {
    console.error('❌ POST /hangar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/hangar/:id
 * Modifier un item du hangar
 */
router.patch('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM hangar WHERE id = ?').get(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item introuvable' });
    }
    
    const { titre, description, priorite, statut, mission_id } = req.body;
    
    const updates = [];
    const params = [];
    
    if (titre !== undefined)       { updates.push('titre = ?');       params.push(titre); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (priorite !== undefined)    { updates.push('priorite = ?');    params.push(priorite); }
    if (statut !== undefined)      { updates.push('statut = ?');      params.push(statut); }
    if (mission_id !== undefined)  { updates.push('mission_id = ?'); params.push(mission_id); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }
    
    params.push(req.params.id);
    db.prepare(`UPDATE hangar SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const updatedItem = db.prepare('SELECT * FROM hangar WHERE id = ?').get(req.params.id);
    
    events.hangarUpdate(updatedItem);
    
    res.json(updatedItem);
  } catch (err) {
    console.error('❌ PATCH /hangar/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/hangar/:id
 * Supprimer un item du hangar
 */
router.delete('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM hangar WHERE id = ?').get(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item introuvable' });
    }
    
    db.prepare('DELETE FROM hangar WHERE id = ?').run(req.params.id);
    
    res.json({ ok: true, message: 'Item supprimé' });
  } catch (err) {
    console.error('❌ DELETE /hangar/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/hangar/:id/transformer-mission
 * Convertit un todo du hangar en mission
 */
router.post('/:id/transformer-mission', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM hangar WHERE id = ?').get(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item introuvable' });
    }
    
    const { repo_path, type = 'execution' } = req.body;
    
    // Créer la mission depuis le todo
    const missionResult = db.prepare(`
      INSERT INTO missions (titre, description, type, repo_path, statut)
      VALUES (?, ?, ?, ?, 'hangar')
    `).run(item.titre, item.description || item.titre, type, repo_path || null);
    
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionResult.lastInsertRowid);
    
    // Lier le hangar item à la mission créée
    db.prepare('UPDATE hangar SET mission_id = ?, statut = \'en_cours\' WHERE id = ?').run(mission.id, item.id);
    
    events.missionUpdate(mission);
    events.hangarUpdate(db.prepare('SELECT * FROM hangar WHERE id = ?').get(item.id));
    
    res.status(201).json({ hangar: db.prepare('SELECT * FROM hangar WHERE id = ?').get(item.id), mission });
  } catch (err) {
    console.error('❌ POST /hangar/:id/transformer-mission:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
