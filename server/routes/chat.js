/**
 * routes/chat.js — Route POST /api/chat
 * Dispatcher IA (Claude API) : reçoit un message de l'Amiral,
 * analyse la demande via Claude, et retourne soit une question
 * de clarification soit une proposition de mission avec options d'action.
 */

const express = require('express')
const router = express.Router()
const db = require('../db')

// Lazy-init Anthropic client pour ne pas crasher si la clé est absente
let anthropicClient = null
function getAnthropicClient() {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require('@anthropic-ai/sdk')
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

const DISPATCHER_SYSTEM_PROMPT = `Tu es le dispatcher de "La Passerelle", un système de supervision d'agents IA.
Ton rôle : analyser les demandes de l'Amiral et les transformer en missions claires et actionnables.

Règles :
- Si la demande est claire et complète → réponds en JSON : {"action": "proposer", "titre": "...", "description": "..."}
- Si des informations manquent → réponds en JSON : {"action": "clarifier", "question": "..."}
- Sois concis, professionnel, légèrement spatial dans le ton

Exemple demande floue : "Je veux changer un truc dans le BKO"
→ {"action": "clarifier", "question": "Quel aspect du BKO souhaites-tu modifier ?"}

Exemple demande claire : "Changer la couleur de fond du dashboard BKO en #1a1a2e"
→ {"action": "proposer", "titre": "Fond dashboard BKO → #1a1a2e", "description": "Modifier la couleur de fond du dashboard principal du BKO pour utiliser la couleur #1a1a2e. Appliquer sur toutes les pages du dashboard."}

Réponds UNIQUEMENT avec le JSON, sans markdown, sans explication.`

// ─── Historique de conversation in-memory (keyed by sessionId) ────────────────
const conversationHistory = new Map()

function getHistory(sessionId) {
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, [])
  }
  return conversationHistory.get(sessionId)
}

function clearHistory(sessionId) {
  conversationHistory.delete(sessionId)
}

// Nettoyage périodique des vieilles sessions
setInterval(() => {
  if (conversationHistory.size > 200) {
    const keys = [...conversationHistory.keys()].slice(0, 100)
    keys.forEach(k => conversationHistory.delete(k))
    console.log('🧹 Chat history cleanup: 100 sessions supprimées')
  }
}, 3_600_000)

// ─── Route principale ─────────────────────────────────────────────────────────

/**
 * POST /api/chat
 * Body: { message: string, sessionId?: string }
 * Réponse: { response: string, actions?: array, missionId?: number, sessionId: string }
 */
router.post('/', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message requis' })
    }

    const text = message.trim()
    const client = getAnthropicClient()

    // ── Fallback simulé si pas de clé API ──────────────────────────────────
    if (!client) {
      return simulatedDispatcher(res, text)
    }

    // ── Appel Claude API ───────────────────────────────────────────────────
    const history = getHistory(sessionId)
    history.push({ role: 'user', content: text })

    let rawContent
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        system: DISPATCHER_SYSTEM_PROMPT,
        messages: history,
      })
      rawContent = response.content[0].text.trim()
    } catch (apiErr) {
      // Fallback haiku si opus pas dispo
      if (apiErr.status === 404 || apiErr.message?.includes('model')) {
        const response = await client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 500,
          system: DISPATCHER_SYSTEM_PROMPT,
          messages: history,
        })
        rawContent = response.content[0].text.trim()
      } else {
        throw apiErr
      }
    }

    // Ajouter la réponse de l'assistant à l'historique
    history.push({ role: 'assistant', content: rawContent })

    // ── Parser la réponse JSON ─────────────────────────────────────────────
    let parsed
    try {
      // Extraire le JSON si entouré de backticks
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || rawContent.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]).trim() : rawContent
      parsed = JSON.parse(jsonStr)
    } catch {
      // Si pas du JSON valide → traiter comme une clarification
      parsed = { action: 'clarifier', question: rawContent }
    }

    // ── Action : clarifier ─────────────────────────────────────────────────
    if (parsed.action === 'clarifier') {
      return res.json({
        response: parsed.question || rawContent,
        actions: null,
        missionId: null,
        sessionId,
      })
    }

    // ── Action : proposer ──────────────────────────────────────────────────
    if (parsed.action === 'proposer') {
      const titre = (parsed.titre || text).substring(0, 200)
      const description = parsed.description || text

      // Créer la mission en DB avec statut 'hangar'
      const result = db.prepare(`
        INSERT INTO missions (titre, description, statut, type)
        VALUES (?, ?, 'hangar', 'execution')
      `).run(titre, description)

      const missionId = result.lastInsertRowid

      // Réinitialiser l'historique après proposition
      clearHistory(sessionId)

      return res.json({
        response: `Mission préparée, Amiral :\n\n📋 ${titre}\n\nComment procéder ?`,
        missionId,
        missionTitle: titre,
        sessionId,
        actions: [
          { id: 'launch', icon: '🚀', label: 'Lancer maintenant' },
          { id: 'hangar', icon: '⏸️', label: 'Lancement différé' },
          { id: 'cancel', icon: '✕',  label: 'Annuler' },
        ],
      })
    }

    // ── Réponse inconnue ───────────────────────────────────────────────────
    return res.json({
      response: rawContent,
      actions: null,
      missionId: null,
      sessionId,
    })

  } catch (err) {
    console.error('❌ Chat route error:', err.message)
    if (err.status === 401 || err.status === 403) {
      return res.status(500).json({ error: '⚠️ Clé API Anthropic invalide — configure ANTHROPIC_API_KEY dans .env' })
    }
    res.status(500).json({ error: 'Erreur interne du dispatcher' })
  }
})

// ─── Endpoint pour annuler une mission proposée ───────────────────────────────
router.delete('/mission/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    // Supprimer seulement si encore en hangar (pas encore lancée)
    db.prepare(`DELETE FROM missions WHERE id = ? AND statut = 'hangar'`).run(id)
    res.json({ success: true })
  } catch (err) {
    console.error('❌ Chat cancel mission:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Fallback simulé (sans clé API) ──────────────────────────────────────────
function simulatedDispatcher(res, text) {
  if (text.length <= 20) {
    return res.json({
      response: `⚠️ Dispatcher simulé (ANTHROPIC_API_KEY manquant)\n\nPeux-tu donner plus de détails sur la mission ?`,
      actions: null,
      missionId: null,
    })
  }

  const titre = text.length > 80 ? text.substring(0, 77) + '...' : text
  const result = db.prepare(`
    INSERT INTO missions (titre, description, statut, type)
    VALUES (?, ?, 'hangar', 'execution')
  `).run(titre, text)

  return res.json({
    response: `⚠️ Mode simulé (ANTHROPIC_API_KEY manquant)\n\n📋 ${titre}\n\nComment procéder ?`,
    missionId: result.lastInsertRowid,
    missionTitle: titre,
    actions: [
      { id: 'launch', icon: '🚀', label: 'Lancer maintenant' },
      { id: 'hangar', icon: '⏸️', label: 'Lancement différé' },
      { id: 'cancel', icon: '✕',  label: 'Annuler' },
    ],
  })
}

module.exports = router
