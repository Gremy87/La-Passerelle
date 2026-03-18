<template>
  <div class="min-h-[calc(100vh-48px)] flex flex-col">

    <!-- Barre de retour -->
    <div class="px-4 py-2 border-b border-space-border flex items-center gap-3">
      <router-link to="/" class="text-space-muted hover:text-space-text text-xs font-mono transition-colors">
        ← Salle des Opérations
      </router-link>
      <span class="text-space-dim">|</span>
      <span class="text-xs font-mono text-space-muted">Mission #{{ mission?.id }}</span>
    </div>

    <!-- Contenu principal -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-space-muted font-mono text-sm animate-pulse">Chargement...</div>
    </div>

    <div v-else-if="!mission" class="flex-1 flex items-center justify-center">
      <div class="text-space-danger font-mono text-sm">Mission introuvable</div>
    </div>

    <div v-else class="flex-1 flex overflow-hidden">

      <!-- Panneau gauche : infos mission -->
      <div class="w-80 border-r border-space-border flex flex-col overflow-hidden bg-space-panel">
        <div class="p-4 border-b border-space-border">
          <h1 class="text-space-text font-mono font-semibold text-sm mb-1">{{ mission.titre }}</h1>
          <div class="flex items-center gap-2 mb-3">
            <span :class="`badge-${mission.statut}`">{{ STATUT_LABELS[mission.statut] || mission.statut }}</span>
            <span class="text-xs text-space-muted font-mono">{{ mission.type }}</span>
          </div>
          <p class="text-space-muted text-xs leading-relaxed">{{ mission.description }}</p>
        </div>

        <!-- Infos techniques -->
        <div class="p-4 border-b border-space-border space-y-2">
          <div v-if="mission.agent_nom" class="flex items-center gap-2">
            <span class="text-space-muted text-xs font-mono w-20">Vaisseau :</span>
            <span class="text-space-cyan text-xs font-mono">{{ mission.agent_nom }}</span>
          </div>
          <div v-if="mission.repo_path" class="flex items-center gap-2">
            <span class="text-space-muted text-xs font-mono w-20">Repo :</span>
            <span class="text-space-text text-xs font-mono truncate">{{ mission.repo_path }}</span>
          </div>
          <div v-if="mission.worktree_path" class="flex items-center gap-2">
            <span class="text-space-muted text-xs font-mono w-20">Worktree :</span>
            <span class="text-space-text text-xs font-mono truncate">{{ mission.worktree_path }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-space-muted text-xs font-mono w-20">Créée :</span>
            <span class="text-space-muted text-xs font-mono">{{ formatDate(mission.created_at) }}</span>
          </div>
          <div v-if="mission.completed_at" class="flex items-center gap-2">
            <span class="text-space-muted text-xs font-mono w-20">Terminée :</span>
            <span class="text-space-success text-xs font-mono">{{ formatDate(mission.completed_at) }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-4 space-y-2">
          <button
            v-if="mission.statut === 'hangar'"
            @click="lancerMission"
            class="w-full btn-primary text-xs"
          >
            🚀 Lancer la mission
          </button>
          <button
            v-if="['en_cours', 'intervention'].includes(mission.statut)"
            @click="abandonnerMission"
            class="w-full btn-danger text-xs"
          >
            Abandonner
          </button>
          <button
            v-if="['hangar', 'terminee', 'abandonnee'].includes(mission.statut)"
            @click="supprimerMission"
            class="w-full btn-secondary text-xs"
          >
            Supprimer
          </button>
        </div>
      </div>

      <!-- Panneau droit : log temps réel -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- En-tête log -->
        <div class="px-4 py-2 border-b border-space-border flex items-center justify-between bg-space-panel">
          <span class="text-xs font-mono text-space-muted uppercase tracking-wider">Log de mission</span>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono text-space-muted">{{ messages.length }} entrée{{ messages.length !== 1 ? 's' : '' }}</span>
            <button @click="scrollToBottom" class="text-xs font-mono text-space-muted hover:text-space-text">↓</button>
          </div>
        </div>

        <!-- Stream de logs -->
        <LogStream :messages="messages" ref="logStreamRef" />

        <!-- Zone de réponse (si intervention requise) -->
        <div class="border-t border-space-border p-3 bg-space-panel">
          <form @submit.prevent="envoyerReponse" class="flex gap-2">
            <input
              v-model="reponse"
              type="text"
              placeholder="Envoyer un message à l'agent..."
              class="input flex-1"
              :disabled="mission.statut === 'terminee' || mission.statut === 'abandonnee'"
            />
            <button
              type="submit"
              class="btn-primary text-xs px-3"
              :disabled="!reponse.trim() || mission.statut === 'terminee'"
            >
              →
            </button>
          </form>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePasserelleStore } from '../stores/passerelle'
import LogStream from '../components/LogStream.vue'

const route   = useRoute()
const router  = useRouter()
const store   = usePasserelleStore()

const mission     = ref(null)
const messages    = ref([])
const loading     = ref(true)
const reponse     = ref('')
const logStreamRef = ref(null)

const STATUT_LABELS = {
  hangar:       '📦 Hangar',
  en_cours:     '🚀 En cours',
  intervention: '🚨 Intervention',
  terminee:     '✅ Terminée',
  abandonnee:   '❌ Abandonnée',
  refinement:   '🔍 Refinement',
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

async function chargerMission() {
  loading.value = true
  const data = await store.getMission(route.params.id)
  if (data) {
    mission.value = data
    messages.value = data.messages || []
  }
  loading.value = false
  await nextTick()
  scrollToBottom()
}

function scrollToBottom() {
  logStreamRef.value?.scrollToBottom()
}

async function lancerMission() {
  await store.updateMission(mission.value.id, { statut: 'en_cours' })
  mission.value.statut = 'en_cours'
}

async function abandonnerMission() {
  if (!confirm('Abandonner cette mission ?')) return
  await store.updateMission(mission.value.id, { statut: 'abandonnee' })
  mission.value.statut = 'abandonnee'
}

async function supprimerMission() {
  if (!confirm('Supprimer définitivement cette mission ?')) return
  await store.deleteMission(mission.value.id)
  router.push('/')
}

async function envoyerReponse() {
  if (!reponse.value.trim()) return
  const msg = await store.sendMessage(mission.value.id, reponse.value.trim())
  messages.value.push(msg)
  reponse.value = ''
  await nextTick()
  scrollToBottom()
}

// Écoute des logs en temps réel via l'event custom
function onLog(event) {
  const { missionId, message } = event.detail
  if (missionId == route.params.id) {
    messages.value.push(message)
    nextTick(scrollToBottom)
  }
}

onMounted(() => {
  chargerMission()
  window.addEventListener('passerelle:log', onLog)
})

onUnmounted(() => {
  window.removeEventListener('passerelle:log', onLog)
})
</script>
