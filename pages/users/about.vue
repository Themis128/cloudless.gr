<template>
  <v-container class="users-about-page" fluid>
    <div class="page-header mb-8">
      <v-row align="center" justify="center" class="text-center">
        <v-col cols="12" md="8">
          <v-img
            src="/logo.png"
            alt="Cloudless Logo"
            max-width="120"
            class="mx-auto mb-4"
          />
          <h1 class="text-h2 font-weight-bold primary--text mb-4">
            About Cloudless
          </h1>
          <p class="text-h6 text-grey-darken-1 mb-6">
            Empowering developers to build amazing applications without the complexity of cloud infrastructure
          </p>
          <v-chip
            color="primary"
            size="large"
            variant="flat"
            prepend-icon="mdi-rocket"
          >
            Version {{ appVersion }}
          </v-chip>
        </v-col>
      </v-row>
    </div>

    <v-row class="mb-8">
      <!-- Mission -->
      <v-col cols="12" md="6">
        <v-card class="h-100">
          <v-card-title class="d-flex align-center">
            <v-icon color="primary" class="mr-3">mdi-target</v-icon>
            Our Mission
          </v-card-title>
          <v-card-text>
            <p>
              We believe that great software should be accessible to everyone. Our mission is to remove the barriers
              between developers and their ideas by providing a platform that's powerful yet simple to use.
            </p>
            <p class="mb-0">
              Whether you're building your first app or scaling enterprise solutions, Cloudless provides the tools
              and infrastructure you need to focus on what matters most: creating exceptional user experiences.
            </p>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Vision -->
      <v-col cols="12" md="6">
        <v-card class="h-100">
          <v-card-title class="d-flex align-center">
            <v-icon color="primary" class="mr-3">mdi-eye</v-icon>
            Our Vision
          </v-card-title>
          <v-card-text>
            <p>
              To democratize software development by making advanced cloud technologies accessible, affordable,
              and easy to use for developers of all skill levels.
            </p>
            <p class="mb-0">
              We envision a world where the complexity of infrastructure doesn't limit innovation, where developers
              can bring their ideas to life quickly and efficiently, and where the tools we use enhance rather than
              hinder our creativity.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Features -->
    <v-card class="mb-8">
      <v-card-title class="text-center text-h4 py-6">
        <v-icon color="primary" size="large" class="mr-3">mdi-star</v-icon>
        Platform Features
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col
            v-for="feature in features"
            :key="feature.title"
            cols="12"
            md="6"
            lg="4"
          >
            <div class="feature-item text-center pa-4">
              <v-icon
                :color="feature.color"
                size="64"
                class="mb-4"
              >
                {{ feature.icon }}
              </v-icon>
              <h3 class="text-h6 mb-2">{{ feature.title }}</h3>
              <p class="text-body-2 text-grey-darken-1 mb-0">
                {{ feature.description }}
              </p>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Statistics -->
    <v-card class="mb-8">
      <v-card-title class="text-center text-h4 py-6">
        <v-icon color="primary" size="large" class="mr-3">mdi-chart-line</v-icon>
        Platform Statistics
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col
            v-for="stat in statistics"
            :key="stat.label"
            cols="6"
            md="3"
            class="text-center"
          >
            <div class="stat-item pa-4">
              <h2 class="text-h3 font-weight-bold primary--text mb-2">
                {{ stat.value }}
              </h2>
              <p class="text-body-1 text-grey-darken-1 mb-0">
                {{ stat.label }}
              </p>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Team -->
    <v-card class="mb-8">
      <v-card-title class="text-center text-h4 py-6">
        <v-icon color="primary" size="large" class="mr-3">mdi-account-group</v-icon>
        Meet the Team
      </v-card-title>
      <v-card-text>
        <v-row justify="center">
          <v-col
            v-for="member in teamMembers"
            :key="member.name"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <v-card class="team-member-card text-center pa-4">
              <v-avatar
                size="80"
                class="mb-4"
              >
                <v-img
                  :src="member.avatar"
                  :alt="member.name"
                />
              </v-avatar>
              <h3 class="text-h6 mb-1">{{ member.name }}</h3>
              <p class="text-body-2 text-primary mb-2">{{ member.role }}</p>
              <p class="text-caption text-grey-darken-1 mb-3">
                {{ member.bio }}
              </p>
              <div class="d-flex justify-center">
                <v-btn
                  v-for="social in member.social"
                  :key="social.platform"
                  :icon="social.icon"
                  :href="social.url"
                  target="_blank"
                  variant="text"
                  size="small"
                  class="mx-1"
                />
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Technology Stack -->
    <v-card class="mb-8">
      <v-card-title class="text-center text-h4 py-6">
        <v-icon color="primary" size="large" class="mr-3">mdi-code-tags</v-icon>
        Technology Stack
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col
            v-for="category in techStack"
            :key="category.name"
            cols="12"
            md="6"
            lg="4"
          >
            <div class="tech-category pa-4">
              <h3 class="text-h6 mb-3 d-flex align-center">
                <v-icon :color="category.color" class="mr-2">{{ category.icon }}</v-icon>
                {{ category.name }}
              </h3>
              <v-chip-group>
                <v-chip
                  v-for="tech in category.technologies"
                  :key="tech"
                  size="small"
                  variant="outlined"
                  :color="category.color"
                >
                  {{ tech }}
                </v-chip>
              </v-chip-group>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Contact Information -->
    <v-card class="mb-8">
      <v-card-title class="text-center text-h4 py-6">
        <v-icon color="primary" size="large" class="mr-3">mdi-contact-mail</v-icon>
        Get in Touch
      </v-card-title>
      <v-card-text>
        <v-row justify="center">
          <v-col cols="12" md="8">
            <v-row>
              <v-col
                v-for="contact in contactInfo"
                :key="contact.type"
                cols="12"
                sm="6"
                md="4"
              >
                <div class="contact-item text-center pa-4">
                  <v-icon
                    :color="contact.color"
                    size="48"
                    class="mb-3"
                  >
                    {{ contact.icon }}
                  </v-icon>
                  <h3 class="text-h6 mb-2">{{ contact.type }}</h3>
                  <p class="text-body-2 mb-3">{{ contact.description }}</p>
                  <v-btn
                    :color="contact.color"
                    :href="contact.link"
                    target="_blank"
                    variant="outlined"
                  >
                    {{ contact.action }}
                  </v-btn>
                </div>
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Legal & Links -->
    <v-card>
      <v-card-text class="text-center">
        <v-row justify="center">
          <v-col cols="12" md="8">
            <div class="d-flex justify-center flex-wrap mb-4">
              <v-btn
                v-for="link in legalLinks"
                :key="link.text"
                :to="link.to"
                variant="text"
                class="mx-2 mb-2"
              >
                {{ link.text }}
              </v-btn>
            </div>
            <v-divider class="mb-4" />
            <p class="text-body-2 text-grey-darken-1 mb-2">
              Built with ❤️ by the Cloudless team
            </p>
            <p class="text-caption text-grey-darken-2">
              © {{ currentYear }} Cloudless. All rights reserved.
            </p>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'

