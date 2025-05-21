<template>
  <section class="w-full">
    <div class="flex flex-col md:flex-row gap-6 justify-center">
      <div
        class="flex-1 min-w-[260px] max-w-sm bg-white/80 rounded-xl shadow p-6 flex flex-col items-center"
      >
        <div class="text-lg font-semibold mb-1">Wine Quality Forecast</div>
        <div class="text-sm text-gray-600 mb-3 text-center">
          Forecast wine quality using custom or sample datasets.
        </div>
        <ul class="text-sm text-gray-700 mb-4 list-disc list-inside space-y-1">
          <li>Upload your own data or use sample data</li>
          <li>Retrain or use a pre-trained model</li>
          <li>View predictions and model metrics</li>
        </ul>
        <StreamlitBoard url="https://xgboost-forecasting.streamlit.app/" />
      </div>
      <div
        class="flex-1 min-w-[260px] max-w-sm bg-white/80 rounded-xl shadow p-6 flex flex-col items-center"
      >
        <div class="text-lg font-semibold mb-1">LLM Leaderboard</div>
        <div class="text-sm text-gray-600 mb-3 text-center">
          Compare and explore the latest Large Language Models (LLMs).
        </div>
        <ul class="text-sm text-gray-700 mb-4 list-disc list-inside space-y-1">
          <li>Live leaderboard of open and closed LLMs</li>
          <li>Publisher and model details</li>
          <li>Open/closed status, Chatbot Arena F1, and more</li>
        </ul>
        <StreamlitBoard url="https://llm-leaderboard-8etfeqs8uf2.streamlit.app/" />
      </div>
      <div
        class="flex-1 min-w-[260px] max-w-sm bg-white/80 rounded-xl shadow p-6 flex flex-col items-center"
      >
        <div class="text-lg font-semibold mb-1">Streamlit cheat sheet</div>
        <div class="text-sm text-gray-600 mb-3 text-center">
          Quick reference for Streamlit widgets and features.
        </div>
        <ul class="text-sm text-gray-700 mb-4 list-disc list-inside space-y-1">
          <li>Display text and interactive widgets</li>
          <li>Connect to data sources</li>
          <li>Optimize and style your Streamlit apps</li>
        </ul>
        <StreamlitBoard url="https://tpot-deploy.streamlit.app/" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import StreamlitBoard from './StreamlitBoard.vue';
</script>
