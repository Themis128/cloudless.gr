<template>
  <footer
    role="contentinfo"
    itemscope
    itemtype="https://schema.org/WPFooter"
    :class="[
      'footer',
      'w-full',
      'text-center',
      'py-2',
      'text-sm',
      'bg-transparent',
      props.isDark ? 'footer-dark' : 'footer-light',
    ]"
  >
    <span class="footer-left">© <b>Cloudless</b></span>
    <span class="footer-center footer-rights">All rights reserved {{ displayYear }}</span>
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
        <FontAwesomeIcon
          :icon="item.iconObj"
          class="fa-social"
          :style="{ color: item.color || '#333' }"
        />
      </v-btn>
    </span>
  </footer>
</template>

<script setup lang="ts">
import { useContactInfo } from '@/composables/useContactInfo';
import { faGithub, faLinkedin, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed } from 'vue';

// Define props with better typing and optional social override
interface ContactItem {
  name: string;
  url: string;
  icon: string;
  aria?: string;
  color?: string;
}

const now = new Date().getFullYear();
const props = withDefaults(
  defineProps<{
    year?: number;
    isDark?: boolean;
    social?: ContactItem[];
  }>(),
  {
    year: undefined,
    isDark: false,
    social: undefined,
  },
);

const displayYear = computed(() => props.year ?? now);

// Use prop social or fallback to composable
const contact = useContactInfo();
const sourceSocial = computed(() => props.social ?? contact.social);

const iconMap = { faTwitter, faGithub, faLinkedin, faUserCircle };

const socialWithIcons = computed(() =>
  sourceSocial.value
    .filter((item) => iconMap[item.icon as keyof typeof iconMap]) // Only include items with valid icons
    .map((item) => ({
      ...item,
      iconObj: iconMap[item.icon as keyof typeof iconMap] ?? faUserCircle, // Fallback icon
    })),
);
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
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.footer-social {
  flex: 1;
  display: flex;
  justify-content: flex-end;
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
.footer-rights {
  font-size: 0.75rem;
  opacity: 0.8;
  font-weight: 300;
}

.footer-left {
  flex: 1;
  text-align: left;
}

.footer-center {
  flex: 1;
  text-align: center;
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
