
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
            Privacy Policy
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
              <h2 class="text-h4 mb-4">Introduction</h2>
              <p class="text-body-1 mb-4">
                At Cloudless ("we," "us," or "our"), we respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our platform and services.
              </p>
              <p class="text-body-1">
                This policy applies to all information collected through our website, applications, and services. By using our services, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>
            <section class="mb-8">
              <h2 class="text-h4 mb-4">Information We Collect</h2>
              <h3 class="text-h5 mb-3">Personal Information</h3>
              <p class="text-body-1 mb-4">
                We may collect the following types of personal information:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Name and contact information (email address, phone number)</li>
                <li>Account credentials and authentication information</li>
                <li>Billing and payment information</li>
                <li>Profile information and preferences</li>
                <li>Communication history and support requests</li>
              </ul>
              <h3 class="text-h5 mb-3">Technical Information</h3>
              <p class="text-body-1 mb-4">
                We automatically collect certain technical information when you use our services:
              </p>
              <ul class="text-body-1 mb-4">
                <li>IP address and device information</li>
                <li>Browser type and operating system</li>
                <li>Usage data and analytics</li>
                <li>Log files and error reports</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>
            <section class="mb-8">
              <h2 class="text-h4 mb-4">How We Use Your Information</h2>
              <p class="text-body-1 mb-4">
                We use your information for the following purposes:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Provide and maintain our services</li>
                <li>Process payments and manage your account</li>
                <li>Communicate with you about your account and our services</li>
                <li>Improve and optimize our platform</li>
                <li>Provide customer support</li>
                <li>Comply with legal obligations</li>
                <li>Detect and prevent fraud or security threats</li>
              </ul>
            </section>
            <section class="mb-8">
              <h2 class="text-h4 mb-4">Information Sharing</h2>
              <p class="text-body-1 mb-4">
                We do not sell, trade, or otherwise transfer your personal information to third parties except in the following circumstances:
              </p>
              <ul class="text-body-1 mb-4">
                <li>With your explicit consent</li>
                <li>To service providers who assist us in operating our platform</li>
                <li>To comply with legal requirements or court orders</li>
                <li>To protect our rights, property, or safety</li>
                <li>In connection with a business transfer or merger</li>
              </ul>
            </section>
            <section class="mb-8">
              <h2 class="text-h4 mb-4">Data Security</h2>
              <p class="text-body-1 mb-4">
                We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security audits and assessments</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Employee training and background checks</li>
                <li>Incident response and monitoring procedures</li>
              </ul>
            </section>
            <section class="mb-8">
              <h2 class="text-h4 mb-4">Your Rights and Choices</h2>
              <p class="text-body-1 mb-4">
                You have the following rights regarding your personal information:
              </p>
              <ul class="text-body-1 mb-4">
                <li>Access and review your personal data</li>
                <li>Correct inaccurate or incomplete information</li>
                <li>Delete your account and personal data</li>
                <li>Opt-out of marketing communications</li>
                <li>Data portability and export</li>
                <li>Withdraw consent where applicable</li>
              </ul>
              <p class="text-body-1">
                To exercise these rights, please contact us at <strong>privacy@cloudless.dev</strong>.
              </p>
            </section>
            <section class="mb-8">
              <h2 class="text-h4 mb-4">Cookies and Tracking</h2>
              <p class="text-body-1 mb-4">
                We use cookies and similar tracking technologies to enhance your experience on our platform. You can control cookie preferences through your browser settings. For more information, see our <NuxtLink to="/legal/cookies" class="text-primary">Cookie Policy</NuxtLink>.
              </p>
            </section>
            <section class="mb-8">
              <h2 class="text-h4 mb-4">International Data Transfers</h2>
              <p class="text-body-1 mb-4">
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with applicable data protection laws.
              </p>
            </section>
            <section class="mb-8">
              <h2 class="text-h4 mb-4">Children's Privacy</h2>
              <p class="text-body-1 mb-4">
                Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </section>
            <section class="mb-8">
              <h2 class="text-h4 mb-4">Changes to This Policy</h2>
              <p class="text-body-1 mb-4">
                We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on our website and updating the "Last updated" date. Your continued use of our services after such changes constitutes acceptance of the updated policy.
              </p>
            </section>
            <section>
              <h2 class="text-h4 mb-4">Contact Us</h2>
              <p class="text-body-1 mb-4">
                If you have any questions about this privacy policy or our data practices, please contact us:
              </p>
              <v-card variant="outlined" class="pa-4">
                <ul class="text-body-1 list-style-none">
                  <li class="mb-2">
                    <v-icon class="mr-2">mdi-email</v-icon>
                    Email: <a href="mailto:privacy@cloudless.dev" class="text-primary">privacy@cloudless.dev</a>
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
