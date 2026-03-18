<template>
  <!-- Fond principal de La Passerelle -->
  <div class="min-h-screen bg-space-bg text-space-text font-sans">
    <!-- Barre de navigation globale -->
    <nav class="border-b border-space-border bg-space-panel/80 backdrop-blur sticky top-0 z-50">
      <div class="px-4 h-12 flex items-center justify-between">
        <!-- Logo + titre -->
        <router-link to="/" class="flex items-center gap-2 text-space-text hover:text-space-blue transition-colors">
          <span class="text-space-blue font-mono font-bold text-lg">⚡</span>
          <span class="font-mono font-semibold tracking-wider">LA PASSERELLE</span>
        </router-link>

        <!-- Indicateurs globaux -->
        <div class="flex items-center gap-4">
          <!-- Badge interventions urgentes -->
          <div v-if="store.interventionsCount > 0"
               class="flex items-center gap-1.5 px-3 py-1 bg-space-danger/20 border border-space-danger/40 rounded-full text-space-danger text-xs font-mono animate-pulse">
            <span>🚨</span>
            <span>{{ store.interventionsCount }} intervention{{ store.interventionsCount > 1 ? 's' : '' }}</span>
          </div>

          <!-- Statut WebSocket -->
          <div class="flex items-center gap-1.5 text-xs font-mono" :class="store.connected ? 'text-space-success' : 'text-space-muted'">
            <span class="status-dot" :class="store.connected ? 'en_mission' : 'libre'"></span>
            <span>{{ store.connected ? 'En ligne' : 'Hors ligne' }}</span>
          </div>

          <!-- Bouton nouvelle mission -->
          <button @click="showNouvelleModal = true" class="btn-primary text-xs">
            + Nouvelle mission
          </button>
        </div>
      </div>
    </nav>

    <!-- Vue principale -->
    <router-view />

    <!-- Modal nouvelle mission -->
    <NouvelleMissionModal
      v-if="showNouvelleModal"
      @close="showNouvelleModal = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { usePasserelleStore } from './stores/passerelle'
import NouvelleMissionModal from './components/NouvelleMissionModal.vue'

const store = usePasserelleStore()
const showNouvelleModal = ref(false)

onMounted(() => {
  store.init()
  // Demander la permission pour les notifications
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
})
</script>
