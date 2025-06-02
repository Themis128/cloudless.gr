<template>
  <v-container fluid class="py-12">
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <div class="text-center mb-8">
          <h2 class="text-h3 font-weight-bold mb-4">Professional Certifications</h2>
          <p class="text-h6 text-medium-emphasis">
            Industry-recognized credentials demonstrating expertise across cloud platforms and
            technologies
          </p>
        </div>

        <v-row>
          <v-col
            v-for="certification in certifications"
            :key="certification.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <v-card
              class="certification-card h-100"
              elevation="2"
              hover
              :href="certification.verificationUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <v-img
                :src="certification.badgeImage"
                :alt="certification.title"
                height="200"
                cover
                class="align-end"
              >
                <v-card-title class="text-white text-shadow">
                  {{ certification.title }}
                </v-card-title>
              </v-img>

              <v-card-text>
                <div class="mb-2">
                  <v-chip
                    :color="
                      certification.level === 'Expert'
                        ? 'red'
                        : certification.level === 'Professional'
                          ? 'orange'
                          : 'blue'
                    "
                    size="small"
                    variant="elevated"
                  >
                    {{ certification.level }}
                  </v-chip>
                </div>

                <p class="text-body-2 mb-2">
                  {{ certification.description }}
                </p>

                <div class="d-flex align-center justify-space-between">
                  <span class="text-caption text-medium-emphasis">
                    {{ certification.issuer }}
                  </span>
                  <span class="text-caption text-medium-emphasis">
                    {{ formatDate(certification.issueDate) }}
                  </span>
                </div>
              </v-card-text>

              <v-card-actions>
                <v-btn variant="text" color="primary" size="small" append-icon="mdi-open-in-new">
                  Verify Credential
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <div class="text-center mt-8">
          <v-btn color="primary" variant="outlined" size="large" href="/about#experience">
            View Full Experience
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { useDateFormatting } from '~/composables/useDateFormatting';

  const { formatDate } = useDateFormatting();

  interface Certification {
    id: string;
    title: string;
    description: string;
    issuer: string;
    level: 'Foundation' | 'Professional' | 'Expert';
    issueDate: string;
    expiryDate?: string;
    badgeImage: string;
    verificationUrl: string;
  }

  const certifications: Certification[] = [
    {
      id: 'aws-solutions-architect',
      title: 'AWS Solutions Architect',
      description: 'Professional-level certification for designing distributed systems on AWS',
      issuer: 'Amazon Web Services',
      level: 'Professional',
      issueDate: '2024-01-15',
      badgeImage: '/images/certifications/aws-solutions-architect.png',
      verificationUrl: 'https://aws.amazon.com/verification/verify-cert',
    },
    {
      id: 'azure-architect',
      title: 'Azure Solutions Architect Expert',
      description: 'Expert-level certification for Azure cloud architecture',
      issuer: 'Microsoft',
      level: 'Expert',
      issueDate: '2023-11-20',
      badgeImage: '/images/certifications/azure-architect.png',
      verificationUrl: 'https://learn.microsoft.com/en-us/credentials',
    },
    {
      id: 'gcp-professional',
      title: 'Google Cloud Professional',
      description: 'Professional cloud architect certification for Google Cloud Platform',
      issuer: 'Google Cloud',
      level: 'Professional',
      issueDate: '2023-09-10',
      badgeImage: '/images/certifications/gcp-professional.png',
      verificationUrl: 'https://cloud.google.com/certification/verify',
    },
    {
      id: 'kubernetes-cka',
      title: 'Certified Kubernetes Administrator',
      description: 'Hands-on certification for Kubernetes cluster administration',
      issuer: 'Cloud Native Computing Foundation',
      level: 'Professional',
      issueDate: '2023-07-05',
      badgeImage: '/images/certifications/cka.png',
      verificationUrl: 'https://training.linuxfoundation.org/certification/verify',
    },
  ];
</script>

<style scoped>
  .certification-card {
    transition: transform 0.2s ease-in-out;
  }

  .certification-card:hover {
    transform: translateY(-4px);
  }

  .text-shadow {
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
  }
</style>
