<template>
  <v-container class="legal-page" fluid>
    <div class="page-header mb-8">
      <v-btn
        class="mb-4"
        color="primary"
        variant="text"
        prepend-icon="mdi-arrow-left"
        @click="$router.back()"
      >
        Back
      </v-btn>
      <v-row justify="center">
        <v-col cols="12" md="8">
          <h1 class="text-h2 font-weight-bold primary--text text-center mb-4">
            Terms of Service
          </h1>
          <p class="text-subtitle-1 text-center text-grey-darken-1 mb-4">
            Last updated: {{ lastUpdated }}
          </p>
          <v-divider />
        </v-col>
      </v-row>
    </div>

    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="pa-6">
          <div class="legal-content">
            <section class="mb-8">
              <h2 class="text-h4 mb-4">Agreement to Terms</h2>
              <p class="text-body-1 mb-4">
                By accessing and using the Cloudless platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
              </p>
              <p class="text-body-1">
                These Terms apply to all visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Description of Service</h2>
              <p class="text-body-1 mb-4">
                Cloudless provides a cloud development platform that enables developers to build, deploy, and manage applications. Our Service includes:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Application hosting and deployment tools</li>
                <li>Development environment management</li>
                <li>Monitoring and analytics capabilities</li>
                <li>Collaboration and project management features</li>
                <li>Support and documentation resources</li>
              </ul>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">User Accounts</h2>
              <h3 class="text-h5 mb-3">Account Creation</h3>
              <p class="text-body-1 mb-4">
                To use our Service, you must create an account. You agree to:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>

              <h3 class="text-h5 mb-3">Account Termination</h3>
              <p class="text-body-1 mb-4">
                We may terminate or suspend your account at any time for violations of these Terms or for any other reason at our sole discretion.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Acceptable Use</h2>
              <p class="text-body-1 mb-4">
                You agree not to use the Service to:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Transmit malicious code or malware</li>
                <li>Engage in unauthorized access or hacking</li>
                <li>Spam or send unsolicited communications</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Use the Service for illegal or harmful activities</li>
              </ul>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Content and Data</h2>
              <h3 class="text-h5 mb-3">Your Content</h3>
              <p class="text-body-1 mb-4">
                You retain ownership of any content, code, or data you upload to our Service ("Your Content"). By using our Service, you grant us a limited license to:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Store and process Your Content to provide the Service</li>
                <li>Create backups and ensure data redundancy</li>
                <li>Analyze usage patterns for service improvement</li>
              </ul>

              <h3 class="text-h5 mb-3">Content Responsibility</h3>
              <p class="text-body-1 mb-4">
                You are solely responsible for Your Content and must ensure you have all necessary rights and permissions to use and upload it to our Service.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Payment and Billing</h2>
              <h3 class="text-h5 mb-3">Fees</h3>
              <p class="text-body-1 mb-4">
                Some aspects of our Service may be subject to fees. Current pricing is available on our website and may be updated from time to time.
              </p>

              <h3 class="text-h5 mb-3">Payment Terms</h3>
              <ul class="text-body-1 mb-4">
                <li>Fees are charged in advance on a monthly or annual basis</li>
                <li>All fees are non-refundable unless required by law</li>
                <li>You must provide current payment information</li>
                <li>We may suspend service for overdue payments</li>
              </ul>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Service Availability</h2>
              <p class="text-body-1 mb-4">
                While we strive to maintain high service availability, we do not guarantee uninterrupted access to our Service. We may:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Perform scheduled maintenance</li>
                <li>Make emergency repairs or updates</li>
                <li>Experience occasional downtime or service interruptions</li>
              </ul>
              <p class="text-body-1">
                We will make reasonable efforts to notify users of planned maintenance in advance.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Intellectual Property</h2>
              <p class="text-body-1 mb-4">
                The Service and its original content, features, and functionality are owned by Cloudless and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p class="text-body-1">
                You may not reproduce, distribute, modify, or create derivative works of our Service without our express written permission.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Privacy</h2>
              <p class="text-body-1 mb-4">
                Your privacy is important to us. Please review our <NuxtLink to="/legal/privacy" class="text-primary">Privacy Policy</NuxtLink>, which also governs your use of the Service, to understand our practices.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Disclaimers</h2>
              <p class="text-body-1 mb-4">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING:
              </p>
              <ul class="text-body-1 mb-4">
                <li>MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE</li>
                <li>NON-INFRINGEMENT OF THIRD PARTY RIGHTS</li>
                <li>UNINTERRUPTED OR ERROR-FREE OPERATION</li>
                <li>SECURITY OR ACCURACY OF DATA</li>
              </ul>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Limitation of Liability</h2>
              <p class="text-body-1 mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CLOUDLESS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Loss of profits, data, use, or goodwill</li>
                <li>Service interruption or system failures</li>
                <li>Cost of substitute services</li>
                <li>Any other intangible losses</li>
              </ul>
              <p class="text-body-1">
                Our total liability shall not exceed the amount paid by you for the Service in the 12 months preceding the claim.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Indemnification</h2>
              <p class="text-body-1 mb-4">
                You agree to defend, indemnify, and hold harmless Cloudless from and against any claims, damages, obligations, losses, liabilities, costs, or debt arising from:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your infringement of third party rights</li>
                <li>Your Content uploaded to the Service</li>
              </ul>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Governing Law</h2>
              <p class="text-body-1 mb-4">
                These Terms shall be interpreted and governed by the laws of the State of California, United States, without regard to conflict of law provisions. Any disputes shall be resolved in the courts of San Francisco County, California.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Changes to Terms</h2>
              <p class="text-body-1 mb-4">
                We reserve the right to modify these Terms at any time. We will notify users of material changes by posting the updated Terms on our website. Your continued use of the Service constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section>
              <h2 class="text-h4 mb-4">Contact Information</h2>
              <p class="text-body-1 mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <v-card variant="outlined" class="pa-4">
                <ul class="text-body-1 list-style-none">
                  <li class="mb-2">
                    <v-icon class="mr-2">mdi-email</v-icon>
                    Email: <a href="mailto:legal@cloudless.dev" class="text-primary">legal@cloudless.dev</a>
                  </li>
                  <li class="mb-2">
                    <v-icon class="mr-2">mdi-web</v-icon>
                    Website: <a href="https://cloudless.dev" class="text-primary" target="_blank">cloudless.dev</a>
                  </li>
                  <li>
                    <v-icon class="mr-2">mdi-map-marker</v-icon>
                    Address: 123 Tech Street, San Francisco, CA 94102, USA
                  </li>
                </ul>
              </v-card>
            </section>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports';

definePageMeta({
  layout: 'auth',
})

const lastUpdated = 'January 20, 2024'
</script>

<style scoped>
.legal-page {
  max-width: 1200px;
  margin: 0 auto;
}

.legal-content {
  line-height: 1.7;
}

.legal-content h2 {
  color: rgb(var(--v-theme-primary));
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.2);
  padding-bottom: 8px;
}

.legal-content h3 {
  color: rgb(var(--v-theme-secondary));
}

.legal-content ul {
  padding-left: 1.5rem;
}

.legal-content li {
  margin-bottom: 0.5rem;
}

.list-style-none {
  list-style: none;
  padding-left: 0;
}
</style>
