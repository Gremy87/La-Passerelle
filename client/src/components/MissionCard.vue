<template>
  <!-- MissionCard — Version compacte pour le panneau de supervision -->

  <!-- EN COURS -->
  <div v-if="mode === 'en_cours'"
    class="mission-card-en-cours group cursor-pointer"
    @click="$emit('select', mission)"
  >
    <div class="flex items-center gap-2">
      <!-- Dot animé cyan -->
      <span class="relative flex-shrink-0">
        <span class="dot-pulse-cyan"></span>
      </span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-body font-medium text-space-text truncate">{{ mission.titre }}</div>
      </div>
    </div>
    <!-- Progression sémantique -->
    <div class="mt-1.5 text-[10px] font-mono text-space-muted truncate">
      {{ progressionLabel }}
    </div>
    <!-- Agent si assigné -->
    <div v-if="mission.agent_nom" class="mt-1 text-[10px] font-mono text-space-cyan/70 truncate">
      ⚡ {{ mission.agent_nom }}
    </div>
  </div>

  <!-- STAND-BY (hangar/refinement) -->
  <div
    v-else-if="mode === 'stanby'"
    class="mission-card-stanby flex items-center gap-2 group cursor-pointer"
    @click="$emit('select', mission)"
  >
    <span class="text-space-amber/60 flex-shrink-0 text-xs">□</span>
    <div class="flex-1 min-w-0">
      <div class="text-xs font-body text-space-text truncate">{{ mission.titre }}</div>
    </div>
    <button
      @click.stop="$emit('launch', mission)"
      class="flex-shrink-0 text-[10px] font-mono px-2 py-0.5 bg-space-amber/10 text-space-amber border border-space-amber/30 hover:bg-space-amber/20 transition-colors opacity-0 group-hover:opacity-100 lcars-btn"
    >
      ▶ Lancer
    </button>
  </div>

  <!-- INTERVENTION REQUISE -->
  <div v-else-if="mode === 'intervention'"
    class="mission-card-intervention group cursor-pointer"
    @click="$emit('select', mission)"
  >
    <div class="flex items-center gap-2">
      <span class="text-space-orange flex-shrink-0 animate-ping-slow text-xs">⚠️</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-body text-space-orange truncate font-medium">{{ mission.titre }}</div>
      </div>
    </div>
    <div class="mt-1.5 flex gap-1.5">
      <router-link
        :to="`/mission/${mission.id}`"
        class="flex-1 text-center text-[10px] font-mono px-2 py-1 bg-space-orange/10 text-space-orange border border-space-orange/30 hover:bg-space-orange/20 transition-colors lcars-btn"
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
/* Card EN COURS — accent cyan */
.mission-card-en-cours {
  @apply p-2.5 border-l-[3px] border-space-cyan bg-space-cyan/5 hover:bg-space-cyan/10 transition-colors cursor-default;
  border-top: 1px solid theme('colors.space.border');
  border-right: 1px solid theme('colors.space.border');
  border-bottom: 1px solid theme('colors.space.border');
  border-radius: 0 4px 4px 0;
}

/* Card STAND-BY — accent amber */
.mission-card-stanby {
  @apply p-2.5 border-l-[3px] border-space-amber bg-space-amber/5 hover:bg-space-amber/10 transition-colors cursor-default;
  border-top: 1px solid theme('colors.space.border');
  border-right: 1px solid theme('colors.space.border');
  border-bottom: 1px solid theme('colors.space.border');
  border-radius: 0 4px 4px 0;
}

/* Card INTERVENTION — accent orange + pulse */
.mission-card-intervention {
  @apply p-2.5 border-l-[3px] bg-space-orange/5 hover:bg-space-orange/10 transition-colors cursor-default;
  border-color: #ea580c;
  border-top: 1px solid rgba(234, 88, 12, 0.3);
  border-right: 1px solid rgba(234, 88, 12, 0.3);
  border-bottom: 1px solid rgba(234, 88, 12, 0.3);
  border-radius: 0 4px 4px 0;
  animation: border-pulse 2s ease-in-out infinite;
}

/* Dot animé cyan (remplace le vert) */
.dot-pulse-cyan {
  @apply block w-2 h-2 rounded-full bg-space-cyan;
  box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.7);
  animation: pulse-ring-cyan 1.5s ease-out infinite;
}

@keyframes pulse-ring-cyan {
  0%   { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.7); }
  70%  { box-shadow: 0 0 0 6px rgba(6, 182, 212, 0); }
  100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
}

@keyframes border-pulse {
  0%, 100% { border-color: rgba(234, 88, 12, 0.4); }
  50%       { border-color: rgba(234, 88, 12, 0.9); }
}
</style>
