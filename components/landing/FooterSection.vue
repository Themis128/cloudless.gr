<template>
  <footer class="footer-section">
    <v-container>
      <!-- Main footer content -->
      <v-row class="py-12">
        <!-- Company info -->
        <v-col cols="12" md="4" class="mb-8">
          <div class="footer-brand mb-6">
            <h3 class="text-h4 font-weight-bold text-white mb-3">
              Cloudless.gr
            </h3>
            <p class="text-body-1 text-grey-lighten-2 mb-4">
              Power without the code. Build advanced workflows and analytics 
              pipelines with our intuitive no-code platform.
            </p>
          </div>
          
          <!-- Social links -->
          <div class="social-links">
            <v-btn
              v-for="social in socialLinks"
              :key="social.name"
              :icon="social.icon"
              :href="social.url"
              target="_blank"
              variant="text"
              color="white"
              class="mr-2"
              :aria-label="social.name"
            />
          </div>
        </v-col>

        <!-- Product links -->
        <v-col cols="6" md="2" class="mb-8">
          <h4 class="text-h6 font-weight-bold text-white mb-4">
            Product
          </h4>
          <v-list class="bg-transparent" density="compact">
            <v-list-item
              v-for="link in productLinks"
              :key="link.text"
              :href="link.url"
              class="px-0 text-grey-lighten-2 footer-link"
            >
              {{ link.text }}
            </v-list-item>
          </v-list>
        </v-col>

        <!-- Resources links -->
        <v-col cols="6" md="2" class="mb-8">
          <h4 class="text-h6 font-weight-bold text-white mb-4">
            Resources
          </h4>
          <v-list class="bg-transparent" density="compact">
            <v-list-item
              v-for="link in resourceLinks"
              :key="link.text"
              :href="link.url"
              class="px-0 text-grey-lighten-2 footer-link"
            >
              {{ link.text }}
            </v-list-item>
          </v-list>
        </v-col>

        <!-- Company links -->
        <v-col cols="6" md="2" class="mb-8">
          <h4 class="text-h6 font-weight-bold text-white mb-4">
            Company
          </h4>
          <v-list class="bg-transparent" density="compact">
            <v-list-item
              v-for="link in companyLinks"
              :key="link.text"
              :href="link.url"
              class="px-0 text-grey-lighten-2 footer-link"
            >
              {{ link.text }}
            </v-list-item>
          </v-list>
        </v-col>

        <!-- Newsletter signup -->
        <v-col cols="12" md="2" class="mb-8">
          <h4 class="text-h6 font-weight-bold text-white mb-4">
            Stay Updated
          </h4>
          <p class="text-body-2 text-grey-lighten-2 mb-4">
            Get the latest updates and insights delivered to your inbox.
          </p>
          
          <v-form class="newsletter-form" @submit.prevent="subscribeNewsletter">
            <v-text-field
              v-model="email"
              label="Email address"
              type="email"
              variant="outlined"
              density="compact"
              :rules="emailRules"
              class="mb-3"
              hide-details="auto"
            />
            <v-btn
              type="submit"
              color="primary"
              block
              size="small"
              :loading="subscribing"
              prepend-icon="mdi-email-outline"
            >
              Subscribe
            </v-btn>
          </v-form>
        </v-col>
      </v-row>

      <v-divider class="border-opacity-25" />

      <!-- Bottom footer -->
      <v-row class="py-6" align="center">
        <v-col cols="12" md="6">
          <p class="text-body-2 text-grey-lighten-2 mb-0">
            © {{ currentYear }} Cloudless.gr. All rights reserved.
          </p>
        </v-col>
        
        <v-col cols="12" md="6" class="text-md-right">
          <div class="d-flex flex-wrap justify-md-end">
            <a
              v-for="(link, index) in legalLinks"
              :key="link.text"
              :href="link.url"
              class="text-grey-lighten-2 text-decoration-none footer-legal-link"
              :class="{ 'mr-4': index < legalLinks.length - 1 }"
            >
              {{ link.text }}
            </a>
          </div>
        </v-col>
      </v-row>

      <!-- Status indicator -->
      <v-row class="py-4">
        <v-col cols="12" class="text-center">
          <div class="status-indicator">
            <v-chip
              color="success"
              size="small"
              prepend-icon="mdi-check-circle"
            >
              All systems operational
            </v-chip>
            <a
              href="/status"
              class="text-grey-lighten-2 text-decoration-none ml-3 text-body-2"
            >
              View status page
            </a>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </footer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface FooterLink {
  text: string;
  url: string;
}

