<template>
  <!-- MissionPanel — Panel latéral slide-in pour le détail d'une mission -->

  <!-- Overlay sombre -->
  <Transition name="overlay-fade">
    <div
      v-if="mission"
      class="fixed inset-0 bg-black/40 z-40"
      @click="$emit('close')"
    ></div>
  </Transition>

  <!-- Panel latéral -->
  <Transition name="panel-slide">
    <aside
      v-if="mission"
      class="fixed right-0 top-0 h-full w-[420px] max-w-full bg-space-bg border-l border-space-border z-50 flex flex-col shadow-2xl"
    >
      <!-- Header -->
      <div class="px-4 py-3 border-b border-space-border flex items-start gap-3 flex-shrink-0">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-[10px] font-mono text-space-dim uppercase tracking-widest">#{{ mission.id }}</span>
            <span
              class="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wide"
              :class="statutBadgeClass"
            >{{ statutLabel }}</span>
          </div>
          <h2 class="text-sm font-mono font-semibold text-space-text leading-snug">{{ mission.titre }}</h2>
          <div v-if="mission.agent_nom" class="mt-1 text-[10px] font-mono text-space-muted">
            ⚡ {{ mission.agent_nom }}
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-space-muted hover:text-space-text hover:bg-space-panel transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      <!-- Description -->
      <div v-if="mission.description" class="px-4 py-2.5 border-b border-space-border flex-shrink-0">
        <p class="text-xs font-mono text-space-muted leading-relaxed">{{ mission.description }}</p>
      </div>

      <!-- Logs temps réel -->
      <div class="flex-1 overflow-y-auto p-3 space-y-1" ref="logContainer">
        <div class="text-[10px] font-mono text-space-dim uppercase tracking-widest mb-2 flex items-center gap-2">
          <span>📟 Logs</span>
          <span v-if="logs.length > 0" class="text-space-success">{{ logs.length }} entrées</span>
        </div>

        <div v-if="logs.length === 0" class="text-center text-space-dim text-xs font-mono py-6">
          <div v-if="mission.statut === 'hangar'">Mission en stand-by — pas encore lancée</div>
          <div v-else-if="mission.statut === 'terminee'">Mission terminée — logs archivés</div>
          <div v-else>En attente de logs...</div>
        </div>

        <div
          v-for="(log, idx) in logs"
          :key="idx"
          class="text-[11px] font-mono leading-relaxed"
          :class="logLineClass(log)"
        >
          <span class="text-space-dim">{{ formatTs(log.timestamp) }}</span>
          <span class="ml-2">{{ logIcon(log) }}</span>
          <span class="ml-1">{{ logText(log) }}</span>
        </div>

        <div ref="logAnchor"></div>
      </div>

      <!-- Zone d'action bas de panel -->
      <div class="border-t border-space-border p-3 flex-shrink-0 space-y-2">

        <!-- HANGAR : bouton lancer -->
        <button
          v-if="mission.statut === 'hangar'"
          @click="handleLancer"
          :disabled="launching"
          class="w-full py-2.5 rounded-xl bg-space-blue text-white text-sm font-mono font-semibold hover:bg-space-blue/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <span>🚀</span>
          <span>{{ launching ? 'Lancement...' : 'Lancer maintenant' }}</span>
        </button>

        <!-- INTERVENTION : champ réponse -->
        <div v-else-if="mission.statut === 'intervention'" class="space-y-2">
          <div class="text-[10px] font-mono text-space-danger flex items-center gap-1.5">
            <span class="animate-pulse">⚠️</span>
            <span>L'agent attend votre réponse</span>
          </div>
          <form @submit.prevent="handleReply" class="flex gap-2">
            <input
              v-model="replyText"
              type="text"
              placeholder="Votre réponse à l'agent..."
              class="flex-1 bg-space-panel border border-space-danger/40 rounded-xl px-3 py-2 text-sm font-mono text-space-text placeholder-space-dim focus:outline-none focus:border-space-danger/70 transition-colors"
            />
            <button
              type="submit"
              :disabled="!replyText.trim() || sending"
              class="flex-shrink-0 px-4 py-2 rounded-xl bg-space-danger text-white text-sm font-mono hover:bg-space-danger/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              →
            </button>
          </form>
        </div>

        <!-- Footer info -->
        <div class="flex items-center justify-between text-[10px] font-mono text-space-dim">
          <span>Créée {{ formatDate(mission.created_at) }}</span>
          <span v-if="mission.completed_at">· Terminée {{ formatDate(mission.completed_at) }}</span>
        </div>
      </div>
    </aside>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { usePasserelleStore } from '../stores/passerelle'
