<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <h1 class="text-h3 mb-4">Terms of Service</h1>
          <p class="text-h6 mb-6">Please read these terms carefully</p>
          
          <v-card>
            <v-card-title>Terms and Conditions</v-card-title>
            <v-card-text>
              <div class="terms-content">
                <h3 class="text-h5 mb-3">1. Acceptance of Terms</h3>
                <p class="mb-4">
                  By accessing and using the Cloudless platform, you accept and agree to be bound by the terms and provision of this agreement.
                </p>
                
                <h3 class="text-h5 mb-3">2. Use License</h3>
                <p class="mb-4">
                  Permission is granted to temporarily use the Cloudless platform for personal, non-commercial transitory viewing only.
                </p>
                
                <h3 class="text-h5 mb-3">3. Privacy Policy</h3>
                <p class="mb-4">
                  Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your information when you use our service.
                </p>
                
                <h3 class="text-h5 mb-3">4. User Accounts</h3>
                <p class="mb-4">
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
                </p>
                
                <h3 class="text-h5 mb-3">5. Service Availability</h3>
                <p class="mb-4">
                  We strive to maintain high availability but cannot guarantee uninterrupted service. Maintenance windows and updates may cause temporary service interruptions.
                </p>
                
                <h3 class="text-h5 mb-3">6. Contact Information</h3>
                <p class="mb-4">
                  If you have any questions about these Terms, please contact us at admin@cloudless.gr
                </p>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'Terms of Service',
  description: 'Terms and conditions for using Cloudless platform'
})
</script>

<style scoped>
.terms-content h3 {
  color: rgb(var(--v-theme-primary));
}
</style>
