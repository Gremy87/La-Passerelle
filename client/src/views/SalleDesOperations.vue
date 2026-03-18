<template>
  <!-- Salle des Opérations — Layout 2 colonnes : chat (70%) + supervision (30%) -->
  <div class="h-[calc(100vh-48px)] flex">

    <!-- ── Colonne gauche : Chat central (70%) ─────────────────────────────── -->
    <div class="flex-1 flex flex-col border-r border-space-border" style="width: 70%">

      <!-- Header chat -->
      <div class="px-4 py-2.5 border-b border-space-border flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-space-blue">💬</span>
          <span class="text-sm font-mono font-semibold text-space-text tracking-wide">LA PASSERELLE</span>
        </div>
        <div class="flex items-center gap-3 text-xs font-mono text-space-muted">
          <span v-if="store.connected" class="flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-space-success inline-block"></span>
            En ligne
          </span>
          <span v-else class="flex items-center gap-1 text-space-danger">
            <span class="w-1.5 h-1.5 rounded-full bg-space-danger inline-block"></span>
            Hors ligne
          </span>
          <span>{{ store.missions.length }} missions</span>
        </div>
      </div>

      <!-- Zone de messages (ChatWindow) -->
      <ChatWindow
        :messages="chatStore.messages"
        :loading="chatStore.loading"
        @action="handleAction"
        class="flex-1 min-h-0"
      />

      <!-- Input en bas -->
      <div class="px-4 py-3 border-t border-space-border flex-shrink-0">
        <form @submit.prevent="handleSend" class="flex gap-2 items-end">
          <textarea
            v-model="inputText"
            @keydown.enter.exact.prevent="handleSend"
            @keydown.enter.shift.exact="() => {}"
            rows="1"
            placeholder="Décris ta prochaine mission..."
            class="flex-1 bg-space-panel border border-space-border rounded-xl px-4 py-2.5 text-sm font-mono text-space-text placeholder-space-dim focus:outline-none focus:border-space-blue/60 transition-colors resize-none leading-relaxed"
            style="max-height: 120px; overflow-y: auto;"
            @input="autoResize"
            ref="textarea"
          ></textarea>
          <button
            type="submit"
            :disabled="!inputText.trim() || chatStore.loading"
            class="flex-shrink-0 w-10 h-10 rounded-xl bg-space-blue text-white flex items-center justify-center hover:bg-space-blue/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <span class="text-sm">→</span>
          </button>
        </form>
        <div class="mt-1 text-[10px] font-mono text-space-dim">
          Entrée pour envoyer · Shift+Entrée pour nouvelle ligne
        </div>
      </div>
    </div>

    <!-- ── Colonne droite : Panneau de supervision (30%) ───────────────────── -->
    <div class="flex flex-col overflow-hidden bg-space-bg" style="width: 30%; min-width: 240px; max-width: 380px;">

      <!-- Section EN COURS -->
      <div class="flex-shrink-0">
        <div class="px-3 py-2 border-b border-space-border flex items-center gap-2">
          <span class="text-space-success text-xs">📡</span>
          <span class="text-xs font-mono text-space-muted uppercase tracking-widest">EN COURS</span>
          <span class="ml-auto text-xs font-mono text-space-success">{{ missionEnCours.length }}</span>
        </div>
        <div class="p-2 space-y-1.5 max-h-48 overflow-y-auto">
          <MissionCard
            v-for="m in missionEnCours"
            :key="m.id"
            :mission="m"
            mode="en_cours"
            @select="handleSelect"
          />
          <div v-if="missionEnCours.length === 0" class="text-center text-space-dim text-xs font-mono py-3">
            Aucune mission active
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-space-border flex-shrink-0"></div>

      <!-- Section STAND-BY -->
      <div class="flex-shrink-0">
        <div class="px-3 py-2 border-b border-space-border flex items-center gap-2">
          <span class="text-xs">⏸️</span>
          <span class="text-xs font-mono text-space-muted uppercase tracking-widest">STAND-BY</span>
          <span class="ml-auto text-xs font-mono text-space-muted">{{ missionStandBy.length }}</span>
        </div>
        <div class="p-2 space-y-1.5 max-h-48 overflow-y-auto">
          <MissionCard
            v-for="m in missionStandBy"
            :key="m.id"
            :mission="m"
            mode="stanby"
            @launch="handleLaunch"
            @select="handleSelect"
          />
          <div v-if="missionStandBy.length === 0" class="text-center text-space-dim text-xs font-mono py-3">
            Aucune mission en attente
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-space-border flex-shrink-0"></div>

      <!-- Section INTERVENTION REQUISE -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div
          class="px-3 py-2 border-b border-space-border flex items-center gap-2 flex-shrink-0"
          :class="missionIntervention.length > 0 ? 'bg-space-danger/5' : ''"
        >
          <span class="text-xs">🚨</span>
          <span class="text-xs font-mono uppercase tracking-widest"
                :class="missionIntervention.length > 0 ? 'text-space-danger' : 'text-space-muted'">
            INTERVENTION
          </span>
          <span
            class="ml-auto text-xs font-mono"
            :class="missionIntervention.length > 0 ? 'text-space-danger font-bold' : 'text-space-muted'"
          >
            {{ missionIntervention.length }}
          </span>
        </div>
        <div class="p-2 space-y-1.5 flex-1 overflow-y-auto">
          <MissionCard
            v-for="m in missionIntervention"
            :key="m.id"
            :mission="m"
            mode="intervention"
            @select="handleSelect"
          />
          <div v-if="missionIntervention.length === 0" class="text-center text-space-dim text-xs font-mono py-3">
            Tout roule ✓
          </div>
        </div>
      </div>

      <!-- Footer : bouton Starchive + version -->
      <div class="border-t border-space-border flex-shrink-0 p-3 space-y-2">
        <router-link
          to="/starchive"
          class="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-space-border text-xs font-mono text-space-muted hover:text-space-text hover:border-space-blue/40 transition-colors"
        >
          <span>📁</span>
          <span>Starchives</span>
          <span class="ml-auto text-space-dim">{{ missionArchivees.length }}</span>
        </router-link>
        <div class="text-center text-[10px] font-mono text-space-dim opacity-50">v0.7</div>
      </div>

    </div>
  </div>

  <!-- Panel latéral mission -->
  <MissionPanel
    :mission="selectedMission"
    @close="selectedMission = null"
  />
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { usePasserelleStore } from '../stores/passerelle'
import { useChatStore } from '../stores/chat'
import ChatWindow from '../components/ChatWindow.vue'
import MissionCard from '../components/MissionCard.vue'
import MissionPanel from '../components/MissionPanel.vue'

