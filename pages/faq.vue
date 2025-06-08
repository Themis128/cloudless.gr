<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <h1 class="text-h3 mb-4">Frequently Asked Questions</h1>
          <p class="text-h6 mb-6">Find answers to common questions</p>
          
          <v-expansion-panels variant="accordion">
            <v-expansion-panel>
              <v-expansion-panel-title>
                What is Cloudless?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                Cloudless is a modern cloud-native application platform built with Nuxt 3 and Vuetify. 
                It provides a comprehensive solution for building, deploying, and managing web applications 
                with integrated authentication, database management, and monitoring capabilities.
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>
                How do I get started?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                Simply create an account using the authentication system, and you'll have access to the 
                dashboard where you can start building your applications. Our documentation provides 
                step-by-step guides for common tasks.
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>
                What technologies does Cloudless use?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                Cloudless is built with modern technologies including:
                <ul class="mt-2">
                  <li>Nuxt 3 and Vue 3 for the frontend</li>
                  <li>Vuetify for UI components</li>
                  <li>Supabase for backend services</li>
                  <li>TypeScript for type safety</li>
                  <li>Docker for containerization</li>
                </ul>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>
                Is my data secure?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                Yes, we take security seriously. We use industry-standard authentication, encryption, 
                and follow best practices for data protection. All sensitive data is encrypted both 
                in transit and at rest.
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>
                How can I get support?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                You can reach our support team through the contact form, or email us directly at 
                admin@cloudless.gr. We also provide comprehensive documentation and guides.
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>
                Can I contribute to the project?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                We welcome contributions! Check out our documentation for development guidelines 
                and contribution processes. You can also submit feature requests and bug reports.
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'FAQ',
  description: 'Frequently asked questions about Cloudless'
})
</script>
