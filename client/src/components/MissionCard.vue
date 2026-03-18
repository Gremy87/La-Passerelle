<template>
  <!-- Carte de mission — affichée dans les colonnes de la Salle des Opérations -->
  <router-link
    :to="`/mission/${mission.id}`"
    class="block card hover:border-space-blue/50 transition-all cursor-pointer group"
    :class="{
      'border-space-danger/40 hover:border-space-danger': urgent,
      'opacity-60 hover:opacity-80': compact,
      'p-2': compact,
    }"
  >
    <!-- En-tête de la carte -->
    <div class="flex items-start justify-between gap-2 mb-2">
      <div class="flex-1 min-w-0">
        <div class="text-xs font-mono text-space-muted mb-0.5">#{{ mission.id }}</div>
        <div class="text-sm font-mono font-medium text-space-text truncate group-hover:text-space-blue transition-colors">
          {{ mission.titre }}
        </div>
      </div>
      <span :class="`badge-${mission.statut}`">{{ STATUT_ICONS[mission.statut] }}</span>
    </div>

    <!-- Description (tronquée) si pas compact -->
    <p v-if="!compact && mission.description" class="text-xs text-space-muted line-clamp-2 mb-2 font-mono">
      {{ mission.description }}
    </p>

    <!-- Infos agent + progression -->
    <div v-if="!compact" class="space-y-1.5">
      <!-- Agent assigné -->
      <div v-if="mission.agent_nom" class="flex items-center gap-1.5 text-xs font-mono">
        <span class="status-dot" :class="mission.agent_statut || 'libre'"></span>
        <span class="text-space-cyan">{{ mission.agent_nom }}</span>
      </div>

      <!-- Repo -->
      <div v-if="mission.repo_path" class="text-xs font-mono text-space-dim truncate">
        {{ repoNom(mission.repo_path) }}
      </div>

      <!-- Date de mise à jour -->
      <div class="text-xs font-mono text-space-dim">
        {{ formatRelative(mission.updated_at) }}
      </div>
    </div>

    <!-- Indicateur urgent (intervention) -->
    <div v-if="urgent" class="mt-2 flex items-center gap-1 text-xs font-mono text-space-danger">
      <span class="animate-ping-slow">●</span>
      <span>En attente de l'Amiral</span>
    </div>
  </router-link>
</template>

<script setup>
const props = defineProps({
  mission: { type: Object, required: true },
  urgent:  { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})

const STATUT_ICONS = {
  hangar:       '📦',
  en_cours:     '🚀',
  intervention: '🚨',
  terminee:     '✅',
  abandonnee:   '❌',
  refinement:   '🔍',
}

function repoNom(path) {
  if (!path) return ''
  return path.split('/').pop() || path
}

function formatRelative(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)    return 'À l\'instant'
  if (mins < 60)   return `il y a ${mins}m`
  if (mins < 1440) return `il y a ${Math.floor(mins / 60)}h`
  return `il y a ${Math.floor(mins / 1440)}j`
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
