<template>
  <section class="w-full">
    <v-row class="justify-center">
      <v-col cols="12" md="4" class="mb-6">
        <v-card
          class="bg-white/80 rounded-xl shadow pa-6 d-flex flex-column align-center"
        >
          <div class="text-h6 font-weight-bold mb-1">Wine Quality Forecast</div>
          <div class="text-body-2 text-medium-emphasis mb-3 text-center">
            Forecast wine quality using custom or sample datasets.
          </div>
          <ul
            class="text-body-2 text-medium-emphasis mb-4 list-disc list-inside"
          >
            <li class="mb-1">Upload your own data or use sample data</li>
            <li class="mb-1">Retrain or use a pre-trained model</li>
            <li class="mb-1">View predictions and model metrics</li>
          </ul>
          <StreamlitBoard url="https://xgboost-forecasting.streamlit.app/" />
        </v-card>
      </v-col>
      <v-col cols="12" md="4" class="mb-6">
        <v-card
          class="bg-white/80 rounded-xl shadow pa-6 d-flex flex-column align-center"
        >
          <div class="text-h6 font-weight-bold mb-1">LLM Leaderboard</div>
          <div class="text-body-2 text-medium-emphasis mb-3 text-center">
            Compare and explore the latest Large Language Models (LLMs).
          </div>
          <ul
            class="text-body-2 text-medium-emphasis mb-4 list-disc list-inside"
          >
            <li class="mb-1">Live leaderboard of open and closed LLMs</li>
            <li class="mb-1">Publisher and model details</li>
            <li class="mb-1">Open/closed status, Chatbot Arena F1, and more</li>
          </ul>
          <StreamlitBoard
            url="https://llm-leaderboard-8etfeqs8uf2.streamlit.app/"
          />
        </v-card>
      </v-col>
      <v-col cols="12" md="4" class="mb-6">
        <v-card
          class="bg-white/80 rounded-xl shadow pa-6 d-flex flex-column align-center"
        >
          <div class="text-h6 font-weight-bold mb-1">Streamlit cheat sheet</div>
          <div class="text-body-2 text-medium-emphasis mb-3 text-center">
            Quick reference for Streamlit widgets and features.
          </div>
          <ul
            class="text-body-2 text-medium-emphasis mb-4 list-disc list-inside"
          >
            <li class="mb-1">Display text and interactive widgets</li>
            <li class="mb-1">Connect to data sources</li>
            <li class="mb-1">Optimize and style your Streamlit apps</li>
          </ul>
          <StreamlitBoard url="https://tpot-deploy.streamlit.app/" />
        </v-card>
      </v-col>
    </v-row>
  </section>
</template>

<script setup lang="ts">
import StreamlitBoard from './StreamlitBoard.vue'
</script>
