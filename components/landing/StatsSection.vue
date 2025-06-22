<template>
  <section class="stats-section py-16">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" class="text-center mb-8">
          <h2 class="text-h3 font-weight-bold mb-4 text-white">
            Trusted by Thousands
          </h2>
          <p class="text-h6 text-grey-lighten-2">
            Join the growing community of creators and businesses
          </p>
        </v-col>
      </v-row>
      
      <v-row justify="center" align="center">
        <v-col
          v-for="stat in stats"
          :key="stat.label"
          cols="6"
          md="3"
          class="text-center"
        >
          <div class="stat-item">
            <v-icon
              :icon="stat.icon"
              size="48"
              class="mb-4 text-primary"
            />
            <div class="stat-number text-h3 font-weight-bold text-white mb-2">
              {{ animatedNumbers[stat.key] }}{{ stat.suffix }}
            </div>
            <div class="stat-label text-body-1 text-grey-lighten-2">
              {{ stat.label }}
            </div>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface Stat {
  key: string;
  value: number;
  label: string;
  icon: string;
  suffix?: string;
}

const stats: Stat[] = [
  {
    key: 'users',
    value: 10000,
    label: 'Active Users',
    icon: 'mdi-account-group',
    suffix: '+'
  },
  {
    key: 'projects',
    value: 50000,
    label: 'Projects Created',
    icon: 'mdi-rocket-launch',
    suffix: '+'
  },
  {
    key: 'uptime',
    value: 99.9,
    label: 'Uptime',
    icon: 'mdi-shield-check',
    suffix: '%'
  },
  {
    key: 'countries',
    value: 120,
    label: 'Countries',
    icon: 'mdi-earth',
    suffix: '+'
  }
];

const animatedNumbers = ref<Record<string, number>>({
  users: 0,
  projects: 0,
  uptime: 0,
  countries: 0
});

const animateNumber = (key: string, target: number, duration = 2000) => {
  const start = performance.now();
  const animate = (currentTime: number) => {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    
    if (key === 'uptime') {
      animatedNumbers.value[key] = Number((target * easedProgress).toFixed(1));
    } else {
      animatedNumbers.value[key] = Math.floor(target * easedProgress);
    }
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  requestAnimationFrame(animate);
};

onMounted(() => {
  // Start animations with slight delays for effect
  stats.forEach((stat, index) => {
    setTimeout(() => {
      animateNumber(stat.key, stat.value);
    }, index * 200);
  });
});
</script>

<style scoped>
.stats-section {
  background: linear-gradient(135deg, rgba(103, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  backdrop-filter: blur(10px);
}

.stat-item {
  padding: 2rem 1rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.stat-item:hover {
  transform: translateY(-8px);
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.stat-number {
  background: linear-gradient(45deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@media (max-width: 768px) {
  .stat-item {
    padding: 1.5rem 1rem;
  }
  
  .stat-number {
    font-size: 2rem !important;
  }
}
</style>
