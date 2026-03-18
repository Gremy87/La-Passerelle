<template>
  <!-- Carte de statut d'un agent de l'Escadron -->
  <div class="card space-y-2" :class="agent.statut === 'intervention' ? 'border-space-danger/40' : ''">
    <!-- En-tête agent -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <!-- Point de statut animé -->
        <span class="status-dot" :class="agent.statut"></span>
        <span class="text-sm font-mono font-medium text-space-text">{{ agent.nom }}</span>
      </div>
      <!-- Badge statut -->
      <span class="text-xs font-mono px-2 py-0.5 rounded-full"
            :class="STATUT_CLASSES[agent.statut]">
        {{ STATUT_LABELS[agent.statut] }}
      </span>
    </div>

    <!-- Mission en cours -->
    <div v-if="agent.mission_titre" class="pl-4">
      <div class="text-xs font-mono text-space-muted mb-1">Mission en cours :</div>
      <router-link
        :to="`/mission/${agent.mission_id}`"
        class="text-xs font-mono text-space-cyan hover:text-space-blue truncate block transition-colors"
      >
        {{ agent.mission_titre }}
      </router-link>
    </div>

    <!-- Barre de "bouclier" (activité simulée basée sur last_seen) -->
    <div v-if="agent.statut === 'en_mission'" class="space-y-1">
      <div class="flex justify-between text-xs font-mono text-space-muted">
        <span>Activité</span>
        <span>{{ activiteLabel }}</span>
      </div>
      <div class="shield-bar">
        <div class="shield-bar-fill" :style="{ width: activitePct + '%' }"></div>
      </div>
    </div>

    <!-- Last seen -->
    <div v-if="agent.last_seen" class="text-xs font-mono text-space-dim">
      Actif {{ formatRelative(agent.last_seen) }}
    </div>

    <!-- Actions -->
    <div class="flex gap-1 pt-1">
      <button
        @click.prevent="supprimerAgent"
        class="text-xs font-mono text-space-muted hover:text-space-danger transition-colors"
      >
        Retirer
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePasserelleStore } from '../stores/passerelle'

const props = defineProps({
  agent: { type: Object, required: true },
})

const store = usePasserelleStore()

const STATUT_LABELS = {
  libre:        'Libre',
  en_mission:   'En mission',
  intervention: 'Intervention',
  hors_ligne:   'Hors ligne',
}

const STATUT_CLASSES = {
  libre:        'bg-space-muted/20 text-space-muted',
  en_mission:   'bg-space-blue/20 text-space-blue',
  intervention: 'bg-space-danger/20 text-space-danger',
  hors_ligne:   'bg-space-dim/20 text-space-dim',
}

// Calculer le % d'activité basé sur le last_seen (dernière activité < 5 min = 100%)
const activitePct = computed(() => {
  if (!props.agent.last_seen) return 0
  const diff = Date.now() - new Date(props.agent.last_seen).getTime()
  const mins = diff / 60000
  if (mins < 1)  return 100
  if (mins < 5)  return Math.round(100 - (mins * 15))
  return 10
})

const activiteLabel = computed(() => {
  if (activitePct.value > 80) return 'Active'
  if (activitePct.value > 40) return 'Ralentie'
  return 'Faible'
})

function formatRelative(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)    return 'à l\'instant'
  if (mins < 60)   return `il y a ${mins}m`
  if (mins < 1440) return `il y a ${Math.floor(mins / 60)}h`
  return `il y a ${Math.floor(mins / 1440)}j`
}

async function supprimerAgent() {
  if (!confirm(`Retirer l'agent "${props.agent.nom}" de l'Escadron ?`)) return
  await store.deleteAgent(props.agent.id)
}
</script>
