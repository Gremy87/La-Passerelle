<template>
  <div class="min-h-[calc(100vh-48px)] flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">⚡</div>
        <h1 class="font-mono font-bold text-space-text text-xl tracking-wider">LA PASSERELLE</h1>
        <p class="text-space-muted text-sm font-mono mt-1">Accès Amiral requis</p>
      </div>

      <!-- Formulaire -->
      <form @submit.prevent="login" class="card space-y-4">
        <div>
          <label class="block text-xs font-mono text-space-muted mb-1">MOT DE PASSE</label>
          <input
            v-model="password"
            type="password"
            class="input"
            placeholder="••••••••"
            autofocus
          />
        </div>

        <div v-if="error" class="text-space-danger text-xs font-mono">
          {{ error }}
        </div>

        <button type="submit" class="w-full btn-primary" :disabled="loading">
          {{ loading ? 'Connexion...' : 'Accéder à la Passerelle' }}
        </button>
      </form>

      <p class="text-center text-space-dim text-xs font-mono mt-4">
        Port 3717 ⚡
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router   = useRouter()
const password = ref('')
const error    = ref('')
const loading  = ref(false)

async function login() {
  if (!password.value) return
  loading.value = true
  error.value = ''

  try {
    await axios.post('/api/auth/login', { password: password.value }, { withCredentials: true })
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || 'Erreur de connexion'
  } finally {
    loading.value = false
  }
}
</script>