definePageMeta({
  layout: 'user',
})

// App information
const appVersion = '1.2.0'
const currentYear = computed(() => new Date().getFullYear())

// Platform features
const features = [
  {
    title: 'Zero Configuration',
    description: 'Get started instantly without complex setup or configuration files',
    icon: 'mdi-rocket-launch',
    color: 'primary'
  },
  {
    title: 'Auto Scaling',
    description: 'Automatically scale your applications based on demand',
    icon: 'mdi-chart-timeline-variant',
    color: 'success'
  },
  {
    title: 'Global CDN',
    description: 'Lightning-fast content delivery worldwide',
    icon: 'mdi-earth',
    color: 'info'
  },
  {
    title: 'Real-time Monitoring',
    description: 'Monitor your applications with detailed analytics and alerts',
    icon: 'mdi-monitor-dashboard',
    color: 'warning'
  },
  {
    title: 'Secure by Default',
    description: 'Enterprise-grade security built into every layer',
    icon: 'mdi-shield-check',
    color: 'success'
  },
  {
    title: '24/7 Support',
    description: 'Get help when you need it with our dedicated support team',
    icon: 'mdi-help-circle',
    color: 'secondary'
  }
]

// Platform statistics
const statistics = [
  { value: '10K+', label: 'Active Users' },
  { value: '50K+', label: 'Projects Deployed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '150+', label: 'Countries Served' }
]

// Team members
const teamMembers = [
  {
    name: 'Alex Johnson',
    role: 'CEO & Founder',
    bio: 'Passionate about democratizing technology and making development accessible to everyone.',
    avatar: 'https://via.placeholder.com/80/1976D2/FFFFFF?text=AJ',
    social: [
      { platform: 'LinkedIn', icon: 'mdi-linkedin', url: '#' },
      { platform: 'Twitter', icon: 'mdi-twitter', url: '#' }
    ]
  },
  {
    name: 'Sarah Chen',
    role: 'CTO',
    bio: 'Full-stack engineer with expertise in scalable cloud infrastructure and developer tools.',
    avatar: 'https://via.placeholder.com/80/E91E63/FFFFFF?text=SC',
    social: [
      { platform: 'LinkedIn', icon: 'mdi-linkedin', url: '#' },
      { platform: 'GitHub', icon: 'mdi-github', url: '#' }
    ]
  },
  {
    name: 'Mike Rodriguez',
    role: 'Head of Product',
    bio: 'Product strategist focused on creating intuitive experiences for developers.',
    avatar: 'https://via.placeholder.com/80/4CAF50/FFFFFF?text=MR',
    social: [
      { platform: 'LinkedIn', icon: 'mdi-linkedin', url: '#' },
      { platform: 'Twitter', icon: 'mdi-twitter', url: '#' }
    ]
  },
  {
    name: 'Emily Davis',
    role: 'Head of Design',
    bio: 'UX/UI designer passionate about creating beautiful and functional interfaces.',
    avatar: 'https://via.placeholder.com/80/FF9800/FFFFFF?text=ED',
    social: [
      { platform: 'LinkedIn', icon: 'mdi-linkedin', url: '#' },
      { platform: 'Dribbble', icon: 'mdi-dribbble', url: '#' }
    ]
  }
]

// Technology stack
const techStack = [
  {
    name: 'Frontend',
    icon: 'mdi-monitor',
    color: 'primary',
    technologies: ['Vue.js', 'Nuxt.js', 'TypeScript', 'Vuetify', 'Pinia']
  },
  {
    name: 'Backend',
    icon: 'mdi-server',
    color: 'success',
    technologies: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'GraphQL']
  },
  {
    name: 'Infrastructure',
    icon: 'mdi-cloud',
    color: 'info',
    technologies: ['Docker', 'Kubernetes', 'AWS', 'Terraform', 'Jenkins']
  },
  {
    name: 'Monitoring',
    icon: 'mdi-chart-line',
    color: 'warning',
    technologies: ['Prometheus', 'Grafana', 'ELK Stack', 'Jaeger', 'Sentry']
  },
  {
    name: 'Security',
    icon: 'mdi-shield',
    color: 'error',
    technologies: ['OAuth 2.0', 'JWT', 'SSL/TLS', 'Vault', 'OWASP']
  },
  {
    name: 'Development',
    icon: 'mdi-code-tags',
    color: 'secondary',
    technologies: ['Git', 'GitHub Actions', 'ESLint', 'Prettier', 'Jest']
  }
]

