<template>
  <div class="support-page">
    <div class="page-header">
      <h1>Support Center</h1>
      <p class="subtitle">
        We're here to help you get the most out of our AI development platform
      </p>
    </div>

    <div class="content-container">
      <div class="support-content">
        <section class="support-section">
          <h2>🚀 Quick Start Guide</h2>

          <h3>Getting Started</h3>
          <div class="step-list">
            <div class="step-item">
              <div class="step-number">
                1
              </div>
              <div class="step-content">
                <h4>Create an Account</h4>
                <p>Sign up for a free account to access all features</p>
              </div>
            </div>
            <div class="step-item">
              <div class="step-number">
                2
              </div>
              <div class="step-content">
                <h4>Choose Your Plan</h4>
                <p>Select the plan that best fits your needs</p>
              </div>
            </div>
            <div class="step-item">
              <div class="step-number">
                3
              </div>
              <div class="step-content">
                <h4>Build Your First Bot</h4>
                <p>
                  Use our guided bot builder to create your first AI chatbot
                </p>
              </div>
            </div>
            <div class="step-item">
              <div class="step-number">
                4
              </div>
              <div class="step-content">
                <h4>Train a Model</h4>
                <p>Upload your data and start training custom AI models</p>
              </div>
            </div>
            <div class="step-item">
              <div class="step-number">
                5
              </div>
              <div class="step-content">
                <h4>Deploy Your Pipeline</h4>
                <p>Create and execute AI data processing workflows</p>
              </div>
            </div>
          </div>

          <h3>Essential Resources</h3>
          <div class="resource-grid">
            <div class="resource-card">
              <v-icon size="32" color="primary">
                mdi-book-open-variant
              </v-icon>
              <h4>Documentation</h4>
              <p>Comprehensive guides and API references</p>
              <v-btn color="primary" variant="outlined" size="small">
                View Docs
              </v-btn>
            </div>
            <div class="resource-card">
              <v-icon size="32" color="primary">
                mdi-api
              </v-icon>
              <h4>API Reference</h4>
              <p>Detailed API documentation and examples</p>
              <v-btn color="primary" variant="outlined" size="small">
                API Docs
              </v-btn>
            </div>
            <div class="resource-card">
              <v-icon size="32" color="primary">
                mdi-video
              </v-icon>
              <h4>Video Tutorials</h4>
              <p>Step-by-step video guides</p>
              <v-btn color="primary" variant="outlined" size="small">
                Watch Videos
              </v-btn>
            </div>
            <div class="resource-card">
              <v-icon size="32" color="primary">
                mdi-forum
              </v-icon>
              <h4>Community Forum</h4>
              <p>Connect with other developers</p>
              <v-btn color="primary" variant="outlined" size="small">
                Join Forum
              </v-btn>
            </div>
          </div>
        </section>

        <section class="support-section">
          <h2>📞 Contact Support</h2>

          <div class="contact-grid">
            <div class="contact-card">
              <v-icon size="48" color="primary">
                mdi-email
              </v-icon>
              <h3>Email Support</h3>
              <p>Get help via email with detailed responses</p>
              <div class="contact-details">
                <p><strong>General Support:</strong> support@cloudless.gr</p>
                <p><strong>Technical Issues:</strong> tech@cloudless.gr</p>
                <p><strong>Billing Questions:</strong> billing@cloudless.gr</p>
              </div>
              <div class="response-times">
                <p><strong>Response Times:</strong></p>
                <ul>
                  <li>Free Plan: 48-72 hours</li>
                  <li>Pro Plan: 24 hours</li>
                  <li>Business Plan: 4-8 hours</li>
                  <li>Enterprise: 2-4 hours</li>
                </ul>
              </div>
            </div>

            <div class="contact-card">
              <v-icon size="48" color="primary">
                mdi-chat
              </v-icon>
              <h3>Live Chat</h3>
              <p>Real-time assistance for immediate help</p>
              <div class="availability">
                <p><strong>Available for:</strong></p>
                <ul>
                  <li>Pro Plan and above</li>
                  <li>Business hours (9 AM - 6 PM EST)</li>
                  <li>Weekdays only</li>
                </ul>
              </div>
              <v-btn
                color="primary"
                variant="elevated"
                size="large"
                class="chat-btn"
              >
                Start Live Chat
              </v-btn>
            </div>

            <div class="contact-card">
              <v-icon size="48" color="primary">
                mdi-phone
              </v-icon>
              <h3>Phone Support</h3>
              <p>Direct phone support for urgent issues</p>
              <div class="contact-details">
                <p><strong>Phone:</strong> +1 (555) 123-4567</p>
                <p><strong>Available:</strong> Business Plan and Enterprise</p>
              </div>
              <div class="availability">
                <p><strong>Hours:</strong></p>
                <ul>
                  <li>Monday - Friday: 9 AM - 6 PM EST</li>
                  <li>Saturday: 10 AM - 2 PM EST</li>
                  <li>Sunday: Closed</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section class="support-section">
          <h2>🔧 Technical Support</h2>

          <h3>Common Issues & Solutions</h3>
          <div class="faq-grid">
            <div class="faq-item">
              <h4>Authentication Issues</h4>
              <p>
                <strong>Problem:</strong> Unable to log in or access account
              </p>
              <p><strong>Solutions:</strong></p>
              <ul>
                <li>Clear browser cookies and cache</li>
                <li>Reset your password</li>
                <li>Check if your account is active</li>
                <li>Contact support if issues persist</li>
              </ul>
            </div>

            <div class="faq-item">
              <h4>Bot Creation Problems</h4>
              <p>
                <strong>Problem:</strong> Errors when creating or deploying bots
              </p>
              <p><strong>Solutions:</strong></p>
              <ul>
                <li>Check your plan limits</li>
                <li>Verify model configurations</li>
                <li>Review error logs in debug console</li>
                <li>Ensure proper API credentials</li>
              </ul>
            </div>

            <div class="faq-item">
              <h4>Model Training Issues</h4>
              <p>
                <strong>Problem:</strong> Training failures or poor performance
              </p>
              <p><strong>Solutions:</strong></p>
              <ul>
                <li>Check data quality and format</li>
                <li>Verify training parameters</li>
                <li>Monitor resource usage</li>
                <li>Review training logs</li>
              </ul>
            </div>

            <div class="faq-item">
              <h4>Pipeline Execution Errors</h4>
              <p>
                <strong>Problem:</strong> Pipeline failures or unexpected
                results
              </p>
              <p><strong>Solutions:</strong></p>
              <ul>
                <li>Check input data format</li>
                <li>Verify pipeline configuration</li>
                <li>Review execution logs</li>
                <li>Test with sample data</li>
              </ul>
            </div>

            <div class="faq-item">
              <h4>API Rate Limits</h4>
              <p><strong>Problem:</strong> Hitting API request limits</p>
              <p><strong>Solutions:</strong></p>
              <ul>
                <li>Upgrade your plan for higher limits</li>
                <li>Implement request caching</li>
                <li>Optimize API usage patterns</li>
                <li>Contact support for limit increases</li>
              </ul>
            </div>

            <div class="faq-item">
              <h4>Performance Issues</h4>
              <p><strong>Problem:</strong> Slow response times or timeouts</p>
              <p><strong>Solutions:</strong></p>
              <ul>
                <li>Check your internet connection</li>
                <li>Clear browser cache</li>
                <li>Try different browsers</li>
                <li>Contact support for investigation</li>
              </ul>
            </div>
          </div>
        </section>

        <section class="support-section">
          <h2>📚 Documentation & Resources</h2>

          <div class="docs-grid">
            <div class="doc-card">
              <v-icon size="32" color="primary">
                mdi-file-document
              </v-icon>
              <h4>Getting Started Guide</h4>
              <p>Complete beginner's guide to Cloudless.gr</p>
              <v-btn color="primary" variant="outlined" size="small">
                Read Guide
              </v-btn>
            </div>

            <div class="doc-card">
              <v-icon size="32" color="primary">
                mdi-code-braces
              </v-icon>
              <h4>API Documentation</h4>
              <p>Comprehensive API reference and examples</p>
              <v-btn color="primary" variant="outlined" size="small">
                View API Docs
              </v-btn>
            </div>

            <div class="doc-card">
              <v-icon size="32" color="primary">
                mdi-lightbulb
              </v-icon>
              <h4>Best Practices</h4>
              <p>Tips and best practices for optimal results</p>
              <v-btn color="primary" variant="outlined" size="small">
                Learn More
              </v-btn>
            </div>

            <div class="doc-card">
              <v-icon size="32" color="primary">
                mdi-tools
              </v-icon>
              <h4>Developer Tools</h4>
              <p>Debug and monitoring tools documentation</p>
              <v-btn color="primary" variant="outlined" size="small">
                Explore Tools
              </v-btn>
            </div>
          </div>
        </section>

        <section class="support-section">
          <h2>🎓 Training & Education</h2>

          <div class="training-grid">
            <div class="training-card">
              <v-icon size="32" color="primary">
                mdi-school
              </v-icon>
              <h4>Online Courses</h4>
              <p>Structured learning paths for different skill levels</p>
              <v-btn color="primary" variant="outlined" size="small">
                Browse Courses
              </v-btn>
            </div>

            <div class="training-card">
              <v-icon size="32" color="primary">
                mdi-webinar
              </v-icon>
              <h4>Webinars</h4>
              <p>Live training sessions and Q&A</p>
              <v-btn color="primary" variant="outlined" size="small">
                Register
              </v-btn>
            </div>

            <div class="training-card">
              <v-icon size="32" color="primary">
                mdi-certificate
              </v-icon>
              <h4>Certification</h4>
              <p>Get certified in Cloudless.gr development</p>
              <v-btn color="primary" variant="outlined" size="small">
                Get Certified
              </v-btn>
            </div>

            <div class="training-card">
              <v-icon size="32" color="primary">
                mdi-account-group
              </v-icon>
              <h4>Community</h4>
              <p>Connect with other developers and experts</p>
              <v-btn color="primary" variant="outlined" size="small">
                Join Community
              </v-btn>
            </div>
          </div>
        </section>

        <section class="support-section">
          <h2>🤝 Community Support</h2>

          <div class="community-grid">
            <div class="community-card">
              <v-icon size="48" color="primary">
                mdi-forum
              </v-icon>
              <h3>Community Forum</h3>
              <p>
                Connect with other developers, share solutions, and get help
              </p>
              <div class="stats">
                <div class="stat">
                  <span class="stat-number">5,000+</span>
                  <span class="stat-label">Members</span>
                </div>
                <div class="stat">
                  <span class="stat-number">10,000+</span>
                  <span class="stat-label">Posts</span>
                </div>
              </div>
              <v-btn color="primary" variant="outlined">
                Join Forum
              </v-btn>
            </div>

            <div class="community-card">
              <v-icon size="48" color="primary">
                mdi-github
              </v-icon>
              <h3>GitHub Community</h3>
              <p>Open source projects, examples, and contributions</p>
              <div class="stats">
                <div class="stat">
                  <span class="stat-number">500+</span>
                  <span class="stat-label">Repositories</span>
                </div>
                <div class="stat">
                  <span class="stat-number">2,000+</span>
                  <span class="stat-label">Stars</span>
                </div>
              </div>
              <v-btn color="primary" variant="outlined">
                Visit GitHub
              </v-btn>
            </div>

            <div class="community-card">
              <v-icon size="48" color="primary">
                mdi-discord
              </v-icon>
              <h3>Discord Server</h3>
              <p>Real-time chat with developers and support team</p>
              <div class="stats">
                <div class="stat">
                  <span class="stat-number">3,000+</span>
                  <span class="stat-label">Members</span>
                </div>
                <div class="stat">
                  <span class="stat-number">24/7</span>
                  <span class="stat-label">Active</span>
                </div>
              </div>
              <v-btn color="primary" variant="outlined">
                Join Discord
              </v-btn>
            </div>
          </div>
        </section>

        <section class="support-section">
          <h2>📋 Support Request</h2>

          <div class="request-form">
            <p>
              Can't find what you're looking for? Submit a support request and
              we'll get back to you as soon as possible.
            </p>

            <div class="form-grid">
              <div class="form-field">
                <label>Name *</label>
                <v-text-field variant="outlined" placeholder="Your full name" />
              </div>

              <div class="form-field">
                <label>Email *</label>
                <v-text-field
                  variant="outlined"
                  placeholder="your.email@example.com"
                />
              </div>

              <div class="form-field">
                <label>Plan</label>
                <v-select
                  variant="outlined"
                  :items="['Free', 'Pro', 'Business', 'Enterprise']"
                  placeholder="Select your plan"
                />
              </div>

              <div class="form-field">
                <label>Priority</label>
                <v-select
                  variant="outlined"
                  :items="['Low', 'Medium', 'High', 'Critical']"
                  placeholder="Select priority"
                />
              </div>

              <div class="form-field full-width">
                <label>Subject *</label>
                <v-text-field
                  variant="outlined"
                  placeholder="Brief description of your issue"
                />
              </div>

              <div class="form-field full-width">
                <label>Description *</label>
                <v-textarea
                  variant="outlined"
                  rows="5"
                  placeholder="Please provide detailed information about your issue, including steps to reproduce, error messages, and any relevant screenshots."
                />
              </div>

              <div class="form-field full-width">
                <label>Attachments</label>
                <v-file-input
                  variant="outlined"
                  multiple
                  placeholder="Upload screenshots, logs, or other relevant files"
                />
              </div>
            </div>

            <div class="form-actions">
              <v-btn color="primary" variant="elevated" size="large">
                Submit Support Request
              </v-btn>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// No additional script needed for this static page
