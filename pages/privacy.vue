<template>
  <div class="page-container">
    <div class="page-content">
      <div class="page-header">
        <h1>Privacy Policy</h1>
        <p class="last-updated">Last updated: {{ lastUpdated }}</p>
      </div>

      <div class="privacy-content">
        <section>
          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly to us, such as when you create an account, update your profile, or contact us for support.
          </p>
          <ul>
            <li>Name and email address</li>
            <li>Account credentials</li>
            <li>Profile information</li>
            <li>Usage data and analytics</li>
          </ul>
        </section>

        <section>
          <h2>2. How We Use Your Information</h2>
          <p>
            We use the information we collect to:
          </p>
          <ul>
            <li>Provide and maintain our services</li>
            <li>Improve and personalize your experience</li>
            <li>Communicate with you about updates and support</li>
            <li>Analyze usage patterns and optimize performance</li>
          </ul>
        </section>

        <section>
          <h2>3. Information Sharing</h2>
          <p>
            We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.
          </p>
        </section>

        <section>
          <h2>4. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
          </p>
        </section>

        <section>
          <h2>5. Data Retention</h2>
          <p>
            We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy.
          </p>
        </section>

        <section>
          <h2>6. Your Rights</h2>
          <p>
            You have the right to:
          </p>
          <ul>
            <li>Access and update your personal information</li>
            <li>Request deletion of your account and data</li>
            <li>Object to certain processing of your information</li>
            <li>Receive a copy of your data in a portable format</li>
          </ul>
        </section>

        <section>
          <h2>7. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to enhance your experience, analyze usage patterns, and provide personalized content.
          </p>
        </section>

        <section>
          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.
          </p>
        </section>

        <section>
          <h2>9. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at privacy@cloudless.gr
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
  title: 'Privacy Policy - Cloudless',
  meta: [
    { name: 'description', content: 'Cloudless Privacy Policy and data protection information' }
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

.privacy-content {
  padding: 40px;
}

.privacy-content section {
  margin-bottom: 32px;
}

.privacy-content section:last-child {
  margin-bottom: 0;
}

.privacy-content h2 {
  font-size: 20px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 12px 0;
}

.privacy-content p {
  color: #4a5568;
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.privacy-content p:last-child {
  margin-bottom: 0;
}

.privacy-content ul {
  margin: 12px 0 0 0;
  padding-left: 20px;
  color: #4a5568;
}

.privacy-content li {
  margin-bottom: 4px;
  line-height: 1.5;
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
  
  .privacy-content {
    padding: 30px 20px;
  }
  
  .page-footer {
    padding: 20px;
  }
}
</style>
