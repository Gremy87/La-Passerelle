<template>
  <!-- Starchive — Toutes les missions terminées ou abandonnées, searchable -->
  <div class="h-[calc(100vh-48px)] flex flex-col">

    <!-- En-tête -->
    <div class="px-4 py-3 border-b border-space-border flex items-center justify-between">
      <div class="flex items-center gap-2">
        <router-link to="/" class="text-space-muted hover:text-space-text transition-colors text-xs font-mono">
          ← Salle des Opérations
        </router-link>
        <span class="text-space-border">·</span>
        <div class="text-sm font-mono text-space-text font-semibold">📁 STARCHIVE</div>
      </div>
      <div class="text-xs font-mono text-space-muted">
        {{ filteredMissions.length }} mission{{ filteredMissions.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Barre de recherche -->
    <div class="px-4 py-3 border-b border-space-border">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-space-muted text-xs">🔍</span>
        <input
          v-model="query"
          type="text"
          placeholder="Rechercher dans la Starchive..."
          class="w-full bg-space-panel border border-space-border rounded-lg pl-8 pr-4 py-2 text-sm font-mono text-space-text placeholder-space-dim focus:outline-none focus:border-space-blue/50 transition-colors"
        />
        <button v-if="query" @click="query = ''" class="absolute right-3 top-1/2 -translate-y-1/2 text-space-muted hover:text-space-text text-xs">✕</button>
      </div>
    </div>

    <!-- Tableau des missions archivées -->
    <div class="flex-1 overflow-y-auto">

      <!-- État vide -->
      <div v-if="filteredMissions.length === 0" class="flex flex-col items-center justify-center h-full text-space-muted font-mono text-sm gap-2">
        <span class="text-3xl">📭</span>
        <span v-if="query">Aucune mission pour « {{ query }} »</span>
        <span v-else>La Starchive est vide — aucune mission terminée</span>
      </div>

      <!-- Liste -->
      <table v-else class="w-full text-sm font-mono">
        <thead class="sticky top-0 bg-space-bg border-b border-space-border">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs text-space-muted font-normal uppercase tracking-wider w-12">#</th>
            <th class="px-4 py-2.5 text-left text-xs text-space-muted font-normal uppercase tracking-wider">Mission</th>
            <th class="px-4 py-2.5 text-left text-xs text-space-muted font-normal uppercase tracking-wider w-32">Statut</th>
            <th class="px-4 py-2.5 text-left text-xs text-space-muted font-normal uppercase tracking-wider w-36">Date</th>
            <th class="px-4 py-2.5 text-left text-xs text-space-muted font-normal uppercase tracking-wider w-28">Durée</th>
            <th class="px-4 py-2.5 text-left text-xs text-space-muted font-normal uppercase tracking-wider w-32">Agent</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-space-border/50">
          <tr
            v-for="mission in filteredMissions"
            :key="mission.id"
            class="hover:bg-space-panel/30 transition-colors cursor-pointer"
            @click="$router.push(`/mission/${mission.id}`)"
          >
            <td class="px-4 py-3 text-space-dim">{{ mission.id }}</td>
            <td class="px-4 py-3">
              <div class="text-space-text truncate max-w-xs">{{ mission.titre }}</div>
              <div v-if="mission.description" class="text-space-dim text-[11px] truncate max-w-xs mt-0.5">
                {{ mission.description }}
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                :class="mission.statut === 'terminee'
                  ? 'text-space-success border-space-success/30 bg-space-success/10'
                  : 'text-space-muted border-space-border bg-space-panel'"
              >
                {{ mission.statut === 'terminee' ? '✅ Terminée' : '❌ Abandonnée' }}
              </span>
            </td>
            <td class="px-4 py-3 text-space-muted text-xs">
              {{ formatDate(mission.completed_at || mission.updated_at) }}
            </td>
            <td class="px-4 py-3 text-space-muted text-xs">
              {{ formatDuration(mission.created_at, mission.completed_at || mission.updated_at) }}
            </td>
            <td class="px-4 py-3">
              <span v-if="mission.agent_nom" class="text-space-cyan text-xs">{{ mission.agent_nom }}</span>
              <span v-else class="text-space-dim text-xs">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePasserelleStore } from '../stores/passerelle'

const store = usePasserelleStore()
const query = ref('')

// Missions terminées ou abandonnées, filtrées par la recherche
const filteredMissions = computed(() => {
  const archived = store.missions.filter(m =>
    m.statut === 'terminee' || m.statut === 'abandonnee'
  )
  if (!query.value.trim()) return archived
  const q = query.value.toLowerCase()
  return archived.filter(m =>
    m.titre?.toLowerCase().includes(q) ||
    m.description?.toLowerCase().includes(q) ||
    m.agent_nom?.toLowerCase().includes(q)
  )
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDuration(start, end) {
  if (!start || !end) return '—'
  const diff = new Date(end) - new Date(start)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h${mins % 60 ? (mins % 60) + 'm' : ''}`
  return `${Math.floor(mins / 1440)}j`
}

onMounted(() => {
  if (store.missions.length === 0) store.fetchMissions()
})
</script>
