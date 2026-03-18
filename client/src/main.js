/**
 * main.js — Point d'entrée de l'application Vue 3
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'

import App from './App.vue'
import './style.css'

// ─── Vues ────────────────────────────────────────────────────────────────────

import SalleDesOperations from './views/SalleDesOperations.vue'
import MissionDetail      from './views/MissionDetail.vue'
import LoginView          from './views/LoginView.vue'
import Starchive          from './views/Starchive.vue'

// ─── Router ───────────────────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',            component: SalleDesOperations, name: 'home' },
    { path: '/mission/:id', component: MissionDetail,      name: 'mission' },
    { path: '/login',       component: LoginView,          name: 'login' },
    { path: '/starchive',   component: Starchive,          name: 'starchive' },
  ]
})

// ─── App ──────────────────────────────────────────────────────────────────────

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
