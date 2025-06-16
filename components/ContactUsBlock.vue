<template>
  <div>
    <div class="about-social mb-4">
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
  </div>
</template>

<script setup lang="ts">
import { useContactInfo } from '@/composables/useContactInfo'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faTwitter, faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons'
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
