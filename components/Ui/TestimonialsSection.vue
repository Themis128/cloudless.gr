<template>
  <v-container fluid class="py-12">
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <div class="text-center mb-8">
          <h2 class="text-h3 font-weight-bold mb-4">Client Testimonials</h2>
          <p class="text-h6 text-medium-emphasis">What clients say about working with Cloudless</p>
        </div>

        <v-carousel
          v-if="testimonials.length > 0"
          v-model="currentTestimonial"
          height="auto"
          hide-delimiter-background
          show-arrows="hover"
          cycle
          interval="6000"
          class="testimonials-carousel"
        >
          <v-carousel-item v-for="(testimonial, index) in testimonials" :key="index" class="pa-4">
            <v-card
              class="testimonial-card mx-auto"
              max-width="800"
              elevation="0"
              color="transparent"
            >
              <v-card-text class="text-center pa-8">
                <v-icon size="48" color="primary" class="mb-4"> mdi-format-quote-open </v-icon>

                <blockquote class="text-h5 font-weight-light mb-6 text-high-emphasis">
                  "{{ testimonial.quote }}"
                </blockquote>

                <v-divider class="my-6" />

                <div class="d-flex align-center justify-center">
                  <v-avatar size="64" class="me-4">
                    <v-img :src="testimonial.avatar" :alt="testimonial.name" />
                  </v-avatar>

                  <div class="text-start">
                    <h4 class="text-h6 font-weight-bold">
                      {{ testimonial.name }}
                    </h4>
                    <p class="text-body-2 text-medium-emphasis mb-1">
                      {{ testimonial.position }}
                    </p>
                    <p class="text-body-2 text-medium-emphasis">
                      {{ testimonial.company }}
                    </p>
                  </div>
                </div>

                <div class="mt-4">
                  <v-rating :model-value="testimonial.rating" readonly color="amber" size="small" />
                </div>
              </v-card-text>
            </v-card>
          </v-carousel-item>
        </v-carousel>

        <div v-else class="text-center py-12">
          <v-icon size="64" color="medium-emphasis" class="mb-4"> mdi-comment-text-outline </v-icon>
          <p class="text-h6 text-medium-emphasis">No testimonials available at the moment</p>
        </div>

        <div class="text-center mt-8">
          <v-btn color="primary" variant="outlined" size="large" href="/contact">
            Work With Us
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from '#imports';

  interface Testimonial {
    name: string;
    position: string;
    company: string;
    quote: string;
    avatar: string;
    rating: number;
  }

  const currentTestimonial = ref(0);

  const testimonials: Testimonial[] = [
    {
      name: 'Sarah Johnson',
      position: 'CTO',
      company: 'TechStart Inc.',
      quote:
        'Cloudless delivered exceptional cloud architecture solutions that scaled our platform to handle 10x traffic growth. Their expertise in AWS and modern development practices was invaluable.',
      avatar: '/images/avatars/sarah-johnson.jpg',
      rating: 5,
    },
    {
      name: 'Michael Chen',
      position: 'Lead Developer',
      company: 'DataFlow Solutions',
      quote:
        'The Vue.js and Nuxt.js application they built for us exceeded expectations. Clean code, great performance, and excellent documentation. Highly recommended!',
      avatar: '/images/avatars/michael-chen.jpg',
      rating: 5,
    },
    {
      name: 'Emily Rodriguez',
      position: 'Product Manager',
      company: 'InnovateLab',
      quote:
        'Professional, reliable, and technically excellent. They transformed our legacy system into a modern, cloud-native solution with minimal downtime.',
      avatar: '/images/avatars/emily-rodriguez.jpg',
      rating: 5,
    },
    {
      name: 'David Park',
      position: 'Founder',
      company: 'GreenTech Startup',
      quote:
        'Cloudless helped us build a robust infrastructure from day one. Their DevOps expertise saved us months of development time and countless headaches.',
      avatar: '/images/avatars/david-park.jpg',
      rating: 5,
    },
  ];
</script>

<style scoped>
  .testimonials-carousel {
    background: transparent;
  }

  .testimonial-card {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
  }

  blockquote {
    font-style: italic;
    line-height: 1.6;
  }

  @media (max-width: 768px) {
    .testimonial-card .pa-8 {
      padding: 24px !important;
    }

    blockquote {
      font-size: 1.1rem !important;
    }
  }
</style>
