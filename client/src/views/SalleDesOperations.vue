<template>
  <!-- Salle des Opérations — Layout 4 colonnes -->
  <div class="h-[calc(100vh-48px)] flex flex-col">

    <!-- En-tête de la salle -->
    <div class="px-4 py-2 border-b border-space-border flex items-center justify-between">
      <div class="text-xs font-mono text-space-muted uppercase tracking-widest">
        Salle des Opérations
      </div>
      <div class="text-xs font-mono text-space-muted">
        {{ store.missions.length }} mission{{ store.missions.length !== 1 ? 's' : '' }} •
        {{ store.agentsActifs.length }} agent{{ store.agentsActifs.length !== 1 ? 's' : '' }} actif{{ store.agentsActifs.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Grid 4 colonnes -->
    <div class="flex-1 grid grid-cols-4 divide-x divide-space-border overflow-hidden">

      <!-- ── Colonne 1 : ESCADRON ─────────────────────────────────── -->
      <div class="flex flex-col overflow-hidden">
        <ColonneHeader titre="ESCADRON" :count="store.agents.length" icon="🛸" />
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <AgentStatus
            v-for="agent in store.agents"
            :key="agent.id"
            :agent="agent"
          />
          <!-- État vide -->
          <div v-if="store.agents.length === 0" class="text-center text-space-muted text-xs font-mono py-8">
            Aucun agent enregistré
          </div>
          <!-- Bouton ajouter agent -->
          <button @click="showAgentModal = true"
                  class="w-full border border-dashed border-space-border rounded-md py-2 text-space-muted text-xs font-mono hover:border-space-blue hover:text-space-blue transition-colors">
            + Ajouter un agent
          </button>
        </div>
      </div>

      <!-- ── Colonne 2 : EN MISSION ───────────────────────────────── -->
      <div class="flex flex-col overflow-hidden">
        <ColonneHeader titre="EN MISSION" :count="store.missionsByStatut.en_cours.length" icon="🚀" />
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <MissionCard
            v-for="mission in store.missionsByStatut.en_cours"
            :key="mission.id"
            :mission="mission"
          />
          <div v-if="store.missionsByStatut.en_cours.length === 0"
               class="text-center text-space-muted text-xs font-mono py-8">
            Aucune mission en cours
          </div>
        </div>
      </div>

      <!-- ── Colonne 3 : INTERVENTION REQUISE ────────────────────── -->
      <div class="flex flex-col overflow-hidden"
           :class="store.missionsByStatut.intervention.length > 0 ? 'ring-1 ring-inset ring-space-danger/30' : ''">
        <ColonneHeader
          titre="INTERVENTION REQUISE"
          :count="store.missionsByStatut.intervention.length"
          icon="🚨"
          :urgent="store.missionsByStatut.intervention.length > 0"
        />
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <MissionCard
            v-for="mission in store.missionsByStatut.intervention"
            :key="mission.id"
            :mission="mission"
            :urgent="true"
          />
          <div v-if="store.missionsByStatut.intervention.length === 0"
               class="text-center text-space-muted text-xs font-mono py-8">
            Aucune intervention
          </div>
        </div>
      </div>

      <!-- ── Colonne 4 : HANGAR ───────────────────────────────────── -->
      <div class="flex flex-col overflow-hidden">
        <ColonneHeader titre="HANGAR" :count="store.missionsByStatut.hangar.length + store.hangarEnAttente.length" icon="📦" />
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <!-- Missions en attente d'assignation -->
          <MissionCard
            v-for="mission in store.missionsByStatut.hangar"
            :key="'m-' + mission.id"
            :mission="mission"
          />
          <!-- Todos personnels -->
          <HangarItem
            v-for="item in store.hangar"
            :key="'h-' + item.id"
            :item="item"
          />
          <div v-if="store.missionsByStatut.hangar.length === 0 && store.hangar.length === 0"
               class="text-center text-space-muted text-xs font-mono py-8">
            Hangar vide
          </div>
          <!-- Bouton ajouter todo -->
          <button @click="showHangarModal = true"
                  class="w-full border border-dashed border-space-border rounded-md py-2 text-space-muted text-xs font-mono hover:border-space-blue hover:text-space-blue transition-colors">
            + Ajouter au hangar
          </button>
        </div>
      </div>

    </div>

    <!-- Section missions terminées (rétractable) -->
    <div class="border-t border-space-border">
      <button @click="showTerminees = !showTerminees"
              class="w-full px-4 py-2 flex items-center justify-between text-xs font-mono text-space-muted hover:text-space-text transition-colors">
        <span>OBJECTIFS ATTEINTS ({{ store.missionsByStatut.terminee.length }})</span>
        <span>{{ showTerminees ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showTerminees" class="px-4 pb-3 flex gap-2 overflow-x-auto">
        <MissionCard
          v-for="mission in store.missionsByStatut.terminee.slice(0, 10)"
          :key="mission.id"
          :mission="mission"
          :compact="true"
        />
      </div>
    </div>
  </div>

  <!-- Modal ajout agent -->
  <AgentModal v-if="showAgentModal" @close="showAgentModal = false" />

  <!-- Modal ajout hangar -->
  <HangarModal v-if="showHangarModal" @close="showHangarModal = false" />
</template>

<script setup>
import { ref } from 'vue'
import { usePasserelleStore } from '../stores/passerelle'
import ColonneHeader from '../components/ColonneHeader.vue'
import MissionCard from '../components/MissionCard.vue'
import AgentStatus from '../components/AgentStatus.vue'
import HangarItem from '../components/HangarItem.vue'
import AgentModal from '../components/AgentModal.vue'
import HangarModal from '../components/HangarModal.vue'

const store = usePasserelleStore()
const showTerminees = ref(false)
const showAgentModal = ref(false)
const showHangarModal = ref(false)
</script>
