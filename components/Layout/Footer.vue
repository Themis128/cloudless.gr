<template>
  <footer :class="['footer', 'w-full', 'text-center', 'py-2', 'text-sm', 'bg-transparent', isDark ? 'footer-dark' : 'footer-light']">
    © {{ year }} <b>Cloudless.gr</b> — All rights reserved.
    <span class="footer-social">
      <v-btn
        v-for="item in socialWithIcons"
        :key="item.name"
        icon
        :href="item.url"
        target="_blank"
        :aria-label="item.aria"
        class="mx-1"
        size="small"
        variant="text"
      >
        <FontAwesomeIcon :icon="item.iconObj" class="fa-social" :style="`color:${item.color}`" />
      </v-btn>
    </span>
  </footer>
</template>

<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faTwitter, faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons'
import { useContactInfo } from '@/composables/useContactInfo'
import { computed } from 'vue'
const props = defineProps({ year: { type: Number, required: true }, isDark: { type: Boolean, default: false } });
const contact = useContactInfo()
const iconMap = { faTwitter, faGithub, faLinkedin }
const socialWithIcons = computed(() => contact.social.map(item => ({
  ...item,
  iconObj: iconMap[item.icon as keyof typeof iconMap]
})))
</script>

<style scoped>
.footer {
  font-family: inherit;
  background: transparent;
  min-height: 32px;
  line-height: 1.2;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  position: relative;
  width: 100%;
  box-sizing: border-box;
}
.footer-social {
  margin-left: 0.5rem;
}
.fa-social {
  width: 20px;
  height: 20px;
  vertical-align: middle;
}
.footer-dark {
  color: #fff;
}
.footer-light {
  color: #222;
}
@media (max-width: 640px) {
  .footer {
    font-size: 0.85rem;
    padding-top: 0.15rem;
    padding-bottom: 0.15rem;
  }
}
</style>
