<template>
  <!-- Item du hangar (todo de l'Amiral) -->
  <div class="card hover:border-space-blue/30 transition-all"
       :class="{ 'opacity-50': item.statut === 'fait' || item.statut === 'abandonne' }">

    <div class="flex items-start gap-2">
      <!-- Checkbox -->
      <button
        @click.prevent="toggleStatut"
        class="mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
        :class="item.statut === 'fait'
          ? 'bg-space-success border-space-success text-white'
          : 'border-space-border hover:border-space-blue'"
      >
        <span v-if="item.statut === 'fait'" class="text-xs">✓</span>
      </button>

      <!-- Contenu -->
      <div class="flex-1 min-w-0">
        <div class="text-xs font-mono font-medium text-space-text truncate"
             :class="{ 'line-through text-space-muted': item.statut === 'fait' }">
          {{ item.titre }}
        </div>
        <div v-if="item.description" class="text-xs font-mono text-space-muted truncate mt-0.5">
          {{ item.description }}
        </div>

        <!-- Badges -->
        <div class="flex items-center gap-1 mt-1">
          <span class="text-xs font-mono px-1.5 py-0.5 rounded-full"
                :class="PRIORITE_CLASSES[item.priorite]">
            {{ item.priorite }}
          </span>
          <!-- Lié à une mission -->
          <router-link
            v-if="item.mission_id"
            :to="`/mission/${item.mission_id}`"
            class="text-xs font-mono text-space-cyan hover:text-space-blue"
          >
            → mission #{{ item.mission_id }}
          </router-link>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-1 shrink-0">
        <!-- Transformer en mission -->
        <button
          v-if="item.statut !== 'fait' && !item.mission_id"
          @click.prevent="transformerMission"
          title="Transformer en mission"
          class="text-xs text-space-muted hover:text-space-blue transition-colors"
        >
          🚀
        </button>
        <!-- Supprimer -->
        <button
          @click.prevent="supprimer"
          title="Supprimer"
          class="text-xs text-space-muted hover:text-space-danger transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePasserelleStore } from '../stores/passerelle'

const props = defineProps({
  item: { type: Object, required: true },
})

const store = usePasserelleStore()

const PRIORITE_CLASSES = {
  basse:   'bg-space-muted/20 text-space-muted',
  normale: 'bg-space-border text-space-dim',
  haute:   'bg-space-warning/20 text-space-warning',
  urgente: 'bg-space-danger/20 text-space-danger',
}

async function toggleStatut() {
  const nouveauStatut = props.item.statut === 'fait' ? 'en_attente' : 'fait'
  await store.updateHangarItem(props.item.id, { statut: nouveauStatut })
}

async function transformerMission() {
  if (!confirm(`Transformer "${props.item.titre}" en mission ?`)) return
  const result = await store.transformerEnMission(props.item.id)
  console.log('Mission créée:', result.mission)
}

async function supprimer() {
  if (!confirm(`Supprimer "${props.item.titre}" du hangar ?`)) return
  await store.deleteHangarItem(props.item.id)
}
</script>
