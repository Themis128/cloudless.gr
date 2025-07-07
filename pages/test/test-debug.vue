<template>
  <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
    <h1>Simple Debug Info</h1>
    <div style="background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
      <h3>Current Path:</h3>
      <pre>{{ $route.path }}</pre>
    </div>
    <div style="background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
      <h3>localStorage Keys:</h3>
      <pre>{{ storageInfo }}</pre>
    </div>
    <div style="margin: 20px 0;">
      <button 
        style="padding: 10px 20px; margin: 5px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;" 
        @click="checkStorage"
      >
        Check Storage
      </button>
      <button 
        style="padding: 10px 20px; margin: 5px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;" 
        @click="clearAll"
      >
        Clear All Storage
      </button>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
})

const storageInfo = ref('Not checked yet')

const checkStorage = () => {
  if (process.client) {
    const allKeys = Object.keys(localStorage)
    const sbKeys = allKeys.filter(key => key.startsWith('sb-'))
    
    const info = {
      allStorageKeys: allKeys,
      supabaseKeys: sbKeys,
      keyValues: {}
    }
    
    sbKeys.forEach(key => {
      info.keyValues[key] = localStorage.getItem(key) ? 'Has value' : 'Empty'
    })
    
    storageInfo.value = JSON.stringify(info, null, 2)
  }
}

const clearAll = () => {
  if (process.client) {
    localStorage.clear()
    sessionStorage.clear()
    checkStorage()
  }
}

onMounted(() => {
  checkStorage()
})
</script>