const store = usePasserelleStore()
const chatStore = useChatStore()

const inputText = ref('')
const textarea = ref(null)
const selectedMission = ref(null)

function handleSelect(mission) {
  console.log('[Passerelle] Mission sélectionnée:', mission)
  selectedMission.value = mission
}

// Sections du panneau de supervision
const missionEnCours     = computed(() => store.missionsByStatut.en_cours)
const missionStandBy     = computed(() => [
  ...store.missionsByStatut.hangar,
  ...store.missionsByStatut.refinement,
])
const missionIntervention = computed(() => store.missionsByStatut.intervention)
const missionArchivees   = computed(() => [
  ...store.missionsByStatut.terminee,
  ...store.missionsByStatut.abandonnee,
])

// Envoi du message
async function handleSend() {
  const text = inputText.value.trim()
  if (!text || chatStore.loading) return
  inputText.value = ''
  await nextTick()
  if (textarea.value) {
    textarea.value.style.height = 'auto'
  }
  await chatStore.sendMessage(text)
}

// Auto-resize du textarea
function autoResize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

// Gestion des boutons d'action dans les messages (délégué au store)
async function handleAction(action, msg) {
  await chatStore.handleAction(action, msg)
}

// Lancement rapide depuis le panneau
async function handleLaunch(mission) {
  try {
    await store.lancerMission(mission.id)
    chatStore.addAssistantMessage(`🚀 Mission "${mission.titre}" lancée depuis le hangar !`)
  } catch (e) {
    chatStore.addAssistantMessage('❌ Erreur au lancement.')
  }
}
</script>
