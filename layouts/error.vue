<template>
  <VApp>
    <VMain>
      <VContainer class="fill-height">
        <VRow justify="center" align="center">
          <VCol cols="12" md="6">
            <VCard class="text-center pa-6">
              <VIcon size="72" color="error" class="mb-4">
                mdi-alert-circle-outline
              </VIcon>
              
              <VCardTitle class="text-h4 mb-2">
                {{ error.statusCode === 404 ? 'Page Not Found' : 'An Error Occurred' }}
              </VCardTitle>
              
              <VCardText class="text-h6 mb-4">
                {{ error.statusCode === 404 
                  ? 'The page you are looking for does not exist.' 
                  : error.statusMessage || 'Something went wrong.' 
                }}
              </VCardText>
              
              <VCardActions class="justify-center">
                <VBtn 
                  color="primary" 
                  variant="elevated"
                  @click="handleError"
                >
                  {{ error.statusCode === 404 ? 'Go Home' : 'Try Again' }}
                </VBtn>
              </VCardActions>
            </VCard>
          </VCol>
        </VRow>
      </VContainer>
    </VMain>
  </VApp>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

interface Props {
  error: NuxtError
}

const props = defineProps<Props>()

const handleError = () => {
  if (props.error.statusCode === 404) {
    navigateTo('/')
  } else {
    clearError({ redirect: '/' })
  }
}

// Set appropriate meta tags
useHead({
  title: props.error.statusCode === 404 ? 'Page Not Found' : 'Error',
  meta: [
    { name: 'robots', content: 'noindex' }
  ]
})
</script>
