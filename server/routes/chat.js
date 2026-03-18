/**
 * routes/chat.js — Route POST /api/chat
 * Dispatcher IA (MVP simulé) : reçoit un message de l'Amiral,
 * crée une mission si la description est suffisamment détaillée,
 * et retourne une réponse avec options d'action.
 */

const express = require('express')
const router = express.Router()
const db = require('../db')

/**
 * POST /api/chat
 * Body: { message: string }
 * Réponse: { response: string, actions?: array, missionId?: number }
 */
router.post('/', async (req, res) => {
  try {
    const { message } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message requis' })
    }

    const text = message.trim()

    // MVP : si le message est trop court → demander plus de détails
    if (text.length <= 20) {
      return res.json({
        response: `Peux-tu me donner plus de détails ? Décris la mission plus précisément : quel repo, quel objectif, quelles contraintes.`,
        actions: null,
        missionId: null,
      })
    }

    // Créer une mission en DB avec statut 'hangar'
    const titre = text.length > 80
      ? text.substring(0, 77) + '...'
      : text

    const result = db.prepare(`
      INSERT INTO missions (titre, description, statut, type)
      VALUES (?, ?, 'hangar', 'execution')
    `).run(titre, text)

    const missionId = result.lastInsertRowid

    // Réponse du dispatcher avec boutons d'action
    const response = `Compris. J'ai préparé la mission :\n\n📋 *${titre}*\n\nComment tu veux procéder ?`

    return res.json({
      response,
      missionId,
      missionTitle: titre,
      actions: [
        {
          id: 'launch',
          icon: '🚀',
          label: 'Lancer maintenant',
        },
        {
          id: 'stanby',
          icon: '📥',
          label: 'Mettre en stand-by',
        },
        {
          id: 'cancel',
          icon: '✕',
          label: 'Annuler',
        },
      ],
    })
  } catch (err) {
    console.error('❌ Chat route error:', err.message)
    res.status(500).json({ error: 'Erreur interne du dispatcher' })
  }
})

module.exports = router
