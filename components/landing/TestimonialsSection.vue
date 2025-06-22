<template>
  <section class="testimonials-section py-16">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" class="text-center mb-12">
          <h2 class="text-h3 font-weight-bold mb-4 text-white">
            What Our Users Say
          </h2>
          <p class="text-h6 text-grey-lighten-2">
            Real stories from real users
          </p>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-carousel
            :show-arrows="false"
            cycle
            interval="5000"
            hide-delimiter-background
            delimiter-icon="mdi-circle"
            height="auto"
            class="testimonial-carousel"
          >
            <v-carousel-item
              v-for="(testimonial, index) in testimonials"
              :key="index"
            >
              <v-row justify="center" class="fill-height">
                <v-col cols="12" md="8" lg="6">
                  <v-card
                    class="testimonial-card mx-auto"
                    elevation="8"
                    rounded="xl"
                  >
                    <v-card-text class="pa-8 text-center">
                      <v-icon
                        icon="mdi-format-quote-open"
                        size="48"
                        class="mb-4 text-primary"
                      />
                      
                      <blockquote class="text-h6 mb-6 font-weight-light">
                        "{{ testimonial.quote }}"
                      </blockquote>
                      
                      <div class="d-flex align-center justify-center">
                        <v-avatar
                          :image="testimonial.avatar"
                          size="64"
                          class="mr-4"
                        />
                        <div class="text-left">
                          <div class="text-h6 font-weight-bold">
                            {{ testimonial.name }}
                          </div>
                          <div class="text-body-2 text-grey-darken-2">
                            {{ testimonial.title }}
                          </div>
                          <div class="text-body-2 text-grey-darken-1">
                            {{ testimonial.company }}
                          </div>
                        </div>
                      </div>
                      
                      <v-rating
                        :model-value="testimonial.rating"
                        readonly
                        color="amber"
                        size="small"
                        class="mt-4"
                      />
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-carousel-item>
          </v-carousel>
        </v-col>
      </v-row>

      <!-- Trust badges -->
      <v-row justify="center" class="mt-12">
        <v-col cols="12" class="text-center">
          <h3 class="text-h5 mb-6 text-white">Trusted by Leading Companies</h3>
          <v-row justify="center" align="center">
            <v-col
              v-for="badge in trustBadges"
              :key="badge.name"
              cols="6"
              sm="4"
              md="2"
              class="text-center"
            >
              <div class="trust-badge">
                <v-icon
                  :icon="badge.icon"
                  size="48"
                  class="text-grey-lighten-1"
                />
                <div class="text-caption mt-2 text-grey-lighten-2">
                  {{ badge.name }}
                </div>
              </div>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<script setup lang="ts">
interface Testimonial {
  quote: string;
  name: string;
  title: string;
  company: string;
  avatar: string;
  rating: number;
}

interface TrustBadge {
  name: string;
  icon: string;
}

const testimonials: Testimonial[] = [
  {
    quote: "Cloudless transformed how we handle data processing. What used to take weeks now takes hours, and our team can focus on insights instead of infrastructure.",
    name: "Sarah Chen",
    title: "Data Director",
    company: "TechFlow Inc.",
    avatar: "https://randomuser.me/api/portraits/women/1.jpg",
    rating: 5
  },
  {
    quote: "As a non-technical founder, I was amazed at how quickly I could build complex workflows. Cloudless made advanced analytics accessible to our entire team.",
    name: "Marcus Rodriguez",
    title: "CEO",
    company: "StartupHub",
    avatar: "https://randomuser.me/api/portraits/men/2.jpg",
    rating: 5
  },
  {
    quote: "The drag-and-drop interface is intuitive, but the power underneath is incredible. We've reduced our cloud costs by 40% while improving performance.",
    name: "Dr. Emily Watson",
    title: "Research Lead",
    company: "BioAnalytics Lab",
    avatar: "https://randomuser.me/api/portraits/women/3.jpg",
    rating: 5
  },
  {
    quote: "Security and compliance were our biggest concerns moving to the cloud. Cloudless addressed every requirement and made the transition seamless.",
    name: "James Kim",
    title: "IT Director",
    company: "SecureBank",
    avatar: "https://randomuser.me/api/portraits/men/4.jpg",
    rating: 5
  }
];

const trustBadges: TrustBadge[] = [
  { name: "Fortune 500", icon: "mdi-trophy" },
  { name: "Startups", icon: "mdi-rocket" },
  { name: "Healthcare", icon: "mdi-hospital" },
  { name: "Finance", icon: "mdi-bank" },
  { name: "Education", icon: "mdi-school" },
  { name: "Government", icon: "mdi-shield" }
];
</script>

<style scoped>
.testimonials-section {
  background: linear-gradient(135deg, rgba(118, 75, 162, 0.1) 0%, rgba(103, 126, 234, 0.1) 100%);
  backdrop-filter: blur(10px);
}

.testimonial-carousel {
  background: transparent !important;
}

.testimonial-card {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-height: 400px;
  display: flex;
  align-items: center;
}

.testimonial-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important;
  transition: all 0.3s ease;
}

.trust-badge {
  padding: 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.trust-badge:hover {
  transform: scale(1.05);
  background: rgba(255, 255, 255, 0.15);
}

blockquote {
  font-style: italic;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .testimonial-card {
    min-height: 350px;
  }
  
  .testimonial-card .pa-8 {
    padding: 1.5rem !important;
  }
  
  blockquote {
    font-size: 1.1rem !important;
  }
}
</style>