// Contact information
const contactInfo = [
  {
    type: 'Support',
    description: 'Get help with technical issues and questions',
    icon: 'mdi-help-circle',
    color: 'primary',
    action: 'Contact Support',
    link: 'mailto:support@cloudless.dev'
  },
  {
    type: 'Sales',
    description: 'Learn about our enterprise solutions',
    icon: 'mdi-briefcase',
    color: 'success',
    action: 'Contact Sales',
    link: 'mailto:sales@cloudless.dev'
  },
  {
    type: 'Community',
    description: 'Join our developer community',
    icon: 'mdi-account-group',
    color: 'info',
    action: 'Join Discord',
    link: 'https://discord.gg/cloudless'
  }
]

// Legal links
const legalLinks = [
  { text: 'Privacy Policy', to: '/legal/privacy' },
  { text: 'Terms of Service', to: '/legal/terms' },
  { text: 'Cookie Policy', to: '/legal/cookies' },
  { text: 'Security', to: '/legal/security' }
]
</script>

<style scoped>
.users-about-page {
  max-width: 1200px;
  margin: 0 auto;
}

.feature-item {
  transition: all 0.3s ease;
  border-radius: 12px;
}

.feature-item:hover {
  transform: translateY(-4px);
  background: rgba(var(--v-theme-surface), 0.5);
}

.stat-item {
  transition: all 0.3s ease;
}

.stat-item:hover {
  transform: scale(1.05);
}

.team-member-card {
  transition: all 0.3s ease;
  height: 100%;
}

.team-member-card:hover {
  transform: translateY(-8px);
}

.tech-category {
  border-radius: 12px;
  transition: all 0.3s ease;
}

.tech-category:hover {
  background: rgba(var(--v-theme-surface), 0.5);
}

.contact-item {
  transition: all 0.3s ease;
  border-radius: 12px;
}

.contact-item:hover {
  transform: translateY(-4px);
  background: rgba(var(--v-theme-surface), 0.5);
}

.v-card {
  transition: all 0.3s ease;
}

.v-card:hover {
  transform: translateY(-2px);
}
</style>
