<template>
  <!-- Stream de logs temps réel — style terminal -->
  <div ref="containerRef" class="flex-1 overflow-y-auto p-4 font-mono text-xs bg-space-bg">
    <!-- Message si vide -->
    <div v-if="messages.length === 0" class="text-space-muted text-center py-8">
      En attente de données...
    </div>

    <!-- Lignes de log -->
    <div v-for="(msg, i) in messages" :key="msg.id || i" class="log-line" :class="`log-line-${msg.type || 'info'}`">
      <!-- Timestamp -->
      <span class="text-space-dim shrink-0">{{ formatTime(msg.created_at) }}</span>

      <!-- Icône selon le type -->
      <span class="shrink-0">{{ TYPE_ICONS[msg.role] || '·' }}</span>

      <!-- Contenu -->
      <span class="break-all">
        <!-- Tool use : affichage spécial -->
        <template v-if="msg.type === 'tool_use'">
          <ToolUseLine :contenu="msg.contenu" />
        </template>
        <!-- Message texte normal -->
        <template v-else>
          {{ msg.contenu }}
        </template>
      </span>
    </div>

    <!-- Curseur clignotant si mission en cours -->
    <div v-if="enCours" class="text-space-blue text-xs font-mono mt-1">
      <span class="animate-pulse">█</span>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import ToolUseLine from './ToolUseLine.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  enCours:  { type: Boolean, default: false },
})

const containerRef = ref(null)

const TYPE_ICONS = {
  agent:   '🤖',
  amiral:  '⚓',
  systeme: '⚙️',
}

function formatTime(d) {
  if (!d) return '--:--:--'
  const iso = d.includes('T') || d.includes('Z') ? d : d.replace(' ', 'T') + 'Z'
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function scrollToBottom() {
  if (containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight
  }
}

// Scroll auto quand de nouveaux messages arrivent
watch(() => props.messages.length, async () => {
  await nextTick()
  scrollToBottom()
})

// Exposer scrollToBottom pour le parent
defineExpose({ scrollToBottom })
</script>