import { useChatStore } from '../stores/chat'

const props = defineProps({
  mission: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const store = usePasserelleStore()
const chatStore = useChatStore()

const logAnchor = ref(null)
const replyText = ref('')
const launching = ref(false)
const sending   = ref(false)

// ─── Logs réactifs via le store ───────────────────────────────────────────────
const logs = computed(() => {
  if (!props.mission) return []
  return store.missionLogs(props.mission.id)
})

// Auto-scroll log
watch(() => logs.value.length, async () => {
  await nextTick()
  logAnchor.value?.scrollIntoView({ behavior: 'smooth' })
})

// ─── Statut badge ─────────────────────────────────────────────────────────────
const STATUT_CONFIG = {
  hangar:       { label: 'Stand-by',   class: 'bg-space-muted/10 text-space-muted border border-space-muted/20' },
  en_cours:     { label: 'En cours',   class: 'bg-space-success/10 text-space-success border border-space-success/20' },
  intervention: { label: 'Intervention', class: 'bg-space-danger/10 text-space-danger border border-space-danger/30' },
  terminee:     { label: 'Terminée',   class: 'bg-space-blue/10 text-space-blue border border-space-blue/20' },
  abandonnee:   { label: 'Abandonnée', class: 'bg-space-muted/10 text-space-muted border border-space-muted/20' },
  refinement:   { label: 'Refinement', class: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
}

const statutLabel = computed(() => STATUT_CONFIG[props.mission?.statut]?.label || props.mission?.statut || '')
const statutBadgeClass = computed(() => STATUT_CONFIG[props.mission?.statut]?.class || '')

// ─── Formatage logs ───────────────────────────────────────────────────────────
function logIcon(log) {
  if (log.type === 'tool_use') return '🔧'
  if (log.type === 'tool_result') return '✅'
  if (log.type === 'error') return '❌'
  if (log.type === 'notification') return '📢'
  return '›'
}

function logText(log) {
  if (log.message) return log.message
  if (log.tool_name) return `${log.tool_name}${log.tool_input ? ': ' + JSON.stringify(log.tool_input).slice(0, 80) : ''}`
  return JSON.stringify(log).slice(0, 120)
}

function logLineClass(log) {
  if (log.type === 'error') return 'text-space-danger'
  if (log.type === 'tool_use') return 'text-space-blue'
  if (log.type === 'notification') return 'text-yellow-400'
  return 'text-space-muted'
}

function formatTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function handleLancer() {
  if (!props.mission || launching.value) return
  launching.value = true
  try {
    await store.lancerMission(props.mission.id)
    chatStore.addAssistantMessage(`🚀 Mission "${props.mission.titre}" lancée !`)
    emit('close')
  } catch (err) {
    console.error('❌ Lancer mission:', err.message)
  } finally {
    launching.value = false
  }
}

async function handleReply() {
  if (!replyText.value.trim() || !props.mission || sending.value) return
  sending.value = true
  try {
    await store.sendMessage(props.mission.id, replyText.value.trim())
    replyText.value = ''
  } catch (err) {
    console.error('❌ Reply to agent:', err.message)
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
/* Slide-in depuis la droite */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.25s ease;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(100%);
}

/* Fade overlay */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.2s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
</style>
