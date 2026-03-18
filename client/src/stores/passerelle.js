/**
 * stores/passerelle.js — Store Pinia principal
 * Gère l'état global : missions, agents, hangar, WebSocket
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

// Configuration Axios
const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Pour les cookies JWT
})

export const usePasserelleStore = defineStore('passerelle', () => {
  // ─── État ─────────────────────────────────────────────────────────────────

  const missions  = ref([])
  const agents    = ref([])
  const hangar    = ref([])
  const loading   = ref(false)
  const connected = ref(false) // statut WebSocket
  const ws        = ref(null)

  // ─── Logs temps réel par mission ──────────────────────────────────────────
  // { [missionId]: [ { type, data, timestamp } ] }
  const logsMap = ref({})

  // ─── Getters ──────────────────────────────────────────────────────────────

  const missionsByStatut = computed(() => ({
    hangar:       missions.value.filter(m => m.statut === 'hangar'),
    en_cours:     missions.value.filter(m => m.statut === 'en_cours'),
    intervention: missions.value.filter(m => m.statut === 'intervention'),
    terminee:     missions.value.filter(m => m.statut === 'terminee'),
    abandonnee:   missions.value.filter(m => m.statut === 'abandonnee'),
    refinement:   missions.value.filter(m => m.statut === 'refinement'),
  }))

  const agentsActifs = computed(() =>
    agents.value.filter(a => a.statut !== 'hors_ligne')
  )

  const interventionsCount = computed(() =>
    missions.value.filter(m => m.statut === 'intervention').length
  )

  const hangarEnAttente = computed(() =>
    hangar.value.filter(h => h.statut === 'en_attente')
  )

  /**
   * Retourne les logs d'une mission donnée (réactif)
   */
  function missionLogs(missionId) {
    return logsMap.value[missionId] || []
  }

  function addMissionLog(missionId, entry) {
    if (!logsMap.value[missionId]) {
      logsMap.value[missionId] = []
    }
    logsMap.value[missionId].push(entry)
    // Garder max 500 entrées par mission
    if (logsMap.value[missionId].length > 500) {
      logsMap.value[missionId].splice(0, 100)
    }
  }

  // ─── Actions Missions ─────────────────────────────────────────────────────

  async function fetchMissions() {
    try {
      const { data } = await api.get('/missions')
      missions.value = data
    } catch (err) {
      console.error('❌ Fetch missions:', err.message)
    }
  }

  async function getMission(id) {
    try {
      const { data } = await api.get(`/missions/${id}`)
      return data
    } catch (err) {
      console.error('❌ Get mission:', err.message)
      return null
    }
  }

  async function createMission(payload) {
    const { data } = await api.post('/missions', payload)
    missions.value.unshift(data)
    return data
  }

  async function updateMission(id, payload) {
    const { data } = await api.patch(`/missions/${id}`, payload)
    const idx = missions.value.findIndex(m => m.id === id)
    if (idx !== -1) missions.value[idx] = data
    return data
  }

  async function deleteMission(id) {
    await api.delete(`/missions/${id}`)
    missions.value = missions.value.filter(m => m.id !== id)
  }

  async function sendMessage(missionId, contenu) {
    const { data } = await api.post(`/missions/${missionId}/message`, { contenu })
    return data
  }

  async function lancerMission(missionId) {
    const { data } = await api.post(`/missions/${missionId}/lancer`)
    // Mettre à jour la mission et l'agent dans le store
    if (data.success) {
      await Promise.all([fetchMissions(), fetchAgents()])
    }
    return data
  }

  // ─── Actions Agents ───────────────────────────────────────────────────────

  async function fetchAgents() {
    try {
      const { data } = await api.get('/agents')
      agents.value = data
    } catch (err) {
      console.error('❌ Fetch agents:', err.message)
    }
  }

  async function createAgent(payload) {
    const { data } = await api.post('/agents', payload)
    agents.value.push(data)
    return data
  }

  async function updateAgent(id, payload) {
    const { data } = await api.patch(`/agents/${id}`, payload)
    const idx = agents.value.findIndex(a => a.id === id)
    if (idx !== -1) agents.value[idx] = data
    return data
  }

  async function deleteAgent(id) {
    await api.delete(`/agents/${id}`)
    agents.value = agents.value.filter(a => a.id !== id)
  }

  // ─── Actions Hangar ───────────────────────────────────────────────────────

  async function fetchHangar() {
    try {
      const { data } = await api.get('/hangar')
      hangar.value = data
    } catch (err) {
      console.error('❌ Fetch hangar:', err.message)
    }
  }

  async function createHangarItem(payload) {
    const { data } = await api.post('/hangar', payload)
    hangar.value.unshift(data)
    return data
  }

  async function updateHangarItem(id, payload) {
    const { data } = await api.patch(`/hangar/${id}`, payload)
    const idx = hangar.value.findIndex(h => h.id === id)
    if (idx !== -1) hangar.value[idx] = data
    return data
  }

  async function deleteHangarItem(id) {
    await api.delete(`/hangar/${id}`)
    hangar.value = hangar.value.filter(h => h.id !== id)
  }

  async function transformerEnMission(id, payload = {}) {
    const { data } = await api.post(`/hangar/${id}/transformer-mission`, payload)
    // Mettre à jour le hangar item
    const idx = hangar.value.findIndex(h => h.id === id)
    if (idx !== -1) hangar.value[idx] = data.hangar
    // Ajouter la mission créée
    missions.value.unshift(data.mission)
    return data
  }

  // ─── WebSocket ────────────────────────────────────────────────────────────

  function connectWebSocket() {
    const wsUrl = `ws://${window.location.hostname}:3717/ws`
    
    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      console.log('🔌 WebSocket connecté')
      connected.value = true
    }

    ws.value.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data)
        handleWsEvent(type, data)
      } catch (err) {
        console.error('❌ WS message invalide:', err)
      }
    }

    ws.value.onclose = () => {
      console.log('🔌 WebSocket déconnecté — reconnexion dans 3s')
      connected.value = false
      // Reconnexion automatique
      setTimeout(connectWebSocket, 3000)
    }

    ws.value.onerror = (err) => {
      console.error('❌ WebSocket erreur:', err)
    }
  }

  /**
   * Traite les événements WebSocket entrants
   */
  function handleWsEvent(type, data) {
    switch (type) {
      case 'mission:update': {
        const idx = missions.value.findIndex(m => m.id === data.id)
        if (idx !== -1) {
          missions.value[idx] = { ...missions.value[idx], ...data }
        } else {
          missions.value.unshift(data)
        }
        break
      }

      case 'agent:status': {
        const idx = agents.value.findIndex(a => a.id === data.id)
        if (idx !== -1) {
          agents.value[idx] = { ...agents.value[idx], ...data }
        } else {
          agents.value.push(data)
        }
        break
      }

      case 'hangar:update': {
        const idx = hangar.value.findIndex(h => h.id === data.id)
        if (idx !== -1) {
          hangar.value[idx] = { ...hangar.value[idx], ...data }
        } else {
          hangar.value.unshift(data)
        }
        break
      }

      case 'agent:log': {
        // Stocker dans logsMap ET diffuser via event custom pour rétrocompat
        if (data && data.mission_id) {
          addMissionLog(data.mission_id, { ...data, timestamp: Date.now() })
        }
        window.dispatchEvent(new CustomEvent('passerelle:log', { detail: data }))
        break
      }

      case 'intervention:new': {
        // Mettre à jour la mission
        const idx = missions.value.findIndex(m => m.id === data.id)
        if (idx !== -1) missions.value[idx] = { ...missions.value[idx], ...data }
        // Notification navigateur
        if (Notification.permission === 'granted') {
          new Notification('🚨 La Passerelle', {
            body: `Intervention requise : ${data.titre}`,
          })
        }
        break
      }

      default:
        // console.log('WS event non géré:', type)
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    loading.value = true
    await Promise.all([fetchMissions(), fetchAgents(), fetchHangar()])
    loading.value = false
    connectWebSocket()
  }

  return {
    // État
    missions, agents, hangar, loading, connected, logsMap,
    // Getters
    missionsByStatut, agentsActifs, interventionsCount, hangarEnAttente,
    // Logs
    missionLogs, addMissionLog,
    // Actions missions
    fetchMissions, getMission, createMission, updateMission, deleteMission, sendMessage, lancerMission,
    // Actions agents
    fetchAgents, createAgent, updateAgent, deleteAgent,
    // Actions hangar
    fetchHangar, createHangarItem, updateHangarItem, deleteHangarItem, transformerEnMission,
    // WebSocket
    connectWebSocket, init,
  }
})
