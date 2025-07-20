<template>
  <div class="community-page">
    <div class="page-header">
      <h1>Community</h1>
      <p class="subtitle">
        Connect with developers, share knowledge, and contribute to the future of AI development
      </p>
    </div>

    <div class="content-container">
      <div class="community-content">
        <div class="welcome-section">
          <h2>Join Our Growing Community</h2>
          <p class="welcome-text">
            The Cloudless Wizard community is a vibrant ecosystem of developers, researchers, 
            and AI enthusiasts. Whether you're a beginner or an expert, there's a place for you 
            to learn, share, and grow with like-minded individuals.
          </p>
          
          <div class="community-stats">
            <div class="stat-card">
              <div class="stat-number">
                15,000+
              </div>
              <div class="stat-label">
                Members
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-number">
                500+
              </div>
              <div class="stat-label">
                Projects Shared
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-number">
                1,200+
              </div>
              <div class="stat-label">
                Discussions
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-number">
                50+
              </div>
              <div class="stat-label">
                Events
              </div>
            </div>
          </div>
        </div>

        <div class="platforms-section">
          <h2>Connect With Us</h2>
          <div class="platforms-grid">
            <div class="platform-card">
              <div class="platform-icon">
                <v-icon size="64" color="primary">
                  mdi-discord
                </v-icon>
              </div>
              <h3>Discord</h3>
              <p>Join our Discord server for real-time discussions, Q&A sessions, and community events.</p>
              <div class="platform-features">
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Real-time chat</span>
                </div>
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Voice channels</span>
                </div>
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Community events</span>
                </div>
              </div>
              <v-btn color="primary" variant="elevated" class="platform-btn">
                Join Discord
              </v-btn>
            </div>

            <div class="platform-card">
              <div class="platform-icon">
                <v-icon size="64" color="info">
                  mdi-github
                </v-icon>
              </div>
              <h3>GitHub</h3>
              <p>Contribute to open-source projects, report issues, and collaborate on community tools.</p>
              <div class="platform-features">
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Open source projects</span>
                </div>
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Issue tracking</span>
                </div>
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Code collaboration</span>
                </div>
              </div>
              <v-btn color="info" variant="elevated" class="platform-btn">
                Visit GitHub
              </v-btn>
            </div>

            <div class="platform-card">
              <div class="platform-icon">
                <v-icon size="64" color="success">
                  mdi-forum
                </v-icon>
              </div>
              <h3>Community Forum</h3>
              <p>Engage in detailed discussions, share tutorials, and get help from the community.</p>
              <div class="platform-features">
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Structured discussions</span>
                </div>
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Knowledge base</span>
                </div>
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Expert Q&A</span>
                </div>
              </div>
              <v-btn color="success" variant="elevated" class="platform-btn">
                Join Forum
              </v-btn>
            </div>

            <div class="platform-card">
              <div class="platform-icon">
                <v-icon size="64" color="warning">
                  mdi-youtube
                </v-icon>
              </div>
              <h3>YouTube</h3>
              <p>Watch tutorials, demos, and community highlights on our YouTube channel.</p>
              <div class="platform-features">
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Video tutorials</span>
                </div>
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Live streams</span>
                </div>
                <div class="feature-item">
                  <v-icon size="16" color="success">
                    mdi-check
                  </v-icon>
                  <span>Community spotlights</span>
                </div>
              </div>
              <v-btn color="warning" variant="elevated" class="platform-btn">
                Subscribe
              </v-btn>
            </div>
          </div>
        </div>

        <div class="events-section">
          <h2>Upcoming Events</h2>
          <div class="events-grid">
            <div class="event-card">
              <div class="event-date">
                <div class="event-day">
                  15
                </div>
                <div class="event-month">
                  Mar
                </div>
              </div>
              <div class="event-content">
                <h3>AI Model Training Workshop</h3>
                <p class="event-time">
                  2:00 PM - 4:00 PM EST
                </p>
                <p class="event-description">
                  Learn advanced techniques for training custom AI models with our platform.
                </p>
                <div class="event-tags">
                  <span class="tag">Workshop</span>
                  <span class="tag">Intermediate</span>
                </div>
                <v-btn color="primary" variant="outlined" size="small">
                  Register
                </v-btn>
              </div>
            </div>

            <div class="event-card">
              <div class="event-date">
                <div class="event-day">
                  22
                </div>
                <div class="event-month">
                  Mar
                </div>
              </div>
              <div class="event-content">
                <h3>Community Showcase</h3>
                <p class="event-time">
                  7:00 PM - 9:00 PM EST
                </p>
                <p class="event-description">
                  See amazing projects built by community members and get inspired.
                </p>
                <div class="event-tags">
                  <span class="tag">Showcase</span>
                  <span class="tag">All Levels</span>
                </div>
                <v-btn color="primary" variant="outlined" size="small">
                  Join
                </v-btn>
              </div>
            </div>

            <div class="event-card">
              <div class="event-date">
                <div class="event-day">
                  29
                </div>
                <div class="event-month">
                  Mar
                </div>
              </div>
              <div class="event-content">
                <h3>Q&A with the Team</h3>
                <p class="event-time">
                  1:00 PM - 2:00 PM EST
                </p>
                <p class="event-description">
                  Ask questions directly to our development team and get insider insights.
                </p>
                <div class="event-tags">
                  <span class="tag">Q&A</span>
                  <span class="tag">All Levels</span>
                </div>
                <v-btn color="primary" variant="outlined" size="small">
                  Submit Questions
                </v-btn>
              </div>
            </div>
          </div>
        </div>

        <div class="showcase-section">
          <h2>Community Showcase</h2>
          <div class="showcase-grid">
            <div class="showcase-card">
              <div class="showcase-image">
                <v-icon size="64" color="primary">
                  mdi-robot
                </v-icon>
              </div>
              <div class="showcase-content">
                <h3>AI-Powered Chatbot</h3>
                <p class="showcase-author">
                  by @alex_developer
                </p>
                <p class="showcase-description">
                  A sophisticated chatbot that can handle customer support queries with 95% accuracy.
                </p>
                <div class="showcase-stats">
                  <div class="stat">
                    <v-icon size="16" color="primary">
                      mdi-star
                    </v-icon>
                    <span>127 likes</span>
                  </div>
                  <div class="stat">
                    <v-icon size="16" color="success">
                      mdi-download
                    </v-icon>
                    <span>89 downloads</span>
                  </div>
                </div>
                <v-btn color="primary" variant="text" size="small">
                  View Project
                </v-btn>
              </div>
            </div>

            <div class="showcase-card">
              <div class="showcase-image">
                <v-icon size="64" color="success">
                  mdi-chart-line
                </v-icon>
              </div>
              <div class="showcase-content">
                <h3>Predictive Analytics Dashboard</h3>
                <p class="showcase-author">
                  by @data_scientist
                </p>
                <p class="showcase-description">
                  Real-time dashboard for predicting sales trends using machine learning models.
                </p>
                <div class="showcase-stats">
                  <div class="stat">
                    <v-icon size="16" color="primary">
                      mdi-star
                    </v-icon>
                    <span>203 likes</span>
                  </div>
                  <div class="stat">
                    <v-icon size="16" color="success">
                      mdi-download
                    </v-icon>
                    <span>156 downloads</span>
                  </div>
                </div>
                <v-btn color="primary" variant="text" size="small">
                  View Project
                </v-btn>
              </div>
            </div>

            <div class="showcase-card">
              <div class="showcase-image">
                <v-icon size="64" color="warning">
                  mdi-image
                </v-icon>
              </div>
              <div class="showcase-content">
                <h3>Image Recognition API</h3>
                <p class="showcase-author">
                  by @ml_engineer
                </p>
                <p class="showcase-description">
                  Custom image recognition model for identifying objects in real-time video streams.
                </p>
                <div class="showcase-stats">
                  <div class="stat">
                    <v-icon size="16" color="primary">
                      mdi-star
                    </v-icon>
                    <span>89 likes</span>
                  </div>
                  <div class="stat">
                    <v-icon size="16" color="success">
                      mdi-download
                    </v-icon>
                    <span>67 downloads</span>
                  </div>
                </div>
                <v-btn color="primary" variant="text" size="small">
                  View Project
                </v-btn>
              </div>
            </div>
          </div>
        </div>

        <div class="contribute-section">
          <h2>Contribute to the Community</h2>
          <div class="contribute-grid">
            <div class="contribute-card">
              <div class="contribute-icon">
                <v-icon size="48" color="primary">
                  mdi-book-open-variant
                </v-icon>
              </div>
              <h3>Write Tutorials</h3>
              <p>Share your knowledge by writing tutorials and guides for the community.</p>
              <v-btn color="primary" variant="outlined">
                Submit Tutorial
              </v-btn>
            </div>

            <div class="contribute-card">
              <div class="contribute-icon">
                <v-icon size="48" color="success">
                  mdi-code-braces
                </v-icon>
              </div>
              <h3>Share Projects</h3>
              <p>Showcase your AI projects and inspire others in the community.</p>
              <v-btn color="success" variant="outlined">
                Share Project
              </v-btn>
            </div>

            <div class="contribute-card">
              <div class="contribute-icon">
                <v-icon size="48" color="warning">
                  mdi-help-circle
                </v-icon>
              </div>
              <h3>Help Others</h3>
              <p>Answer questions and provide guidance to community members.</p>
              <v-btn color="warning" variant="outlined">
                Browse Questions
              </v-btn>
            </div>

            <div class="contribute-card">
              <div class="contribute-icon">
                <v-icon size="48" color="info">
                  mdi-lightbulb
                </v-icon>
              </div>
              <h3>Suggest Features</h3>
              <p>Help shape the future of Cloudless Wizard by suggesting new features.</p>
              <v-btn color="info" variant="outlined">
                Submit Idea
              </v-btn>
            </div>
          </div>
        </div>

        <div class="guidelines-section">
          <h2>Community Guidelines</h2>
          <div class="guidelines-content">
            <div class="guideline-item">
              <div class="guideline-icon">
                <v-icon size="24" color="success">
                  mdi-heart
                </v-icon>
              </div>
              <div class="guideline-text">
                <h4>Be Respectful</h4>
                <p>Treat all community members with respect and kindness, regardless of their experience level.</p>
              </div>
            </div>

            <div class="guideline-item">
              <div class="guideline-icon">
                <v-icon size="24" color="primary">
                  mdi-share
                </v-icon>
              </div>
              <div class="guideline-text">
                <h4>Share Knowledge</h4>
                <p>Contribute to the community by sharing your knowledge, experiences, and insights.</p>
              </div>
            </div>

            <div class="guideline-item">
              <div class="guideline-icon">
                <v-icon size="24" color="warning">
                  mdi-shield-check
                </v-icon>
              </div>
              <div class="guideline-text">
                <h4>Stay Safe</h4>
                <p>Don't share personal information or engage in harmful behavior.</p>
              </div>
            </div>

            <div class="guideline-item">
              <div class="guideline-icon">
                <v-icon size="24" color="info">
                  mdi-target
                </v-icon>
              </div>
              <div class="guideline-text">
                <h4>Stay On Topic</h4>
                <p>Keep discussions relevant to AI development, Cloudless Wizard, and related topics.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Community page component
