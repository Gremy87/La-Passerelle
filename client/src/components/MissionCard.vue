<template>
  <!-- MissionCard — Version compacte pour le panneau de supervision -->

  <!-- EN COURS -->
  <div v-if="mode === 'en_cours'" class="mission-card-item group cursor-pointer" @click="$emit('select', mission)">
    <div class="flex items-center gap-2">
      <!-- Dot animé vert -->
      <span class="relative flex-shrink-0">
        <span class="dot-pulse"></span>
      </span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-mono text-space-text truncate">{{ mission.titre }}</div>
      </div>
    </div>
    <!-- Progression sémantique -->
    <div class="mt-1.5 text-[10px] font-mono text-space-muted truncate">
      {{ progressionLabel }}
    </div>
    <!-- Agent si assigné -->
    <div v-if="mission.agent_nom" class="mt-1 text-[10px] font-mono text-space-dim truncate">
      ⚡ {{ mission.agent_nom }}
    </div>
  </div>

  <!-- STAND-BY (hangar/refinement) -->
  <div
    v-else-if="mode === 'stanby'"
    class="mission-card-item flex items-center gap-2 group cursor-pointer"
    @click="$emit('select', mission)"
  >
    <span class="text-space-muted flex-shrink-0">□</span>
    <div class="flex-1 min-w-0">
      <div class="text-xs font-mono text-space-text truncate">{{ mission.titre }}</div>
    </div>
    <button
      @click.stop="$emit('launch', mission)"
      class="flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-space-blue/10 text-space-blue border border-space-blue/20 hover:bg-space-blue/20 transition-colors opacity-0 group-hover:opacity-100"
    >
      ▶ Lancer
    </button>
  </div>

  <!-- INTERVENTION REQUISE -->
  <div v-else-if="mode === 'intervention'" class="mission-card-item border-space-danger/30 group cursor-pointer" @click="$emit('select', mission)">
    <div class="flex items-center gap-2">
      <span class="text-space-danger flex-shrink-0 animate-ping-slow">⚠️</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-mono text-space-danger truncate font-medium">{{ mission.titre }}</div>
      </div>
    </div>
    <div class="mt-1.5 flex gap-1.5">
      <router-link
        :to="`/mission/${mission.id}`"
        class="flex-1 text-center text-[10px] font-mono px-2 py-1 rounded bg-space-danger/10 text-space-danger border border-space-danger/30 hover:bg-space-danger/20 transition-colors"
      >
        Répondre
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePasserelleStore } from '../stores/passerelle'

const props = defineProps({
  mission: { type: Object, required: true },
  mode:    { type: String, default: 'stanby' }, // 'en_cours' | 'stanby' | 'intervention'
})

defineEmits(['launch', 'select'])

const store = usePasserelleStore()

// État sémantique du dernier log
function getSemanticState(logs) {
  if (!logs || logs.length === 0) return '⏳ En attente'
  const last = logs[logs.length - 1]
  const type = last.type || ''
  const contenu = last.contenu || last.content || ''
  if (type === 'tool_use') {
    if (/Read|Glob|Grep/i.test(contenu)) return '🔍 Exploration'
    if (/Edit|Write/i.test(contenu)) return '✏️ Écriture'
    if (/Bash/i.test(contenu)) return '⚙️ Exécution'
    return '⚙️ Exécution'
  }
  if (type === 'texte') return '💬 Réflexion'
  return '⏳ En attente'
}

// Temps écoulé depuis created_at
function tempsEcoule(createdAt) {
  if (!createdAt) return ''
  const diff = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1min'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  return `${hours}h${mins % 60}min`
}

const progressionLabel = computed(() => {
  const logs = store.missionLogs(props.mission.id)
  const etat = getSemanticState(logs)
  const actions = logs.length
  const temps = tempsEcoule(props.mission.created_at)
  return `${etat} · ${actions} actions · ${temps}`
})
</script>

<style scoped>
.mission-card-item {
  @apply p-2.5 rounded-lg border border-space-border bg-space-panel/50 hover:border-space-blue/30 transition-colors cursor-default;
}

.dot-pulse {
  @apply block w-2 h-2 rounded-full bg-space-success;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse-ring 1.5s ease-out infinite;
}

@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70%  { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
</style>
