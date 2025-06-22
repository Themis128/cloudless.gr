<template>
  <section class="cta-section py-16">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="8" class="text-center">
          <v-card
            class="cta-card pa-12"
            elevation="16"
            rounded="xl"
          >
            <v-card-text>
              <!-- Main headline -->
              <h2 class="text-h3 text-md-h2 font-weight-bold mb-6">
                Ready to Build Without Code?
              </h2>
              
              <!-- Subheadline -->
              <p class="text-h6 text-grey-darken-2 mb-8 mx-auto" style="max-width: 500px;">
                Join thousands of creators who are already building powerful workflows 
                without writing a single line of code.
              </p>

              <!-- Value props -->
              <v-row justify="center" class="mb-8">
                <v-col cols="12" sm="4" class="text-center">
                  <v-icon
                    icon="mdi-timer-sand"
                    size="48"
                    class="mb-3 text-primary"
                  />
                  <div class="text-h6 font-weight-bold mb-2">
                    Setup in Minutes
                  </div>
                  <p class="text-body-2 text-grey-darken-2">
                    Start building immediately with our intuitive interface
                  </p>
                </v-col>
                <v-col cols="12" sm="4" class="text-center">
                  <v-icon
                    icon="mdi-credit-card-off"
                    size="48"
                    class="mb-3 text-primary"
                  />
                  <div class="text-h6 font-weight-bold mb-2">
                    No Credit Card
                  </div>
                  <p class="text-body-2 text-grey-darken-2">
                    Try all features free for 14 days, no strings attached
                  </p>
                </v-col>
                <v-col cols="12" sm="4" class="text-center">
                  <v-icon
                    icon="mdi-account-group"
                    size="48"
                    class="mb-3 text-primary"
                  />
                  <div class="text-h6 font-weight-bold mb-2">
                    Expert Support
                  </div>
                  <p class="text-body-2 text-grey-darken-2">
                    Get help from our team of workflow experts
                  </p>
                </v-col>
              </v-row>

              <!-- CTA Buttons -->
              <div class="d-flex flex-wrap justify-center gap-4 mb-8">
                <v-btn
                  color="primary"
                  size="x-large"
                  class="px-8 py-4"
                  prepend-icon="mdi-rocket-launch"
                  @click="startTrial"
                >
                  Start Free Trial
                </v-btn>
                <v-btn
                  variant="outlined"
                  size="x-large"
                  class="px-8 py-4"
                  prepend-icon="mdi-play-circle"
                  @click="watchDemo"
                >
                  Watch Demo
                </v-btn>
              </div>

              <!-- Trust indicators -->
              <div class="trust-indicators">
                <p class="text-body-2 text-grey-darken-2 mb-4">
                  Trusted by 10,000+ users worldwide
                </p>
                <v-row justify="center" align="center">
                  <v-col
                    v-for="indicator in trustIndicators"
                    :key="indicator.text"
                    cols="auto"
                    class="mx-2"
                  >
                    <div class="d-flex align-center">
                      <v-icon
                        :icon="indicator.icon"
                        size="20"
                        :color="indicator.color"
                        class="mr-2"
                      />
                      <span class="text-body-2 text-grey-darken-2">
                        {{ indicator.text }}
                      </span>
                    </div>
                  </v-col>
                </v-row>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Social proof -->
      <v-row justify="center" class="mt-12">
        <v-col cols="12" md="10" class="text-center">
          <p class="text-h6 mb-6 text-white">
            What happens when you start your free trial:
          </p>
          
          <v-timeline
            density="compact"
            align="center"
            class="trial-timeline"
          >
            <v-timeline-item
              v-for="(step, index) in trialSteps"
              :key="index"
              :dot-color="step.color"
              size="small"
            >
              <template #icon>
                <v-icon :icon="step.icon" size="small" />
              </template>
              <v-card class="trial-step-card" elevation="4" rounded="lg">
                <v-card-text class="pa-4">
                  <div class="text-h6 font-weight-bold mb-2">
                    {{ step.title }}
                  </div>
                  <p class="text-body-2 text-grey-darken-2 mb-0">
                    {{ step.description }}
                  </p>
                </v-card-text>
              </v-card>
            </v-timeline-item>
          </v-timeline>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<script setup lang="ts">
interface TrustIndicator {
  icon: string;
  text: string;
  color: string;
}

interface TrialStep {
  title: string;
  description: string;
  icon: string;
  color: string;
}

const trustIndicators: TrustIndicator[] = [
  {
    icon: 'mdi-shield-check',
    text: 'SOC 2 Compliant',
    color: 'success'
  },
  {
    icon: 'mdi-clock-fast',
    text: '99.9% Uptime',
    color: 'info'
  },
  {
    icon: 'mdi-heart',
    text: '4.9/5 Rating',
    color: 'error'
  },
  {
    icon: 'mdi-earth',
    text: '120+ Countries',
    color: 'primary'
  }
];

const trialSteps: TrialStep[] = [
  {
    title: 'Instant Access',
    description: 'Create your account and start building immediately - no setup required',
    icon: 'mdi-lightning-bolt',
    color: 'primary'
  },
  {
    title: 'Guided Tour',
    description: 'Follow our interactive tutorial to build your first workflow',
    icon: 'mdi-map',
    color: 'info'
  },
  {
    title: 'Expert Support',
    description: 'Get personalized help from our team to optimize your workflows',
    icon: 'mdi-account-supervisor',
    color: 'success'
  },
  {
    title: 'Go Live',
    description: 'Deploy your workflows to production with confidence',
    icon: 'mdi-rocket',
    color: 'warning'
  }
];

const startTrial = () => {
  window.location.href = '/auth?trial=true';
};

const watchDemo = () => {
  // In a real app, this might open a video modal or navigate to a demo page
  console.log('Opening demo...');
  window.location.href = '/demo';
};
</script>

<style scoped>
.cta-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.cta-section::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: float 20s linear infinite;
}

@keyframes float {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

.cta-card {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 1;
}

.cta-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 32px 64px rgba(0, 0, 0, 0.2) !important;
  transition: all 0.4s ease;
}

.gap-4 {
  gap: 16px;
}

.trust-indicators {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: 2rem;
  margin-top: 2rem;
}

.trial-timeline {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
}

.trial-step-card {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px);
  max-width: 300px;
  margin: 0 auto;
}

.trial-step-card:hover {
  transform: scale(1.02);
  transition: all 0.3s ease;
}

@media (max-width: 768px) {
  .cta-card {
    padding: 2rem !important;
  }
  
  .d-flex.flex-wrap.justify-center.gap-4 {
    flex-direction: column;
    align-items: center;
  }
  
  .d-flex.flex-wrap.justify-center.gap-4 .v-btn {
    width: 100%;
    max-width: 280px;
  }
  
  .trial-timeline {
    padding: 1rem;
  }
  
  .trial-step-card {
    max-width: 100%;
  }
}

/* Vuetify timeline responsive fixes */
@media (max-width: 960px) {
  :deep(.v-timeline) {
    padding-left: 0;
    padding-right: 0;
  }
  
  :deep(.v-timeline-item) {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
