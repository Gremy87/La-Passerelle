<template>
  <!-- Modal d'ajout d'un item au hangar -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
       @click.self="$emit('close')">
    <div class="w-full max-w-md bg-space-panel border border-space-border rounded-xl shadow-2xl">

      <div class="px-5 py-4 border-b border-space-border flex items-center justify-between">
        <h2 class="font-mono font-semibold text-space-text">Ajouter au Hangar</h2>
        <button @click="$emit('close')" class="text-space-muted hover:text-space-text text-xl leading-none">×</button>
      </div>

      <form @submit.prevent="creer" class="p-5 space-y-4">
        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">TITRE *</label>
          <input v-model="form.titre" type="text" class="input"
                 placeholder="ex: Mettre à jour les dépendances" required autofocus />
        </div>

        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">DESCRIPTION (optionnel)</label>
          <textarea v-model="form.description" class="textarea" rows="3"
                    placeholder="Détails supplémentaires..."></textarea>
        </div>

        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">PRIORITÉ</label>
          <select v-model="form.priorite" class="input">
            <option value="basse">🔵 Basse</option>
            <option value="normale">⚪ Normale</option>
            <option value="haute">🟡 Haute</option>
            <option value="urgente">🔴 Urgente</option>
          </select>
        </div>

        <div v-if="error" class="text-space-danger text-xs font-mono">{{ error }}</div>

        <div class="flex gap-2 pt-2">
          <button type="button" @click="$emit('close')" class="btn-secondary flex-1">Annuler</button>
          <button type="submit" class="btn-primary flex-1" :disabled="loading">
            {{ loading ? 'Ajout...' : '📦 Ajouter au hangar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePasserelleStore } from '../stores/passerelle'

const emit  = defineEmits(['close'])
const store = usePasserelleStore()

const form = ref({
  titre:       '',
  description: '',
  priorite:    'normale',
})
const loading = ref(false)
const error   = ref('')

async function creer() {
  if (!form.value.titre.trim()) return
  loading.value = true
  error.value   = ''

  try {
    await store.createHangarItem({
      titre:       form.value.titre.trim(),
      description: form.value.description.trim() || undefined,
      priorite:    form.value.priorite,
    })
    emit('close')
  } catch (err) {
    error.value = err.response?.data?.error || 'Erreur lors de l\'ajout'
  } finally {
    loading.value = false
  }
}
</script>