</script>

<style scoped>
.support-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}

.subtitle {
  font-size: 1.2rem;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.content-container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.support-content {
  max-width: 1000px;
  margin: 0 auto;
}

.support-section {
  margin-bottom: 4rem;
}

.support-section:last-child {
  margin-bottom: 0;
}

.support-section h2 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}

.support-section h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin: 2rem 0 1rem 0;
}

.support-section h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin-bottom: 0.5rem;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.step-number {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content h4 {
  margin-bottom: 0.5rem;
}

.step-content p {
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.resource-card {
  background: rgba(102, 126, 234, 0.05);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  transition: transform 0.3s ease;
}

.resource-card:hover {
  transform: translateY(-2px);
}

.resource-card h4 {
  margin: 1rem 0 0.5rem 0;
}

.resource-card p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 1rem;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.contact-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.contact-card h3 {
  margin: 1rem 0;
}

.contact-card p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 1.5rem;
}

.contact-details {
  text-align: left;
  margin-bottom: 1.5rem;
}

.contact-details p {
  margin-bottom: 0.5rem;
}

.response-times,
.availability {
  text-align: left;
  margin-bottom: 1.5rem;
}

.response-times ul,
.availability ul {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}

.response-times li,
.availability li {
  margin-bottom: 0.25rem;
  color: rgba(0, 0, 0, 0.7);
}

.chat-btn {
  margin-top: 1rem;
}

.faq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.faq-item {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.faq-item h4 {
  color: #667eea;
  margin-bottom: 1rem;
}

.faq-item p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 0.5rem;
}

.faq-item ul {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}

.faq-item li {
  margin-bottom: 0.25rem;
  color: rgba(0, 0, 0, 0.7);
}

.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.doc-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.doc-card h4 {
  color: #667eea;
  margin-bottom: 1rem;
}

.doc-card p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 1.5rem;
}

.training-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.training-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.training-card h3 {
  margin: 1rem 0;
}

.training-card p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 1.5rem;
}

.training-card ul {
  text-align: left;
  margin-bottom: 1.5rem;
  padding-left: 1.5rem;
}

.training-card li {
  margin-bottom: 0.5rem;
  color: rgba(0, 0, 0, 0.7);
}

.community-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.community-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.community-card h3 {
  margin: 1rem 0;
}

.community-card p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 1.5rem;
}

.stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.stat {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
}

.stat-label {
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.6);
}

.request-form {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.request-form > p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 2rem;
  text-align: center;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.form-field {
  display: flex;
  flex-direction: column;
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-field label {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin-bottom: 0.5rem;
}

.form-actions {
  text-align: center;
}

@media (max-width: 768px) {
  .support-page {
    padding: 1rem;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .content-container {
    padding: 2rem;
  }

  .support-section h2 {
    font-size: 1.5rem;
  }

  .support-section h3 {
    font-size: 1.2rem;
  }

  .contact-grid,
  .faq-grid,
  .docs-grid,
  .training-grid,
  .community-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .stats {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
