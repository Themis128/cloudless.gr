<template>
  <footer 
    role="contentinfo" 
    itemscope 
    itemtype="https://schema.org/WPFooter"
    :class="['footer', 'w-full', 'text-center', 'py-2', 'text-sm', 'bg-transparent', props.isDark ? 'footer-dark' : 'footer-light']"
  >
    © {{ displayYear }} <b>Cloudless</b> — All rights reserved.
    <span class="footer-social">
      <v-btn
        v-for="item in socialWithIcons"
        :key="item.name"
        icon
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="item.aria || item.name"
        class="mx-1"
        size="small"
        variant="text"
      >
        <FontAwesomeIcon :icon="item.iconObj" class="fa-social" :style="{ color: item.color || '#333' }" />
      </v-btn>
    </span>
  </footer>
</template>

<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faTwitter, faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons'
import { faUserCircle } from '@fortawesome/free-solid-svg-icons'
import { useContactInfo } from '@/composables/useContactInfo'
import { computed } from 'vue'

// Define props with better typing and optional social override
interface ContactItem {
  name: string
  url: string
  icon: string
  aria?: string
  color?: string
}

const now = new Date().getFullYear()
const props = withDefaults(defineProps<{ 
  year?: number
  isDark?: boolean
  social?: ContactItem[]
}>(), {
  year: undefined,
  isDark: false,
  social: undefined
})

const displayYear = computed(() => props.year ?? now)

// Use prop social or fallback to composable
const contact = useContactInfo()
const sourceSocial = computed(() => props.social ?? contact.social)

const iconMap = { faTwitter, faGithub, faLinkedin, faUserCircle }

const socialWithIcons = computed(() => 
  sourceSocial.value
    .filter(item => iconMap[item.icon as keyof typeof iconMap]) // Only include items with valid icons
    .map(item => ({
      ...item,
      iconObj: iconMap[item.icon as keyof typeof iconMap] ?? faUserCircle // Fallback icon
    }))
)
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
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.fa-social {
  width: 20px;
  height: 20px;
  vertical-align: middle;
  transition: transform 0.2s ease;
}
.v-btn:hover .fa-social {
  transform: scale(1.1);
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
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .footer-social {
    margin-left: 0;
    margin-top: 0.25rem;
  }
}
</style>
