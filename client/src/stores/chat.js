/**
 * stores/chat.js — Store Pinia pour le chat central de la Salle des Opérations
 * Gère les échanges textuels entre l'Amiral et le dispatcher IA
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

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
      const { data } = await api.post('/chat', { message: text.trim() })

      addAssistantMessage(data.response, data.actions || null, data.missionId || null)
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
   * Ajoute un message de l'assistant (avec optionnellement des boutons d'action)
   */
  function addAssistantMessage(text, actions = null, missionId = null) {
    messages.value.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text,
      actions,
      missionId,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Vide l'historique du chat (garde le message de bienvenue)
   */
  function clearChat() {
    messages.value = [messages.value[0]]
  }

  return {
    messages,
    loading,
    sendMessage,
    addAssistantMessage,
    clearChat,
  }
})
