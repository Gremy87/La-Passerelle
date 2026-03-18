<template>
  <!-- En-tête d'une colonne de la Salle des Opérations -->
  <div class="px-3 py-2 border-b border-space-border flex items-center justify-between"
       :class="urgent ? 'bg-space-danger/10' : 'bg-space-panel'">
    <div class="flex items-center gap-2">
      <span class="text-base">{{ icon }}</span>
      <span class="text-xs font-mono font-semibold uppercase tracking-wider"
            :class="urgent ? 'text-space-danger' : 'text-space-muted'">
        {{ titre }}
      </span>
    </div>
    <!-- Badge compteur -->
    <span v-if="count > 0"
          class="text-xs font-mono px-1.5 py-0.5 rounded-full"
          :class="urgent ? 'bg-space-danger/30 text-space-danger' : 'bg-space-border text-space-muted'">
      {{ count }}
    </span>
  </div>
</template>

<script setup>
defineProps({
  titre:  { type: String, required: true },
  icon:   { type: String, default: '●' },
  count:  { type: Number, default: 0 },
  urgent: { type: Boolean, default: false },
})
</script>
