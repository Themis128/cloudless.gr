<template>
  <div class="about-container">
    <div class="hero-section">
      <div class="hero-content">
        <h1>About Cloudless</h1>
        <p class="hero-description">
          We are a forward-thinking development team specializing in modern web technologies, 
          creating innovative solutions that empower businesses and developers worldwide.
        </p>
      </div>
    </div>

    <div class="content-section">
      <div class="story-section">
        <h2>Our Story</h2>
        <p>
          Founded with a vision to revolutionize web development, Cloudless emerged from the understanding 
          that modern applications need to be fast, secure, and scalable. We believe in building solutions 
          that not only meet today's requirements but anticipate tomorrow's challenges.
        </p>
        <p>
          Our journey began with a simple mission: to create development tools and frameworks that make 
          building robust web applications accessible to everyone, from startups to enterprise organizations.
        </p>
      </div>

      <div class="values-section">
        <h2>Our Values</h2>
        <div class="values-grid">
          <div class="value-card">
            <div class="value-icon">🚀</div>
            <h3>Innovation</h3>
            <p>We constantly push the boundaries of what's possible, embracing new technologies and methodologies to deliver cutting-edge solutions.</p>
          </div>
          
          <div class="value-card">
            <div class="value-icon">🔒</div>
            <h3>Security</h3>
            <p>Security is at the core of everything we build. We implement industry best practices to protect data and ensure user privacy.</p>
          </div>
          
          <div class="value-card">
            <div class="value-icon">⚡</div>
            <h3>Performance</h3>
            <p>We optimize every aspect of our applications for speed and efficiency, ensuring excellent user experiences across all devices.</p>
          </div>
          
          <div class="value-card">
            <div class="value-icon">🤝</div>
            <h3>Collaboration</h3>
            <p>We work closely with our clients and the developer community, fostering open communication and shared success.</p>
          </div>
        </div>
      </div>

      <div class="expertise-section">
        <h2>Our Expertise</h2>
        <div class="expertise-grid">
          <div class="expertise-area">
            <h3>Frontend Development</h3>
            <p>Modern JavaScript frameworks including Vue.js, Nuxt.js, and React for creating responsive, interactive user interfaces.</p>
            <div class="tech-tags">
              <span class="tech-tag">Vue.js</span>
              <span class="tech-tag">Nuxt.js</span>
              <span class="tech-tag">TypeScript</span>
              <span class="tech-tag">Tailwind CSS</span>
            </div>
          </div>
          
          <div class="expertise-area">
            <h3>Backend Development</h3>
            <p>Scalable server-side solutions with Node.js, API development, database design, and cloud integrations.</p>
            <div class="tech-tags">
              <span class="tech-tag">Node.js</span>
              <span class="tech-tag">Prisma</span>
              <span class="tech-tag">PostgreSQL</span>
              <span class="tech-tag">REST APIs</span>
            </div>
          </div>
          
          <div class="expertise-area">
            <h3>DevOps & Infrastructure</h3>
            <p>Modern deployment strategies, containerization, CI/CD pipelines, and cloud infrastructure management.</p>
            <div class="tech-tags">
              <span class="tech-tag">Docker</span>
              <span class="tech-tag">GitHub Actions</span>
              <span class="tech-tag">Vercel</span>
              <span class="tech-tag">AWS</span>
            </div>
          </div>
        </div>
      </div>

      <div class="team-section">
        <h2>Our Approach</h2>
        <p>
          We believe in agile development methodologies, continuous integration, and test-driven development. 
          Our team combines technical expertise with creative problem-solving to deliver solutions that exceed expectations.
        </p>
        <p>
          Every project we undertake is approached with careful planning, iterative development, and close 
          collaboration with our clients to ensure the final product aligns perfectly with their vision and goals.
        </p>
      </div>

      <div class="contact-cta">
        <h2>Let's Work Together</h2>
        <p>Ready to bring your next project to life? We'd love to hear about your ideas and discuss how we can help make them a reality.</p>
        <NuxtLink to="/contact" class="cta-button">
          Start a Conversation
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Set page meta
definePageMeta({
  layout: 'default'
});
</script>

<style scoped>
.about-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.hero-section {
  text-align: center;
  margin-bottom: 4rem;
  padding: 3rem 2rem;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.hero-content h1 {
  font-size: 3.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1.5rem;
}

.hero-description {
  font-size: 1.3rem;
  color: #64748b;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.6;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.story-section,
.team-section {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2.5rem;
}

.story-section h2,
.values-section h2,
.expertise-section h2,
.team-section h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1.5rem;
}

.story-section p,
.team-section p {
  font-size: 1.1rem;
  color: #64748b;
  line-height: 1.7;
  margin-bottom: 1.5rem;
}

.values-section {
  margin: 0;
}

.values-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.value-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease;
}

.value-card:hover {
  transform: translateY(-5px);
}

.value-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.value-card h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 1rem;
}

.value-card p {
  color: #64748b;
  line-height: 1.6;
}

.expertise-section {
  margin: 0;
}

.expertise-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.expertise-area {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2rem;
}

.expertise-area h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 1rem;
}

.expertise-area p {
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.tech-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tech-tag {
  background-color: #eff6ff;
  color: #2563eb;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.contact-cta {
  text-align: center;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 3rem 2rem;
}

.contact-cta h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.contact-cta p {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.cta-button {
  display: inline-block;
  background-color: #1e40af;
  color: white;
  padding: 0.75rem 2rem;
  border-radius: 0.375rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.cta-button:hover {
  background-color: #1e3a8a;
}

@media (max-width: 768px) {
  .hero-content h1 {
    font-size: 2.5rem;
  }
  
  .hero-description {
    font-size: 1.1rem;
  }
  
  .values-grid,
  .expertise-grid {
    grid-template-columns: 1fr;
  }
  
  .contact-cta h2 {
    font-size: 2rem;
  }
  
  .hero-section,
  .story-section,
  .team-section,
  .contact-cta {
    padding: 2rem 1.5rem;
  }
  
  .value-card,
  .expertise-area {
    padding: 1.5rem;
  }
}
</style>
