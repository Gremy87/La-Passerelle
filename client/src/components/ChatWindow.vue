<template>
  <!-- ChatWindow — Zone de chat style LCARS Space Opera -->
  <div ref="scrollContainer" class="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">

    <!-- Messages -->
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="flex"
      :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
    >
      <!-- Avatar assistant -->
      <div v-if="msg.role === 'assistant'"
        class="flex-shrink-0 w-7 h-7 bg-space-panel border border-space-cyan/30 flex items-center justify-center text-xs mr-2 mt-1"
        style="clip-path: polygon(4px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 4px);"
      >
        🤖
      </div>

      <div class="max-w-[80%] flex flex-col" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
        <!-- Bulle de message -->
        <div
          class="px-4 py-2.5 text-sm font-mono leading-relaxed"
          :class="msg.role === 'user'
            ? 'bg-space-blue/20 border border-space-blue/40 text-space-text rounded-2xl rounded-br-sm'
            : 'bg-space-cyan/5 border border-space-cyan/20 text-space-text rounded-2xl rounded-bl-sm'"
        >
          {{ msg.text }}
        </div>

        <!-- Boutons d'action inline (pour les réponses avec choix) -->
        <div v-if="msg.actions && msg.actions.length > 0" class="mt-2 flex flex-col gap-1.5 w-full">
          <div class="bg-space-panel border border-space-border overflow-hidden"
            style="clip-path: polygon(8px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 8px);"
          >
            <button
              v-for="action in msg.actions"
              :key="action.id"
              @click="$emit('action', action, msg)"
              class="w-full px-4 py-2.5 text-left text-sm font-mono hover:bg-space-cyan/10 hover:text-space-cyan transition-colors flex items-center gap-2 border-b border-space-border/50 last:border-0"
            >
              <span>{{ action.icon }}</span>
              <span>{{ action.label }}</span>
            </button>
          </div>
        </div>

        <!-- Timestamp -->
        <div class="text-[9px] font-mono text-space-dim mt-1 px-1">
          {{ formatTime(msg.timestamp) }}
        </div>
      </div>

      <!-- Avatar user -->
      <div v-if="msg.role === 'user'"
        class="flex-shrink-0 w-7 h-7 bg-space-blue/20 border border-space-blue/30 flex items-center justify-center text-xs ml-2 mt-1"
        style="clip-path: polygon(4px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 4px);"
      >
        🧑
      </div>
    </div>

    <!-- Indicateur de chargement -->
    <div v-if="loading" class="flex justify-start">
      <div
        class="flex-shrink-0 w-7 h-7 bg-space-panel border border-space-cyan/30 flex items-center justify-center text-xs mr-2 mt-1"
        style="clip-path: polygon(4px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 4px);"
      >
        🤖
      </div>
      <div class="bg-space-cyan/5 border border-space-cyan/20 px-4 py-2.5 rounded-2xl rounded-bl-sm">
        <div class="flex gap-1.5 items-center h-4">
          <span class="w-1.5 h-1.5 rounded-full bg-space-cyan animate-bounce" style="animation-delay: 0ms"></span>
          <span class="w-1.5 h-1.5 rounded-full bg-space-cyan animate-bounce" style="animation-delay: 150ms"></span>
          <span class="w-1.5 h-1.5 rounded-full bg-space-cyan animate-bounce" style="animation-delay: 300ms"></span>
        </div>
      </div>
    </div>

    <!-- Ancre de scroll -->
    <div ref="scrollAnchor"></div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  messages: { type: Array, required: true },
  loading:  { type: Boolean, default: false },
})

defineEmits(['action'])

const scrollContainer = ref(null)
const scrollAnchor = ref(null)

// Auto-scroll vers le bas à chaque nouveau message
watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    scrollAnchor.value?.scrollIntoView({ behavior: 'smooth' })
  }
)

watch(
  () => props.loading,
  async (val) => {
    if (val) {
      await nextTick()
      scrollAnchor.value?.scrollIntoView({ behavior: 'smooth' })
    }
  }
)

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
</script>
