<template>
  <!-- Modal d'ajout d'un agent à l'Escadron -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
       @click.self="$emit('close')">
    <div class="w-full max-w-md bg-space-panel border border-space-border rounded-xl shadow-2xl">

      <div class="px-5 py-4 border-b border-space-border flex items-center justify-between">
        <h2 class="font-mono font-semibold text-space-text">Enregistrer un Vaisseau</h2>
        <button @click="$emit('close')" class="text-space-muted hover:text-space-text text-xl leading-none">×</button>
      </div>

      <form @submit.prevent="creer" class="p-5 space-y-4">
        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">NOM DU VAISSEAU *</label>
          <input v-model="nom" type="text" class="input"
                 placeholder="ex: Claude-Alpha" required autofocus />
        </div>

        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">HOOK ENDPOINT (optionnel)</label>
          <input v-model="hookEndpoint" type="text" class="input"
                 placeholder="http://localhost:3718/..." />
          <p class="text-xs text-space-dim font-mono mt-1">
            URL de callback pour communiquer avec l'agent
          </p>
        </div>

        <div v-if="error" class="text-space-danger text-xs font-mono">{{ error }}</div>

        <div class="flex gap-2 pt-2">
          <button type="button" @click="$emit('close')" class="btn-secondary flex-1">Annuler</button>
          <button type="submit" class="btn-primary flex-1" :disabled="loading">
            {{ loading ? 'Enregistrement...' : '🛸 Ajouter à l\'Escadron' }}
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

const nom          = ref('')
const hookEndpoint = ref('')
const loading      = ref(false)
const error        = ref('')

async function creer() {
  if (!nom.value.trim()) return
  loading.value = true
  error.value   = ''

  try {
    await store.createAgent({
      nom:           nom.value.trim(),
      hook_endpoint: hookEndpoint.value.trim() || undefined,
    })
    emit('close')
  } catch (err) {
    error.value = err.response?.data?.error || 'Erreur lors de la création'
  } finally {
    loading.value = false
  }
}
</script>
