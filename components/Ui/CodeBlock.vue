<template>
  <div class="code-block">
    <pre><code :class="`language-${language}`">{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
interface Props {
  code: string
  language?: string
}

withDefaults(defineProps<Props>(), {
  language: 'text'
})
</script>

<style scoped>
.code-block {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 16px;
  margin: 8px 0;
  overflow-x: auto;
}

.code-block pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.4;
  color: #333;
}

.code-block code {
  background: none;
  padding: 0;
}
</style> 