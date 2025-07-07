<template>
  <div class="page-container">
    <div class="page-content">
      <div class="page-header">
        <h1>Terms of Service</h1>
        <p class="last-updated">Last updated: {{ lastUpdated }}</p>
      </div>

      <div class="terms-content">
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using Cloudless, you accept and agree to be bound by the terms and provision of this agreement.
          </p>
        </section>

        <section>
          <h2>2. Service Description</h2>
          <p>
            Cloudless is a cloud development platform that provides tools and services for building and deploying applications.
          </p>
        </section>

        <section>
          <h2>3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </p>
        </section>

        <section>
          <h2>4. Acceptable Use</h2>
          <p>
            You agree not to use the service for any unlawful purpose or in any way that could damage, disable, or impair the service.
          </p>
        </section>

        <section>
          <h2>5. Privacy Policy</h2>
          <p>
            Your privacy is important to us. Please review our Privacy Policy to understand how we collect and use your information.
          </p>
        </section>

        <section>
          <h2>6. Termination</h2>
          <p>
            We may terminate or suspend your account and access to the service at our sole discretion, without prior notice.
          </p>
        </section>

        <section>
          <h2>7. Disclaimer</h2>
          <p>
            The service is provided "as is" without warranty of any kind, either express or implied.
          </p>
        </section>

        <section>
          <h2>8. Contact Information</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us at support@cloudless.gr
          </p>
        </section>
      </div>

      <div class="page-footer">
        <NuxtLink to="/auth" class="back-link">← Back to Sign In</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
// Page meta
definePageMeta({
  layout: false
})

// Data
const lastUpdated = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

// SEO
useHead({
  title: 'Terms of Service - Cloudless',
  meta: [
    { name: 'description', content: 'Cloudless Terms of Service and user agreement' }
  ]
})
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px 20px;
}

.page-content {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.page-header {
  background: #f7fafc;
  padding: 40px;
  border-bottom: 1px solid #e2e8f0;
  text-align: center;
}

.page-header h1 {
  font-size: 32px;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 8px 0;
}

.last-updated {
  color: #718096;
  font-size: 14px;
  margin: 0;
}

.terms-content {
  padding: 40px;
}

.terms-content section {
  margin-bottom: 32px;
}

.terms-content section:last-child {
  margin-bottom: 0;
}

.terms-content h2 {
  font-size: 20px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 12px 0;
}

.terms-content p {
  color: #4a5568;
  line-height: 1.6;
  margin: 0;
}

.page-footer {
  padding: 20px 40px;
  border-top: 1px solid #e2e8f0;
  background: #f7fafc;
}

.back-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: #5a67d8;
  text-decoration: underline;
}

/* Responsive Design */
@media (max-width: 640px) {
  .page-container {
    padding: 20px 10px;
  }
  
  .page-header {
    padding: 30px 20px;
  }
  
  .page-header h1 {
    font-size: 24px;
  }
  
  .terms-content {
    padding: 30px 20px;
  }
  
  .page-footer {
    padding: 20px;
  }
}
</style>
