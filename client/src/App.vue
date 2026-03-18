<template>
  <!-- Fond principal de La Passerelle -->
  <div class="min-h-screen bg-space-bg text-space-text font-body">
    <!-- Barre de navigation globale — style LCARS -->
    <nav class="border-b border-space-cyan/30 bg-space-panel/90 backdrop-blur sticky top-0 z-50">
      <div class="px-4 h-12 flex items-center justify-between">
        <!-- Logo + titre -->
        <router-link to="/" class="flex items-center gap-3 text-space-text hover:text-space-cyan transition-colors">
          <span class="text-space-cyan font-mono font-bold text-lg">⚡</span>
          <div class="flex flex-col leading-none">
            <span class="font-display text-xs font-semibold tracking-wider text-space-text uppercase">CENTRE DE COMMANDEMENT</span>
            <span class="font-mono text-[10px] text-space-muted tracking-wide">La Passerelle</span>
          </div>
        </router-link>

        <!-- Indicateurs globaux -->
        <div class="flex items-center gap-4">
          <!-- Badge interventions urgentes -->
          <div v-if="store.interventionsCount > 0"
               class="flex items-center gap-1.5 px-3 py-1 bg-space-orange/20 border border-space-orange/40 text-space-orange text-xs font-mono animate-pulse lcars-btn">
            <span>🚨</span>
            <span>{{ store.interventionsCount }} intervention{{ store.interventionsCount > 1 ? 's' : '' }}</span>
          </div>

          <!-- Statut WebSocket -->
          <div class="flex items-center gap-1.5 text-xs font-mono" :class="store.connected ? 'text-space-cyan' : 'text-space-muted'">
            <span
              class="w-2 h-2 rounded-full inline-block"
              :class="store.connected ? 'bg-space-cyan animate-pulse' : 'bg-space-muted'"
            ></span>
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
