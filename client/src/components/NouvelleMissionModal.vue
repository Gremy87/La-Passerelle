<template>
  <!-- Modal de création de nouvelle mission -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
       @click.self="$emit('close')">
    <div class="w-full max-w-lg bg-space-panel border border-space-border rounded-xl shadow-2xl">

      <!-- En-tête -->
      <div class="px-5 py-4 border-b border-space-border flex items-center justify-between">
        <h2 class="font-mono font-semibold text-space-text">Nouvelle Mission</h2>
        <button @click="$emit('close')" class="text-space-muted hover:text-space-text text-xl leading-none">×</button>
      </div>

      <!-- Formulaire -->
      <form @submit.prevent="creer" class="p-5 space-y-4">

        <!-- Titre -->
        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">TITRE *</label>
          <input v-model="form.titre" type="text" class="input"
                 placeholder="ex: Refactoring auth BKO" required />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">DESCRIPTION *</label>
          <textarea v-model="form.description" class="textarea" rows="4"
                    placeholder="Décris la tâche en détail..." required></textarea>
        </div>

        <!-- Type -->
        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">TYPE</label>
          <select v-model="form.type" class="input">
            <option value="execution">Exécution (tâche claire)</option>
            <option value="refinement">Refinement (idée à affiner)</option>
            <option value="todo_personnel">Todo personnel</option>
          </select>
        </div>

        <!-- Repo path (optionnel) -->
        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">REPO (optionnel)</label>
          <input v-model="form.repo_path" type="text" class="input"
                 placeholder="/home/ubuntu/mon-repo" />
        </div>

        <!-- Assigner un agent (optionnel) -->
        <div v-if="store.agents.length > 0">
          <label class="block text-xs font-mono text-space-muted mb-1">ASSIGNER UN VAISSEAU (optionnel)</label>
          <select v-model="form.agent_id" class="input">
            <option value="">— Aucun pour l'instant —</option>
            <option v-for="agent in agentsLibres" :key="agent.id" :value="agent.id">
              {{ agent.nom }}
            </option>
          </select>
        </div>

        <!-- Erreur -->
        <div v-if="error" class="text-space-danger text-xs font-mono">{{ error }}</div>

        <!-- Actions -->
        <div class="flex gap-2 pt-2">
          <button type="button" @click="$emit('close')" class="btn-secondary flex-1">
            Annuler
          </button>
          <button type="submit" class="btn-primary flex-1" :disabled="loading">
            {{ loading ? 'Création...' : '🚀 Créer la mission' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePasserelleStore } from '../stores/passerelle'

const emit  = defineEmits(['close'])
const store = usePasserelleStore()

const loading = ref(false)
const error   = ref('')

const form = ref({
  titre:       '',
  description: '',
  type:        'execution',
  repo_path:   '',
  agent_id:    '',
})

const agentsLibres = computed(() =>
  store.agents.filter(a => a.statut === 'libre')
)

async function creer() {
  if (!form.value.titre || !form.value.description) return
  loading.value = true
  error.value = ''

  try {
    const payload = {
      titre:       form.value.titre.trim(),
      description: form.value.description.trim(),
      type:        form.value.type,
      repo_path:   form.value.repo_path.trim() || undefined,
    }

    const mission = await store.createMission(payload)

    // Assigner l'agent si sélectionné
    if (form.value.agent_id) {
      await store.updateMission(mission.id, { agent_id: parseInt(form.value.agent_id) })
      await store.updateAgent(parseInt(form.value.agent_id), {
        mission_id: mission.id,
        statut: 'en_mission'
      })
    }

    emit('close')
  } catch (err) {
    error.value = err.response?.data?.error || 'Erreur lors de la création'
  } finally {
    loading.value = false
  }
}
</script>
