<template>
  <div class="community-page">
    <div class="page-header">
      <h1>Community</h1>
      <p class="subtitle">Connect, learn, and grow with fellow AI developers</p>
    </div>

    <div class="content-container">
      <div class="community-content">
        <section class="community-section">
          <h2>🌟 Welcome to Our Community</h2>
          <p class="welcome-text">
            Join thousands of developers, data scientists, and AI enthusiasts who are building the future with Cloudless.gr. 
            Share knowledge, get help, and collaborate on amazing projects.
          </p>
          
          <div class="community-stats">
            <div class="stat-card">
              <div class="stat-number">5,000+</div>
              <div class="stat-label">Community Members</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">10,000+</div>
              <div class="stat-label">Discussions</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">500+</div>
              <div class="stat-label">Projects Shared</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">24/7</div>
              <div class="stat-label">Active Support</div>
            </div>
          </div>
        </section>

        <section class="community-section">
          <h2>💬 Community Forums</h2>
          
          <div class="forums-grid">
            <div class="forum-card">
              <div class="forum-header">
                <v-icon size="32" color="primary">mdi-robot</v-icon>
                <h3>Bot Development</h3>
              </div>
              <p>Discuss bot creation, optimization, and best practices</p>
              <div class="forum-meta">
                <span>2.1k topics</span>
                <span>8.5k posts</span>
              </div>
              <div class="recent-topics">
                <div class="topic">
                  <span class="topic-title">How to handle context in conversations?</span>
                  <span class="topic-author">by @alex_dev</span>
                </div>
                <div class="topic">
                  <span class="topic-title">Best practices for bot testing</span>
                  <span class="topic-author">by @sarah_ai</span>
                </div>
              </div>
              <v-btn color="primary" variant="outlined" class="forum-btn">
                Join Discussion
              </v-btn>
            </div>

            <div class="forum-card">
              <div class="forum-header">
                <v-icon size="32" color="primary">mdi-brain</v-icon>
                <h3>Model Training</h3>
              </div>
              <p>Share insights on model training and fine-tuning</p>
              <div class="forum-meta">
                <span>1.8k topics</span>
                <span>6.2k posts</span>
              </div>
              <div class="recent-topics">
                <div class="topic">
                  <span class="topic-title">Fine-tuning GPT-4 for specific domains</span>
                  <span class="topic-author">by @ml_expert</span>
                </div>
                <div class="topic">
                  <span class="topic-title">Data preprocessing techniques</span>
                  <span class="topic-author">by @data_scientist</span>
                </div>
              </div>
              <v-btn color="primary" variant="outlined" class="forum-btn">
                Join Discussion
              </v-btn>
            </div>

            <div class="forum-card">
              <div class="forum-header">
                <v-icon size="32" color="primary">mdi-timeline</v-icon>
                <h3>Pipeline Development</h3>
              </div>
              <p>Discuss data processing pipelines and automation</p>
              <div class="forum-meta">
                <span>950 topics</span>
                <span>3.1k posts</span>
              </div>
              <div class="recent-topics">
                <div class="topic">
                  <span class="topic-title">Optimizing pipeline performance</span>
                  <span class="topic-author">by @pipeline_guru</span>
                </div>
                <div class="topic">
                  <span class="topic-title">Custom component development</span>
                  <span class="topic-author">by @dev_engineer</span>
                </div>
              </div>
              <v-btn color="primary" variant="outlined" class="forum-btn">
                Join Discussion
              </v-btn>
            </div>

            <div class="forum-card">
              <div class="forum-header">
                <v-icon size="32" color="primary">mdi-api</v-icon>
                <h3>API & Integration</h3>
              </div>
              <p>Help with API integration and third-party services</p>
              <div class="forum-meta">
                <span>1.2k topics</span>
                <span>4.8k posts</span>
              </div>
              <div class="recent-topics">
                <div class="topic">
                  <span class="topic-title">Webhook implementation guide</span>
                  <span class="topic-author">by @api_master</span>
                </div>
                <div class="topic">
                  <span class="topic-title">SDK integration examples</span>
                  <span class="topic-author">by @integration_dev</span>
                </div>
              </div>
              <v-btn color="primary" variant="outlined" class="forum-btn">
                Join Discussion
              </v-btn>
            </div>
          </div>
        </section>

        <section class="community-section">
          <h2>🎯 Community Challenges</h2>
          
          <div class="challenges-grid">
            <div class="challenge-card featured">
              <div class="challenge-header">
                <v-icon size="32" color="primary">mdi-trophy</v-icon>
                <div class="challenge-badge">Featured</div>
              </div>
              <h3>AI-Powered Customer Service Bot</h3>
              <p>Build a customer service bot that can handle complex queries and provide personalized responses</p>
              <div class="challenge-meta">
                <span><v-icon size="16">mdi-calendar</v-icon> Ends in 15 days</span>
                <span><v-icon size="16">mdi-account-group</v-icon> 45 participants</span>
                <span><v-icon size="16">mdi-cash</v-icon> $1,000 prize</span>
              </div>
              <v-btn color="primary" variant="elevated" class="challenge-btn">
                Join Challenge
              </v-btn>
            </div>

            <div class="challenge-card">
              <div class="challenge-header">
                <v-icon size="32" color="primary">mdi-lightbulb</v-icon>
                <div class="challenge-badge">Innovation</div>
              </div>
              <h3>Creative Content Generation</h3>
              <p>Create a pipeline that generates creative content for social media</p>
              <div class="challenge-meta">
                <span><v-icon size="16">mdi-calendar</v-icon> Ends in 30 days</span>
                <span><v-icon size="16">mdi-account-group</v-icon> 28 participants</span>
                <span><v-icon size="16">mdi-cash</v-icon> $500 prize</span>
              </div>
              <v-btn color="primary" variant="outlined" class="challenge-btn">
                Join Challenge
              </v-btn>
            </div>

            <div class="challenge-card">
              <div class="challenge-header">
                <v-icon size="32" color="primary">mdi-chart-line</v-icon>
                <div class="challenge-badge">Analytics</div>
              </div>
              <h3>Real-time Analytics Dashboard</h3>
              <p>Build a real-time analytics dashboard for monitoring AI model performance</p>
              <div class="challenge-meta">
                <span><v-icon size="16">mdi-calendar</v-icon> Ends in 45 days</span>
                <span><v-icon size="16">mdi-account-group</v-icon> 32 participants</span>
                <span><v-icon size="16">mdi-cash</v-icon> $750 prize</span>
              </div>
              <v-btn color="primary" variant="outlined" class="challenge-btn">
                Join Challenge
              </v-btn>
            </div>
          </div>
        </section>

        <section class="community-section">
          <h2>📅 Events & Meetups</h2>
          
          <div class="events-grid">
            <div class="event-card upcoming">
              <div class="event-date">
                <span class="day">25</span>
                <span class="month">Jan</span>
              </div>
              <div class="event-content">
                <h3>AI Development Workshop</h3>
                <p>Hands-on workshop on building AI applications with Cloudless.gr</p>
                <div class="event-meta">
                  <span><v-icon size="16">mdi-clock</v-icon> 2:00 PM EST</span>
                  <span><v-icon size="16">mdi-map-marker</v-icon> Virtual Event</span>
                  <span><v-icon size="16">mdi-account-group</v-icon> 150 registered</span>
                </div>
                <v-btn color="primary" variant="elevated" class="event-btn">
                  Register Now
                </v-btn>
              </div>
            </div>

            <div class="event-card">
              <div class="event-date">
                <span class="day">02</span>
                <span class="month">Feb</span>
              </div>
              <div class="event-content">
                <h3>Community Q&A Session</h3>
                <p>Monthly Q&A session with our technical team</p>
                <div class="event-meta">
                  <span><v-icon size="16">mdi-clock</v-icon> 7:00 PM EST</span>
                  <span><v-icon size="16">mdi-map-marker</v-icon> Virtual Event</span>
                  <span><v-icon size="16">mdi-account-group</v-icon> 89 registered</span>
                </div>
                <v-btn color="primary" variant="outlined" class="event-btn">
                  Register Now
                </v-btn>
              </div>
            </div>

            <div class="event-card">
              <div class="event-date">
                <span class="day">15</span>
                <span class="month">Feb</span>
              </div>
              <div class="event-content">
                <h3>Hackathon Kickoff</h3>
                <p>48-hour hackathon to build innovative AI solutions</p>
                <div class="event-meta">
                  <span><v-icon size="16">mdi-clock</v-icon> 9:00 AM EST</span>
                  <span><v-icon size="16">mdi-map-marker</v-icon> Virtual Event</span>
                  <span><v-icon size="16">mdi-account-group</v-icon> 234 registered</span>
                </div>
                <v-btn color="primary" variant="outlined" class="event-btn">
                  Register Now
                </v-btn>
              </div>
            </div>
          </div>
        </section>

        <section class="community-section">
          <h2>🏆 Community Showcase</h2>
          
          <div class="showcase-grid">
            <div class="showcase-card">
              <div class="showcase-image">
                <v-icon size="48" color="primary">mdi-robot</v-icon>
              </div>
              <div class="showcase-content">
                <h3>E-commerce Assistant Bot</h3>
                <p>An intelligent shopping assistant that helps customers find products and complete purchases</p>
                <div class="showcase-author">
                  <span>by @shop_bot_dev</span>
                  <span class="showcase-stats">1.2k views • 45 likes</span>
                </div>
                <div class="showcase-tags">
                  <span class="tag">Bot Development</span>
                  <span class="tag">E-commerce</span>
                  <span class="tag">NLP</span>
                </div>
              </div>
            </div>

            <div class="showcase-card">
              <div class="showcase-image">
                <v-icon size="48" color="primary">mdi-brain</v-icon>
              </div>
              <div class="showcase-content">
                <h3>Medical Diagnosis Model</h3>
                <p>A fine-tuned model for preliminary medical diagnosis based on symptoms</p>
                <div class="showcase-author">
                  <span>by @med_ai_researcher</span>
                  <span class="showcase-stats">890 views • 67 likes</span>
                </div>
                <div class="showcase-tags">
                  <span class="tag">Model Training</span>
                  <span class="tag">Healthcare</span>
                  <span class="tag">Fine-tuning</span>
                </div>
              </div>
            </div>

            <div class="showcase-card">
              <div class="showcase-image">
                <v-icon size="48" color="primary">mdi-timeline</v-icon>
              </div>
              <div class="showcase-content">
                <h3>Real-time Data Processing</h3>
                <p>A pipeline for processing real-time sensor data with anomaly detection</p>
                <div class="showcase-author">
                  <span>by @iot_engineer</span>
                  <span class="showcase-stats">650 views • 38 likes</span>
                </div>
                <div class="showcase-tags">
                  <span class="tag">Pipeline</span>
                  <span class="tag">IoT</span>
                  <span class="tag">Real-time</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="community-section">
          <h2>🤝 Get Involved</h2>
          
          <div class="involvement-grid">
            <div class="involvement-card">
              <v-icon size="48" color="primary">mdi-github</v-icon>
              <h3>Open Source</h3>
              <p>Contribute to our open-source projects and help improve the platform</p>
              <v-btn color="primary" variant="outlined" class="involvement-btn">
                View Projects
              </v-btn>
            </div>

            <div class="involvement-card">
              <v-icon size="48" color="primary">mdi-book-open-variant</v-icon>
              <h3>Write Tutorials</h3>
              <p>Share your knowledge by writing tutorials and guides for the community</p>
              <v-btn color="primary" variant="outlined" class="involvement-btn">
                Submit Tutorial
              </v-btn>
            </div>

            <div class="involvement-card">
              <v-icon size="48" color="primary">mdi-presentation</v-icon>
              <h3>Speak at Events</h3>
              <p>Share your expertise by speaking at our community events</p>
              <v-btn color="primary" variant="outlined" class="involvement-btn">
                Apply to Speak
              </v-btn>
            </div>

            <div class="involvement-card">
              <v-icon size="48" color="primary">mdi-account-group</v-icon>
              <h3>Mentor Others</h3>
              <p>Help newcomers by becoming a community mentor</p>
              <v-btn color="primary" variant="outlined" class="involvement-btn">
                Become Mentor
              </v-btn>
            </div>
          </div>
        </section>

        <section class="community-section">
          <h2>📱 Connect With Us</h2>
          
          <div class="social-grid">
            <div class="social-card">
              <v-icon size="48" color="primary">mdi-discord</v-icon>
              <h3>Discord Server</h3>
              <p>Join our Discord for real-time discussions and support</p>
              <div class="social-stats">
                <span>3,000+ members</span>
                <span>24/7 active</span>
              </div>
              <v-btn color="primary" variant="elevated" class="social-btn">
                Join Discord
              </v-btn>
            </div>

            <div class="social-card">
              <v-icon size="48" color="primary">mdi-github</v-icon>
              <h3>GitHub Community</h3>
              <p>Collaborate on open-source projects and share code</p>
              <div class="social-stats">
                <span>500+ repositories</span>
                <span>2,000+ stars</span>
              </div>
              <v-btn color="primary" variant="outlined" class="social-btn">
                Visit GitHub
              </v-btn>
            </div>

            <div class="social-card">
              <v-icon size="48" color="primary">mdi-twitter</v-icon>
              <h3>Twitter</h3>
              <p>Follow us for updates, tips, and community highlights</p>
              <div class="social-stats">
                <span>15,000+ followers</span>
                <span>Daily updates</span>
              </div>
              <v-btn color="primary" variant="outlined" class="social-btn">
                Follow Us
              </v-btn>
            </div>

            <div class="social-card">
              <v-icon size="48" color="primary">mdi-linkedin</v-icon>
              <h3>LinkedIn</h3>
              <p>Connect with professionals and stay updated on industry news</p>
              <div class="social-stats">
                <span>8,000+ connections</span>
                <span>Weekly insights</span>
              </div>
              <v-btn color="primary" variant="outlined" class="social-btn">
                Connect
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

