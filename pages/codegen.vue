<template>
    <div class="codegen-container">
        <CodegenWidget />
    </div>
</template>

<script setup lang="ts">
// No additional logic needed; CodegenWidget handles all logic internally
</script>

<style scoped>
.codegen-container {
    background: rgba(255, 255, 255, 0.97);
    border-radius: 1.5rem;
    box-shadow: 0 4px 32px 0 rgba(80, 80, 255, 0.10);
    padding: 2.5rem 2rem;
    max-width: 540px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
}
</style>
