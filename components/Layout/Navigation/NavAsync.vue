<script setup lang="ts">
import { useLazyComponent } from '@/composables/useLazyComponent'
import { useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'

const LargeNav = useLazyComponent('Layout/Navigation/LargeNav')
const SmallNav = useLazyComponent('Layout/Navigation/SmallNav')
const breakpoints = useBreakpoints({ md: 768 })
const isDesktop = computed(() => breakpoints.greaterOrEqual('md'))
</script>

<template>
  <client-only>
    <Suspense>
      <template #default>
        <component :is="isDesktop ? LargeNav : SmallNav" />
      </template>
      <template #fallback>
        <div style="height: 48px;"></div>
      </template>
    </Suspense>
  </client-only>
</template>
