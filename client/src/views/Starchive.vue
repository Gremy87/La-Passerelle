<template>
  <!-- Starchives — Toutes les missions terminées ou abandonnées, searchable -->
  <div class="h-[calc(100vh-48px)] flex flex-col">

    <!-- En-tête — bordure left amber style LCARS -->
    <div class="px-4 py-3 border-b border-space-border flex items-center justify-between bg-space-panel" style="border-left: 4px solid #f59e0b;">
      <div class="flex items-center gap-3">
        <router-link to="/" class="text-space-muted hover:text-space-cyan transition-colors text-xs font-mono">
          ← Salle des Opérations
        </router-link>
        <span class="text-space-border">·</span>
        <div class="flex items-center gap-2">
          <span class="text-space-amber">📁</span>
          <span class="font-display text-xs font-semibold text-space-text uppercase tracking-wider">STARCHIVE</span>
        </div>
      </div>
      <div class="text-[10px] font-mono text-space-muted">
        {{ filteredMissions.length }} mission{{ filteredMissions.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Barre de recherche -->
    <div class="px-4 py-3 border-b border-space-border bg-space-panel/50">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-space-muted text-xs">🔍</span>
        <input
          v-model="query"
          type="text"
          placeholder="Rechercher dans les Starchives..."
          class="w-full bg-space-bg border border-space-border pl-8 pr-4 py-2 text-sm font-mono text-space-text placeholder-space-dim focus:outline-none focus:border-space-amber/50 focus:shadow-[0_0_12px_rgba(245,158,11,0.1)] transition-all rounded-lg"
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
        <span v-else>Les Starchives est vide — aucune mission terminée</span>
      </div>

      <!-- Liste -->
      <table v-else class="w-full text-sm font-mono">
        <thead class="sticky top-0 bg-space-bg border-b border-space-border">
          <tr>
            <th class="px-4 py-2.5 text-left text-[10px] font-display text-space-muted font-normal uppercase tracking-wider w-12">#</th>
            <th class="px-4 py-2.5 text-left text-[10px] font-display text-space-muted font-normal uppercase tracking-wider">Mission</th>
            <th class="px-4 py-2.5 text-left text-[10px] font-display text-space-muted font-normal uppercase tracking-wider w-32">Statut</th>
            <th class="px-4 py-2.5 text-left text-[10px] font-display text-space-muted font-normal uppercase tracking-wider w-36">Date</th>
            <th class="px-4 py-2.5 text-left text-[10px] font-display text-space-muted font-normal uppercase tracking-wider w-28">Durée</th>
            <th class="px-4 py-2.5 text-left text-[10px] font-display text-space-muted font-normal uppercase tracking-wider w-32">Agent</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(mission, idx) in filteredMissions"
            :key="mission.id"
            class="border-b border-space-border/40 cursor-pointer transition-colors"
            :class="idx % 2 === 0 ? 'bg-transparent hover:bg-space-panel/40' : 'bg-space-panel/20 hover:bg-space-panel/60'"
            @click="$router.push(`/mission/${mission.id}`)"
          >
            <td class="px-4 py-3 text-space-dim font-mono text-xs">{{ mission.id }}</td>
            <td class="px-4 py-3">
              <div class="text-space-text font-body text-sm truncate max-w-xs">{{ mission.titre }}</div>
              <div v-if="mission.description" class="text-space-dim text-[11px] font-mono truncate max-w-xs mt-0.5">
                {{ mission.description }}
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 border"
                :class="mission.statut === 'terminee'
                  ? 'text-space-success border-space-success/30 bg-space-success/10'
                  : 'text-space-muted border-space-border bg-space-panel'"
                style="clip-path: polygon(6px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 6px);"
              >
                {{ mission.statut === 'terminee' ? '✅ Terminée' : '❌ Abandonnée' }}
              </span>
            </td>
            <td class="px-4 py-3 text-space-muted text-xs font-mono">
              {{ formatDate(mission.completed_at || mission.updated_at) }}
            </td>
            <td class="px-4 py-3 text-space-muted text-xs font-mono">
              {{ formatDuration(mission.created_at, mission.completed_at || mission.updated_at) }}
            </td>
            <td class="px-4 py-3">
              <span v-if="mission.agent_nom" class="text-space-cyan text-xs font-mono">{{ mission.agent_nom }}</span>
              <span v-else class="text-space-dim text-xs font-mono">—</span>
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
