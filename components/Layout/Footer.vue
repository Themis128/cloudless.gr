<template>
  <v-footer class="transparent-footer mt-auto">
    <v-container>
      <v-row no-gutters align="center" justify="space-between" class="flex-column flex-sm-row">
        <v-col cols="12" sm="6" class="text-center text-sm-start mb-4 mb-sm-0">
          <span :class="['text-white', mobile ? 'text-body-2' : 'text-body-1']">
            &copy; {{ currentYear }} Cloudless. All rights reserved.
          </span>
        </v-col>
        <v-col cols="12" sm="6" class="d-flex justify-center justify-sm-end flex-wrap">
          <v-btn
            to="/terms"
            variant="text"
            :class="['footer-btn', mobile ? 'mx-1 px-2' : 'mx-1']"
            :size="mobile ? 'small' : 'default'"
          >
            Terms &amp; Privacy
          </v-btn>
          <v-btn
            to="/faq"
            variant="text"
            :class="['footer-btn', mobile ? 'mx-1 px-2' : 'mx-1']"
            :size="mobile ? 'small' : 'default'"
          >
            FAQ
          </v-btn>
          <v-btn
            to="/sitemap"
            variant="text"
            :class="['footer-btn d-none d-sm-flex', mobile ? 'mx-1 px-2' : 'mx-1']"
            :size="mobile ? 'small' : 'default'"
          >
            Sitemap
          </v-btn>
          <v-btn
            to="/contact"
            variant="text"
            :class="['footer-btn', mobile ? 'mx-1 px-2' : 'mx-1']"
            :size="mobile ? 'small' : 'default'"
          >
            Contact
          </v-btn>
          <v-btn
            to="/about"
            variant="text"
            :class="['footer-btn d-none d-sm-flex', mobile ? 'mx-1 px-2' : 'mx-1']"
            :size="mobile ? 'small' : 'default'"
          >
            About
          </v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-footer>
</template>

<script setup lang="ts">
import { computed } from '#imports';
import { useDisplay } from 'vuetify';

const { mobile } = useDisplay();
const currentYear = computed(() => new Date().getFullYear());
</script>

<style scoped>
.transparent-footer {
  background: rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-btn {
  color: rgba(255, 255, 255, 0.9) !important;
  transition: all 0.3s ease;
}

.footer-btn:hover {
  color: white !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

/* Ensure text is visible on transparent background */
:deep(.v-btn__content) {
  color: rgba(255, 255, 255, 0.9);
}

/* Mobile optimizations */
@media (max-width: 599px) {
  .footer-btn {
    min-height: 36px;
    font-size: 0.875rem;
  }
}

/* Touch device optimizations */
@media (max-width: 768px) and (pointer: coarse) {
  .footer-btn {
    min-height: 44px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .footer-btn {
    transition: none;
  }
}
</style>
