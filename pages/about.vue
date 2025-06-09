<template>
  <v-container class="pa-0">
    <!-- Hero Section -->
    <v-row justify="center" class="mb-8">
      <v-col cols="12">
        <v-card
          elevation="8"
          rounded="xl"
          color="rgba(255, 255, 255, 0.95)"
          class="pa-8 text-center"
        >
          <v-card-text>
            <h1 class="text-h2 text-primary font-weight-bold mb-6">About Cloudless</h1>
            <p class="text-h6 text-medium-emphasis mx-auto" style="max-width: 700px">
              We are a forward-thinking development team specializing in modern web technologies,
              creating innovative solutions that empower businesses and developers worldwide.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Story Section -->
    <v-row justify="center" class="mb-8">
      <v-col cols="12">
        <v-card elevation="8" rounded="xl" color="rgba(255, 255, 255, 0.95)" class="pa-8">
          <v-card-title class="text-h3 text-primary font-weight-bold mb-4">
            Our Story
          </v-card-title>
          <v-card-text>
            <p class="text-body-1 text-medium-emphasis mb-4" style="line-height: 1.7">
              Founded with a vision to revolutionize web development, Cloudless emerged from the
              understanding that modern applications need to be fast, secure, and scalable. We
              believe in building solutions that not only meet today's requirements but anticipate
              tomorrow's challenges.
            </p>
            <p class="text-body-1 text-medium-emphasis" style="line-height: 1.7">
              Our journey began with a simple mission: to create development tools and frameworks
              that make building robust web applications accessible to everyone, from startups to
              enterprise organizations.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Values Section -->
    <v-row justify="center" class="mb-8">
      <v-col cols="12">
        <h2 class="text-h3 text-primary font-weight-bold mb-6 text-center">Our Values</h2>
        <v-row>
          <v-col v-for="value in values" :key="value.title" cols="12" sm="6" lg="3">
            <v-card
              elevation="8"
              rounded="xl"
              color="rgba(255, 255, 255, 0.95)"
              class="pa-6 text-center h-100"
              hover
            >
              <v-card-text>
                <div class="text-h2 mb-4">{{ value.icon }}</div>
                <h3 class="text-h5 text-primary font-weight-bold mb-4">{{ value.title }}</h3>
                <p class="text-body-2 text-medium-emphasis">{{ value.description }}</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!-- Expertise Section -->
    <v-row justify="center" class="mb-8">
      <v-col cols="12">
        <h2 class="text-h3 text-primary font-weight-bold mb-6 text-center">Our Expertise</h2>
        <v-row>
          <v-col v-for="expertise in expertiseAreas" :key="expertise.title" cols="12" md="4">
            <v-card elevation="8" rounded="xl" color="rgba(255, 255, 255, 0.95)" class="pa-6 h-100">
              <v-card-title class="text-h5 text-primary font-weight-bold mb-3">
                {{ expertise.title }}
              </v-card-title>
              <v-card-text>
                <p class="text-body-2 text-medium-emphasis mb-4" style="line-height: 1.6">
                  {{ expertise.description }}
                </p>
                <div class="d-flex flex-wrap ga-2">
                  <v-chip
                    v-for="tech in expertise.technologies"
                    :key="tech"
                    size="small"
                    color="primary"
                    variant="outlined"
                  >
                    {{ tech }}
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!-- Team Approach Section -->
    <v-row justify="center" class="mb-8">
      <v-col cols="12">
        <v-card elevation="8" rounded="xl" color="rgba(255, 255, 255, 0.95)" class="pa-8">
          <v-card-title class="text-h3 text-primary font-weight-bold mb-4">
            Our Approach
          </v-card-title>
          <v-card-text>
            <p class="text-body-1 text-medium-emphasis mb-4" style="line-height: 1.7">
              We believe in agile development methodologies, continuous integration, and test-driven
              development. Our team combines technical expertise with creative problem-solving to
              deliver solutions that exceed expectations.
            </p>
            <p class="text-body-1 text-medium-emphasis" style="line-height: 1.7">
              Every project we undertake is approached with careful planning, iterative development,
              and close collaboration with our clients to ensure the final product aligns perfectly
              with their vision and goals.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Contact CTA Section -->
    <v-row justify="center">
      <v-col cols="12">
        <v-card
          elevation="8"
          rounded="xl"
          color="rgba(255, 255, 255, 0.95)"
          class="pa-8 text-center"
        >
          <v-card-text>
            <h2 class="text-h3 text-primary font-weight-bold mb-4">Let's Work Together</h2>
            <p class="text-body-1 text-medium-emphasis mb-6 mx-auto" style="max-width: 600px">
              Ready to bring your next project to life? We'd love to hear about your ideas and
              discuss how we can help make them a reality.
            </p>
            <v-btn
              to="/contact"
              color="primary"
              size="large"
              rounded="lg"
              variant="elevated"
              prepend-icon="mdi-email"
            >
              Start a Conversation
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  // Set page meta
  definePageMeta({
    layout: 'default',
  });

  // Set page title and meta
  useHead({
    title: 'About Cloudless - Our Story and Values',
    meta: [
      {
        name: 'description',
        content:
          'Learn about Cloudless - our story, values, expertise in modern web development, and our approach to building innovative solutions.',
      },
    ],
  });

  // Values data
  const values = [
    {
      icon: '🚀',
      title: 'Innovation',
      description:
        "We constantly push the boundaries of what's possible, embracing new technologies and methodologies to deliver cutting-edge solutions.",
    },
    {
      icon: '🔒',
      title: 'Security',
      description:
        'Security is at the core of everything we build. We implement industry best practices to protect data and ensure user privacy.',
    },
    {
      icon: '⚡',
      title: 'Performance',
      description:
        'We optimize every aspect of our applications for speed and efficiency, ensuring excellent user experiences across all devices.',
    },
    {
      icon: '🤝',
      title: 'Collaboration',
      description:
        'We work closely with our clients and the developer community, fostering open communication and shared success.',
    },
  ];

  // Expertise areas data
  const expertiseAreas = [
    {
      title: 'Frontend Development',
      description:
        'Modern JavaScript frameworks including Vue.js, Nuxt.js, and React for creating responsive, interactive user interfaces.',
      technologies: ['Vue.js', 'Nuxt.js', 'TypeScript', 'Vuetify'],
    },
    {
      title: 'Backend Development',
      description:
        'Scalable server-side solutions with Node.js, API development, database design, and cloud integrations.',
      technologies: ['Node.js', 'Prisma', 'PostgreSQL', 'REST APIs'],
    },
    {
      title: 'DevOps & Infrastructure',
      description:
        'Modern deployment strategies, containerization, CI/CD pipelines, and cloud infrastructure management.',
      technologies: ['Docker', 'GitHub Actions', 'Vercel', 'AWS'],
    },
  ];
</script>