</script>

<style scoped>
.community-page {
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

.community-content {
  max-width: 1000px;
  margin: 0 auto;
}

.welcome-section {
  margin-bottom: 4rem;
}

.welcome-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
  text-align: center;
}

.welcome-text {
  font-size: 1.1rem;
  color: rgba(0, 0, 0, 0.7);
  text-align: center;
  margin-bottom: 3rem;
  line-height: 1.6;
}

.community-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: rgba(0, 0, 0, 0.7);
  font-size: 1rem;
}

.platforms-section {
  margin-bottom: 4rem;
}

.platforms-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.platform-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.platform-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.platform-icon {
  margin-bottom: 1rem;
}

.platform-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.platform-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.platform-features {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.7);
}

.platform-btn {
  width: 100%;
}

.events-section {
  margin-bottom: 4rem;
}

.events-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
}

.event-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  display: flex;
  gap: 1.5rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.event-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.event-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  text-align: center;
}

.event-day {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.event-month {
  font-size: 0.9rem;
  font-weight: 500;
  text-transform: uppercase;
}

.event-content {
  flex: 1;
}

.event-content h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.event-time {
  color: #667eea;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.event-description {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin-bottom: 1rem;
}

.event-tags {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tag {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.showcase-section {
  margin-bottom: 4rem;
}

.showcase-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.showcase-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.showcase-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.showcase-image {
  margin-bottom: 1rem;
}

.showcase-content h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.showcase-author {
  color: #667eea;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.showcase-description {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin-bottom: 1rem;
}

.showcase-stats {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.6);
}

.contribute-section {
  margin-bottom: 4rem;
}

.contribute-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.contribute-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.contribute-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.contribute-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.contribute-icon {
  margin-bottom: 1rem;
}

.contribute-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.contribute-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.guidelines-section {
  margin-bottom: 2rem;
}

.guidelines-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.guidelines-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

.guideline-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.guideline-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.guideline-icon {
  flex-shrink: 0;
}

.guideline-text h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.guideline-text p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 768px) {
  .community-page {
    padding: 1rem;
  }
  
  .content-container {
    padding: 2rem;
  }
  
  .community-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .platforms-grid {
    grid-template-columns: 1fr;
  }
  
  .events-grid {
    grid-template-columns: 1fr;
  }
  
  .event-card {
    flex-direction: column;
    text-align: center;
  }
  
  .showcase-grid {
    grid-template-columns: 1fr;
  }
  
  .contribute-grid {
    grid-template-columns: 1fr;
  }
  
  .guidelines-content {
    grid-template-columns: 1fr;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
}
</style> 