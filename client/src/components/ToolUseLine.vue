<template>
  <!-- Affichage formaté d'une ligne d'utilisation d'outil -->
  <span v-if="parsed">
    <!-- Icône selon l'outil -->
    <span class="text-space-cyan">{{ TOOL_ICONS[parsed.outil] || '🔧' }}</span>
    <span class="text-space-text ml-1">{{ parsed.outil }}</span>
    <!-- Paramètre principal (chemin fichier, commande...) -->
    <span v-if="mainParam" class="text-space-muted ml-1">{{ mainParam }}</span>
    <!-- Résultat condensé -->
    <span v-if="resultLabel" class="ml-1" :class="resultOk ? 'text-space-success' : 'text-space-danger'">
      {{ resultLabel }}
    </span>
  </span>
  <!-- Fallback : afficher le contenu brut -->
  <span v-else class="text-space-muted">{{ contenu }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  contenu: { type: String, required: true },
})

const TOOL_ICONS = {
  Read:   '📖',
  Edit:   '✏️',
  Write:  '📝',
  Bash:   '⚡',
  Grep:   '🔍',
  Glob:   '📂',
  LS:     '📂',
  Task:   '📋',
  WebSearch: '🌐',
  WebFetch:  '🌐',
}

const parsed = computed(() => {
  try {
    return JSON.parse(props.contenu)
  } catch {
    return null
  }
})

const mainParam = computed(() => {
  if (!parsed.value?.input) return null
  const inp = parsed.value.input
  // Extraire le chemin fichier ou la commande bash
  return inp.file_path || inp.path || inp.command || inp.query || null
})

const resultOk = computed(() => {
  if (!parsed.value?.result) return true
  const r = parsed.value.result
  if (typeof r === 'string') return !r.toLowerCase().includes('error')
  return true
})

const resultLabel = computed(() => {
  if (!parsed.value?.result) return null
  return resultOk.value ? '✓' : '✗'
})
</script>
