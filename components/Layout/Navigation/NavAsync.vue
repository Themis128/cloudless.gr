<script setup lang="ts">
import { useLazyComponent } from '@/composables/useLazyComponent'
import { useBreakpoints } from '@vueuse/core'

const LargeNav = useLazyComponent('Layout/Navigation/LargeNav')
const SmallNav = useLazyComponent('Layout/Navigation/SmallNav')
const breakpoints = useBreakpoints({ md: 768 })
const isDesktop = breakpoints.greaterOrEqual('md')
</script>

<template>
  <client-only>
    <Suspense>
      <template #default>
        <LargeNav v-if="isDesktop" />
        <SmallNav v-else />
      </template>
      <template #fallback>
        <div style="height: 48px;"></div>
      </template>
    </Suspense>
  </client-only>
</template>
