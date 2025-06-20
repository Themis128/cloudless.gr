<template>
  <div>
    <v-card class="glassmorph pa-4 d-inline-flex align-center justify-center" elevation="4" style="border-radius: 18px;">
      <div class="about-social mb-0">
        <v-btn
          v-for="item in socialWithIcons"
          :key="item.name"
          icon
          :href="item.url"
          target="_blank"
          :aria-label="item.aria"
          class="mx-1"
        >
          <FontAwesomeIcon :icon="item.iconObj" class="fa-social" :style="{ color: item.color || '#333' }" />
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useContactInfo } from '@/composables/useContactInfo'
import { faGithub, faLinkedin, faTwitter } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { computed } from 'vue'

const contact = useContactInfo()
const iconMap = { faTwitter, faGithub, faLinkedin }
const socialWithIcons = computed(() => contact.social.map(item => ({
  ...item,
  iconObj: iconMap[item.icon as keyof typeof iconMap]
})))
</script>

<style scoped>
.about-social {
  margin-bottom: 1.5rem;
}
.fa-social {
  width: 32px;
  height: 32px;
  vertical-align: middle;
}
</style>
