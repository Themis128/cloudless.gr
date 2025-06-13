<template>
  <VApp>
    <client-only>
      <Suspense>
        <template #default>
          <VantaBackground />
        </template>
        <template #fallback>
          <div class="fallback-bg" />
        </template>
      </Suspense>
    </client-only>
    <div class="content-container">
      <VMain class="main-content">
        <v-container class="text-center about-glass">
          <v-row>
            <v-col>
              <h1 class="vanta-sky mb-4">About Cloudless</h1>
              <!-- Introduction -->
              <p class="about-main-text mb-4">
                Cloudless is a modular LLM platform built with Nuxt 3, Vuetify 3, and Supabase, designed to empower users and teams with secure, accessible, and customizable AI tools.
              </p>

              <!-- Mission -->
              <h2 class="about-section-title">Our Mission</h2>
              <p class="about-section-text mb-4">
                To make advanced language models and cloud-based AI accessible, ethical, and easy to use for everyone.
              </p>

              <!-- Features -->
              <h2 class="about-section-title">Key Features</h2>
              <ul class="about-section-text mb-4 text-left mx-auto about-features-list" style="max-width:600px;">
                <li>🔒 Secure, per-user storage and authentication</li>
                <li>🎨 Modern, accessible UI with theme and accessibility controls</li>
                <li>🧩 Modular architecture for easy extension</li>
                <li>⚡ Real-time collaboration and data sync</li>
                <li>📊 Integrated analytics and reporting</li>
                <li>🤖 LLM-powered tools and workflows</li>
              </ul>

              <!-- History -->
              <h2 class="about-section-title">Our Story</h2>
              <p class="about-section-text mb-4">
                Cloudless GR was started in 2025 by a team of passionate developers and AI enthusiasts who wanted to bridge the gap between powerful language models and real-world business needs. Our platform is built on open standards and a commitment to privacy and transparency.
              </p>

              <!-- Team -->
              <h2 class="about-section-title">Meet the Team</h2>
              <div class="about-team mb-4">
                <div class="about-team-member">
                  <v-avatar size="64" class="mb-2"><v-icon size="64">mdi-account-circle</v-icon></v-avatar>
                  <div class="font-weight-bold">Alex Papadopoulos</div>
                  <div class="text-caption">Founder & Lead Developer</div>
                </div>
                <div class="about-team-member">
                  <v-avatar size="64" class="mb-2"><v-icon size="64">mdi-account-circle</v-icon></v-avatar>
                  <div class="font-weight-bold">Maria Ioannou</div>
                  <div class="text-caption">AI Research & UX</div>
                </div>
                <div class="about-team-member">
                  <v-avatar size="64" class="mb-2"><v-icon size="64">mdi-account-circle</v-icon></v-avatar>
                  <div class="font-weight-bold">Nikos Georgiadis</div>
                  <div class="text-caption">Cloud & Security</div>
                </div>
              </div>
            </v-col>
          </v-row>
        </v-container>
        <div class="about-contact-bottom">
          <ContactUs />
        </div>
      </VMain>
    </div>
  </VApp>
</template>

<script setup lang="ts">
import VantaBackground from '@/components/Base/VantaBackground.vue'
import ContactUs from '@/components/ContactUs.vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faTwitter, faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons'
import { useContactInfo } from '@/composables/useContactInfo'
import { computed } from 'vue'
const contact = useContactInfo()
const iconMap = { faTwitter, faGithub, faLinkedin }
const socialWithIcons = computed(() => contact.social.map(item => ({
  ...item,
  iconObj: iconMap[item.icon as keyof typeof iconMap]
})))
definePageMeta({ layout: 'default' })
</script>

<style scoped>
.fallback-bg {
  height: 100vh;
  width: 100vw;
  background-color: #7ec0ee;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 0;
}
.content-container {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.main-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}
.about-glass {
  background: rgba(255,255,255,0.35); /* More transparent glass effect */
  border-radius: 24px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 2.5rem 2rem 2rem 2rem;
  margin-top: 2vh;
  margin-bottom: 2vh;
  min-height: 66vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
}
.about-main-text {
  color: #1a2233;
  font-size: 1.25rem;
  font-weight: 500;
  text-shadow: 0 1px 2px #fff8, 0 2px 8px #5ca6ca22;
}
.about-section-title {
  color: #1976d2;
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
  letter-spacing: 0.5px;
}
.about-section-text {
  color: #222;
  font-size: 1.1rem;
  font-weight: 400;
  line-height: 1.7;
}
.about-features-list li {
  color: #1976d2;
  font-weight: 600;
  margin-bottom: 0.25rem;
  text-shadow: 0 1px 2px #fff8;
}
.about-link {
  color: #1976d2;
  text-decoration: underline;
  font-weight: 600;
}
.about-team {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2.5rem 2rem;
  margin-bottom: 2rem;
}
.about-team-member {
  background: rgba(255,255,255,0.7);
  border-radius: 16px;
  box-shadow: 0 2px 8px #0001;
  padding: 1.25rem 1.5rem 1rem 1.5rem;
  min-width: 180px;
  max-width: 220px;
  text-align: center;
  color: #222;
  font-weight: 500;
}
.vanta-sky {
  color: #1976d2;
  text-shadow:
    1px 1px 2px #fff8,
    2px 2px 4px #000a,
    0 4px 12px #000a,
    0 1px 0 #fff8,
    0 0 16px #1976d288;
  letter-spacing: 1px;
  font-weight: 900;
  font-size: 3rem;
}
.fa-social {
  width: 32px;
  height: 32px;
  vertical-align: middle;
}
.about-contact-bottom {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  margin-top: 2vh;
  margin-bottom: 2vh;
}
</style>
