<template>
    <div class="vue-file-viewer">
        <form @submit.prevent="loadFile" class="viewer-form">
            <label for="filePath">Vue file path:</label>
            <input id="filePath" v-model="filePath" placeholder="e.g. components/CodegenWidget.vue"
                class="viewer-input" />
            <button type="submit" class="viewer-btn">View</button>
        </form>
        <div v-if="loading" class="viewer-loading">Loading...</div>
        <div v-else-if="error" class="viewer-error">{{ error }}</div>
        <pre v-else-if="fileContent" class="viewer-code"><code>{{ fileContent }}</code></pre>
    </div>
</template>

<script setup>
import { useLLMAndFileViewer } from '@/composables/useLLMAndFileViewer';

const { filePath, fileContent, fileLoading: loading, fileError: error, loadFile } = useLLMAndFileViewer();
</script>

<style scoped>
.vue-file-viewer {
    max-width: 800px;
    margin: 2rem auto;
    padding: 2rem;
    background: #fff;
    border-radius: 1rem;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}

.viewer-form {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.viewer-input {
    flex: 1;
    padding: 0.5rem;
    border-radius: 0.3rem;
    border: 1px solid #ccc;
}

.viewer-btn {
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 0.3rem;
    padding: 0.5rem 1.2rem;
    cursor: pointer;
    transition: background 0.2s;
}

.viewer-btn:hover {
    background: #1e40af;
}

.viewer-loading {
    color: #888;
    margin-bottom: 1rem;
}

.viewer-error {
    color: #c00;
    margin-bottom: 1rem;
}

.viewer-code {
    background: #f6f8fa;
    border-radius: 0.4rem;
    padding: 1rem;
    font-family: 'Fira Mono', Consolas, monospace;
    font-size: 0.98rem;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
}
</style>
