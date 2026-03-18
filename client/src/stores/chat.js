/**
 * stores/chat.js — Store Pinia pour le chat central de la Salle des Opérations
 * Gère les échanges textuels entre l'Amiral et le dispatcher IA
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { usePasserelleStore } from './passerelle'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

export const useChatStore = defineStore('chat', () => {
  // ─── État ─────────────────────────────────────────────────────────────────

  const messages = ref([
    {
      id: 'welcome',
      role: 'assistant',
      text: '👋 Bienvenue dans la Salle des Opérations, Amiral. Décrivez votre prochaine mission et je prépare l\'Escadron.',
      actions: null,
      timestamp: new Date().toISOString(),
    }
  ])

  const loading = ref(false)

  // sessionId stable pour la conversation courante (multi-tours)
  const sessionId = ref(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  // ─── Actions ──────────────────────────────────────────────────────────────

  /**
   * Envoie un message et reçoit la réponse du dispatcher
   */
  async function sendMessage(text) {
    if (!text.trim()) return

    // Ajouter le message utilisateur immédiatement
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      actions: null,
      timestamp: new Date().toISOString(),
    }
    messages.value.push(userMsg)
    loading.value = true

    try {
      const { data } = await api.post('/chat', {
        message: text.trim(),
        sessionId: sessionId.value,
      })

      // Rafraîchir les missions si une a été créée (statut hangar)
      if (data.missionId) {
        const store = usePasserelleStore()
        await store.fetchMissions()
      }

      addAssistantMessage(
        data.response,
        data.actions || null,
        data.missionId || null,
        data.missionTitle || null,
      )
    } catch (err) {
      console.error('❌ Chat error:', err.message)
      addAssistantMessage(
        '⚠️ Erreur de communication avec le dispatcher. Réessayez.',
        null
      )
    } finally {
      loading.value = false
    }
  }

  /**
   * Gère le clic sur un bouton d'action dans le chat
   * @param {Object} action - { id, icon, label }
   * @param {Object} msg - message contenant missionId / missionTitle
   */
  async function handleAction(action, msg) {
    const store = usePasserelleStore()

    if (action.id === 'launch' && msg.missionId) {
      try {
        await store.lancerMission(msg.missionId)
        addAssistantMessage(`🚀 Mission lancée ! L'agent prend en charge : *${msg.missionTitle || 'nouvelle mission'}*`)
        // Réinitialiser la session après action
        resetSession()
      } catch {
        addAssistantMessage('❌ Erreur au lancement de la mission.')
      }

    } else if (action.id === 'hangar' && msg.missionId) {
      // Mission déjà créée en hangar par le dispatcher — juste confirmer
      addAssistantMessage(
        `⏸️ Mission mise en stand-by dans le hangar.\nTu peux la lancer quand tu veux depuis le panneau STAND-BY.`
      )
      await store.fetchMissions()
      resetSession()

    } else if (action.id === 'cancel') {
      // Supprimer la mission si elle existe
      if (msg.missionId) {
        try {
          await api.delete(`/chat/mission/${msg.missionId}`)
          await store.fetchMissions()
        } catch { /* ignore */ }
      }
      addAssistantMessage('D\'accord, mission annulée. Dis-moi quand tu es prêt.')
      resetSession()
    }
  }

  /**
   * Ajoute un message de l'assistant (avec optionnellement des boutons d'action)
   */
  function addAssistantMessage(text, actions = null, missionId = null, missionTitle = null) {
    messages.value.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text,
      actions,
      missionId,
      missionTitle,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Réinitialise la session de conversation (nouvelle mission)
   */
  function resetSession() {
    sessionId.value = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Vide l'historique du chat (garde le message de bienvenue)
   */
  function clearChat() {
    messages.value = [messages.value[0]]
    resetSession()
  }

  return {
    messages,
    loading,
    sessionId,
    sendMessage,
    handleAction,
    addAssistantMessage,
    resetSession,
    clearChat,
  }
})