interface SocialLink {
  name: string;
  icon: string;
  url: string;
}

const email = ref('');
const subscribing = ref(false);

const currentYear = computed(() => new Date().getFullYear());

const emailRules = [
  (v: string) => !!v || 'Email is required',
  (v: string) => /.+@.+\..+/.test(v) || 'Email must be valid'
];

const socialLinks: SocialLink[] = [
  {
    name: 'Twitter',
    icon: 'mdi-twitter',
    url: 'https://twitter.com/cloudless'
  },
  {
    name: 'LinkedIn',
    icon: 'mdi-linkedin',
    url: 'https://linkedin.com/company/cloudless'
  },
  {
    name: 'GitHub',
    icon: 'mdi-github',
    url: 'https://github.com/cloudless'
  },
  {
    name: 'Discord',
    icon: 'mdi-discord',
    url: 'https://discord.gg/cloudless'
  }
];

const productLinks: FooterLink[] = [
  { text: 'Features', url: '/#features' },
  { text: 'Pricing', url: '/#pricing' },
  { text: 'Demo', url: '/demo' },
  { text: 'Integrations', url: '/integrations' },
  { text: 'Templates', url: '/templates' },
  { text: 'API', url: '/api' }
];

const resourceLinks: FooterLink[] = [
  { text: 'Documentation', url: '/documentation' },
  { text: 'Blog', url: '/blog' },
  { text: 'Community', url: '/community' },
  { text: 'Support', url: '/support' },
  { text: 'Changelog', url: '/changelog' },
  { text: 'Status', url: '/status' }
];

const companyLinks: FooterLink[] = [
  { text: 'About', url: '/about' },
  { text: 'Careers', url: '/careers' },
  { text: 'Contact', url: '/contact' },
  { text: 'Partners', url: '/partners' },
  { text: 'Press', url: '/press' },
  { text: 'Security', url: '/security' }
];

const legalLinks: FooterLink[] = [
  { text: 'Privacy Policy', url: '/privacy' },
  { text: 'Terms of Service', url: '/terms' },
  { text: 'Cookie Policy', url: '/cookies' },
  { text: 'GDPR', url: '/gdpr' }
];

const subscribeNewsletter = async () => {
  if (!email.value || !/.+@.+\..+/.test(email.value)) {
    return;
  }

  subscribing.value = true;
  
  try {
    // In a real app, this would make an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Show success message
    console.log('Subscribed:', email.value);
    email.value = '';
    
    // You might want to show a toast notification here
  } catch (error) {
    console.error('Subscription failed:', error);
  } finally {
    subscribing.value = false;
  }
};
</script>

<style scoped>
.footer-section {
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  color: white;
  position: relative;
  overflow: hidden;
}

.footer-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
}

.footer-brand {
  max-width: 300px;
}

.social-links .v-btn {
  transition: all 0.3s ease;
}

.social-links .v-btn:hover {
  transform: translateY(-2px);
  background-color: rgba(255, 255, 255, 0.1);
}

.footer-link {
  transition: all 0.3s ease;
  cursor: pointer;
}

.footer-link:hover {
  color: white !important;
  transform: translateX(4px);
}

.footer-legal-link {
  transition: all 0.3s ease;
  font-size: 0.875rem;
}

.footer-legal-link:hover {
  color: white !important;
}

.newsletter-form :deep(.v-field) {
  background-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.newsletter-form :deep(.v-field--focused) {
  background-color: rgba(255, 255, 255, 0.15);
}

.newsletter-form :deep(.v-label) {
  color: rgba(255, 255, 255, 0.7) !important;
}

.newsletter-form :deep(.v-field__input) {
  color: white !important;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .footer-section .v-col {
    text-align: center;
  }
  
  .social-links {
    justify-content: center;
    display: flex;
  }
  
  .status-indicator {
    flex-direction: column;
    gap: 8px;
  }
  
  .footer-legal-link {
    display: block;
    margin-bottom: 8px;
  }
  
  .footer-legal-link:last-child {
    margin-bottom: 0;
  }
}

/* Accessibility improvements */
.footer-link:focus,
.footer-legal-link:focus {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Print styles */
@media print {
  .footer-section {
    background: white !important;
    color: black !important;
  }
  
  .social-links,
  .newsletter-form {
    display: none;
  }
}
</style>
