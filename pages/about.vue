<template>
  <div class="about-page">
    <div class="page-header">
      <h1>About Cloudless Wizard</h1>
      <p class="subtitle">Empowering developers with AI-driven cloud solutions</p>
    </div>

    <div class="content-grid">
      <div class="mission-section">
        <h2>Our Mission</h2>
        <p>
          Cloudless Wizard is revolutionizing how developers build, deploy, and manage cloud applications. 
          We combine the power of artificial intelligence with intuitive tools to make cloud development 
          accessible, efficient, and scalable for teams of all sizes.
        </p>
        <div class="mission-stats">
          <div class="stat-card">
            <div class="stat-number">10K+</div>
            <div class="stat-label">Successful Deployments</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">99.9%</div>
            <div class="stat-label">Uptime Guarantee</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">24/7</div>
            <div class="stat-label">Support Available</div>
          </div>
        </div>
      </div>

      <div class="features-section">
        <h2>What We Offer</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">
              <v-icon size="32" color="primary">mdi-robot</v-icon>
            </div>
            <h3>AI-Powered Bot Builder</h3>
            <p>Create intelligent chatbots and automation workflows with our intuitive drag-and-drop interface.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <v-icon size="32" color="primary">mdi-brain</v-icon>
            </div>
            <h3>Model Training</h3>
            <p>Train custom AI models with your data using our advanced machine learning pipeline.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <v-icon size="32" color="primary">mdi-timeline</v-icon>
            </div>
            <h3>Pipeline Creator</h3>
            <p>Build complex data processing pipelines with visual tools and real-time monitoring.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <v-icon size="32" color="primary">mdi-rocket-launch</v-icon>
            </div>
            <h3>One-Click Deployment</h3>
            <p>Deploy your applications to any cloud provider with automated scaling and monitoring.</p>
          </div>
        </div>
      </div>

      <div class="team-section">
        <h2>Our Team</h2>
        <p>
          We're a passionate team of engineers, designers, and AI researchers dedicated to making 
          cloud development better for everyone. Our expertise spans machine learning, cloud infrastructure, 
          and developer experience.
        </p>
        <div class="team-grid">
          <div class="team-member">
            <div class="member-avatar">
              <v-icon size="48" color="primary">mdi-account-circle</v-icon>
            </div>
            <h4>Alex Chen</h4>
            <p class="member-role">CEO & Co-founder</p>
            <p class="member-bio">Former senior engineer at major tech companies with 15+ years in cloud infrastructure.</p>
          </div>
          <div class="team-member">
            <div class="member-avatar">
              <v-icon size="48" color="primary">mdi-account-circle</v-icon>
            </div>
            <h4>Sarah Kim</h4>
            <p class="member-role">CTO & Co-founder</p>
            <p class="member-bio">AI researcher with expertise in large language models and distributed systems.</p>
          </div>
          <div class="team-member">
            <div class="member-avatar">
              <v-icon size="48" color="primary">mdi-account-circle</v-icon>
            </div>
            <h4>Marcus Rodriguez</h4>
            <p class="member-role">Head of Engineering</p>
            <p class="member-bio">Full-stack developer with deep experience in scalable microservices architecture.</p>
          </div>
        </div>
      </div>

      <div class="values-section">
        <h2>Our Values</h2>
        <div class="values-grid">
          <div class="value-card">
            <h3>Innovation</h3>
            <p>We constantly push the boundaries of what's possible with AI and cloud technology.</p>
          </div>
          <div class="value-card">
            <h3>Simplicity</h3>
            <p>Complex problems deserve simple solutions. We make powerful tools easy to use.</p>
          </div>
          <div class="value-card">
            <h3>Reliability</h3>
            <p>Your applications deserve the highest level of uptime and performance.</p>
          </div>
          <div class="value-card">
            <h3>Community</h3>
            <p>We believe in building together and sharing knowledge with the developer community.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// About page component
</script>

<style scoped>
.about-page {
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

.content-grid {
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.mission-section,
.features-section,
.team-section,
.values-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.mission-section h2,
.features-section h2,
.team-section h2,
.values-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.mission-section p,
.team-section p {
  font-size: 1.1rem;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.mission-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.feature-icon {
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.feature-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin: 0;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.team-member {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.member-avatar {
  margin-bottom: 1rem;
}

.team-member h4 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.member-role {
  font-size: 0.9rem;
  color: #667eea;
  font-weight: 500;
  margin-bottom: 1rem;
}

.member-bio {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin: 0;
}

.values-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.value-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.value-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.value-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin: 0;
}

@media (max-width: 768px) {
  .about-page {
    padding: 1rem;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .subtitle {
    font-size: 1rem;
  }
  
  .content-grid {
    gap: 3rem;
  }
  
  .mission-stats {
    grid-template-columns: 1fr;
  }
  
  .features-grid,
  .team-grid,
  .values-grid {
    grid-template-columns: 1fr;
  }
}
</style> 