.community-section {
  margin-bottom: 4rem;
}

.community-section:last-child {
  margin-bottom: 0;
}

.community-section h2 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}

.welcome-text {
  font-size: 1.1rem;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.7;
  text-align: center;
  margin-bottom: 2rem;
}

.community-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

.forums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.forum-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.forum-card:hover {
  transform: translateY(-2px);
}

.forum-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.forum-header h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.forum-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.forum-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.6);
}

.recent-topics {
  margin-bottom: 1.5rem;
}

.topic {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.topic:last-child {
  border-bottom: none;
}

.topic-title {
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.8);
  font-weight: 500;
}

.topic-author {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.6);
}

.forum-btn {
  width: 100%;
}

.challenges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.challenge-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.challenge-card.featured {
  border: 2px solid #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
}

.challenge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.challenge-badge {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.challenge-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.challenge-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.challenge-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.6);
}

.challenge-meta span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.challenge-btn {
  width: 100%;
}

.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.event-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.event-card.upcoming {
  border: 2px solid #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
}

.event-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
  border-radius: 12px;
  min-width: 80px;
  text-align: center;
}

.day {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.month {
  font-size: 0.9rem;
  font-weight: 600;
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

.event-content p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.event-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.6);
}

.event-meta span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.event-btn {
  width: 100%;
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.showcase-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.showcase-image {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  width: 80px;
  height: 80px;
  border-radius: 12px;
  flex-shrink: 0;
}

.showcase-content {
  flex: 1;
}

.showcase-content h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.showcase-content p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.showcase-author {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.showcase-author span:first-child {
  color: rgba(0, 0, 0, 0.8);
  font-weight: 500;
}

.showcase-stats {
  color: rgba(0, 0, 0, 0.6);
}

.showcase-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.involvement-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.involvement-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.involvement-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 1rem 0 0.5rem 0;
}

.involvement-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.involvement-btn {
  width: 100%;
}

.social-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.social-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.social-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 1rem 0 0.5rem 0;
}

.social-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.social-stats {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.6);
}

.social-btn {
  width: 100%;
}

@media (max-width: 768px) {
  .community-page {
    padding: 1rem;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .content-container {
    padding: 2rem;
  }
  
  .community-section h2 {
    font-size: 1.5rem;
  }
  
  .community-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .forums-grid,
  .challenges-grid,
  .events-grid,
  .showcase-grid {
    grid-template-columns: 1fr;
  }
  
  .event-card,
  .showcase-card {
    flex-direction: column;
  }
  
  .event-date,
  .showcase-image {
    align-self: center;
  }
  
  .involvement-grid,
  .social-grid {
    grid-template-columns: 1fr;
  }
}
</style> 