<template>
  <div class="streamlit-board">
    <h3 class="streamlit-title">LLM-Leaderboard</h3>
    <iframe
      :src="embedUrl"
      frameborder="0"
      allowfullscreen
      class="streamlit-iframe"
      title="Streamlit Board"
      @error="onIframeError = true"
      ref="iframeRef"
    ></iframe>
    <div v-if="onIframeError" class="streamlit-fallback">
      <p>
        Unable to display the Streamlit board here. <br />
        <a :href="url" target="_blank" rel="noopener" class="streamlit-link">
          Open the board in a new tab
        </a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from '#imports';

const props = defineProps<{ url: string }>();
const onIframeError = ref(false);
const iframeRef = ref<HTMLIFrameElement | null>(null);
// Add ?embed=true to the URL if not present
const embedUrl = computed(() => {
  if (props.url.includes('?')) {
    return props.url + '&embed=true';
  } else {
    return props.url + '?embed=true';
  }
});
</script>

<style scoped>
.streamlit-board {
  width: 100%;
  max-width: 600px;
  margin: 2rem auto;
  background: transparent;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 24px 0 rgba(30, 41, 59, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.streamlit-title {
  color: #1e293b;
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  letter-spacing: 0.01em;
  text-align: center;
}

.streamlit-iframe {
  width: 100%;
  min-height: 350px;
  border: none;
  background: transparent;
}

.streamlit-fallback {
  width: 100%;
  padding: 2rem 1rem;
  text-align: center;
  color: #1e293b;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 1rem;
  margin-top: 1rem;
}

.streamlit-link {
  color: #2563eb;
  text-decoration: underline;
  font-weight: 700;
}

@media (max-width: 900px) {
  .streamlit-board {
    max-width: 100%;
  }

  .streamlit-iframe {
    min-height: 250px;
  }
}
</style>
