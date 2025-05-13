<template>
    <div class="codegen-page-wrapper">
        <CodegenWidget />
    </div>
</template>

<script setup lang="ts">
// No additional logic needed; CodegenWidget handles all logic internally
</script>

<style scoped>
.codegen-page-wrapper {
    min-height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 2.5rem;
    box-sizing: border-box;
}
</style>
