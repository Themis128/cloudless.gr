<template>
  <div class="blog-page">
    <div class="page-header">
      <h1>Blog</h1>
      <p class="subtitle">
        Insights, tutorials, and updates from the Cloudless Wizard team
      </p>
    </div>

    <div class="content-container">
      <div class="blog-content">
        <div class="featured-section">
          <h2>Featured Articles</h2>
          <div class="featured-grid">
            <div class="featured-card featured-main">
              <div class="featured-image">
                <v-icon size="80" color="primary">
                  mdi-robot
                </v-icon>
              </div>
              <div class="featured-content">
                <div class="article-meta">
                  <span class="category">AI & ML</span>
                  <span class="date">March 15, 2025</span>
                  <span class="read-time">8 min read</span>
                </div>
                <h3>Building Intelligent Chatbots with Cloudless Wizard</h3>
                <p>
                  Learn how to create sophisticated chatbots using our AI-powered bot builder. 
                  We'll walk through the complete process from data preparation to deployment, 
                  including best practices for training custom models and optimizing performance.
                </p>
                <div class="article-tags">
                  <span class="tag">Chatbots</span>
                  <span class="tag">AI</span>
                  <span class="tag">Tutorial</span>
                  <span class="tag">NLP</span>
                </div>
                <v-btn color="primary" variant="elevated" class="read-more">
                  Read Full Article
                  <v-icon right>
                    mdi-arrow-right
                  </v-icon>
                </v-btn>
              </div>
            </div>
          
            <div class="featured-sidebar">
              <div class="featured-card featured-side">
                <div class="featured-image">
                  <v-icon size="48" color="success">
                    mdi-chart-line
                  </v-icon>
                </div>
                <div class="featured-content">
                  <div class="article-meta">
                    <span class="category">Performance</span>
                    <span class="date">March 12, 2025</span>
                  </div>
                  <h4>Optimizing Cloud Costs with AI</h4>
                  <p>Discover how machine learning can help you reduce cloud infrastructure costs by up to 40%.</p>
                  <v-btn color="primary" variant="text" class="read-more-small">
                    Read More
                  </v-btn>
                </div>
              </div>
            
              <div class="featured-card featured-side">
                <div class="featured-image">
                  <v-icon size="48" color="warning">
                    mdi-rocket-launch
                  </v-icon>
                </div>
                <div class="featured-content">
                  <div class="article-meta">
                    <span class="category">Deployment</span>
                    <span class="date">March 10, 2025</span>
                  </div>
                  <h4>Zero-Downtime Deployments</h4>
                  <p>Learn the strategies and tools for deploying applications without any service interruption.</p>
                  <v-btn color="primary" variant="text" class="read-more-small">
                    Read More
                  </v-btn>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="articles-section">
          <div class="section-header">
            <h2>Latest Articles</h2>
            <div class="filter-controls">
              <v-select
                v-model="selectedCategory"
                :items="categories"
                label="Filter by category"
                variant="outlined"
                density="compact"
                hide-details
                class="category-filter"
              />
              <v-text-field
                v-model="searchQuery"
                placeholder="Search articles..."
                variant="outlined"
                density="compact"
                hide-details
                class="search-filter"
                prepend-inner-icon="mdi-magnify"
              />
            </div>
          </div>

          <div class="articles-grid">
            <div v-for="article in filteredArticles" :key="article.id" class="article-card">
              <div class="article-image">
                <v-icon size="48" :color="article.iconColor">
                  {{ article.icon }}
                </v-icon>
              </div>
              <div class="article-content">
                <div class="article-meta">
                  <span class="category">{{ article.category }}</span>
                  <span class="date">{{ article.date }}</span>
                  <span class="read-time">{{ article.readTime }}</span>
                </div>
                <h3>{{ article.title }}</h3>
                <p>{{ article.excerpt }}</p>
                <div class="article-tags">
                  <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
                </div>
                <div class="article-footer">
                  <div class="author-info">
                    <v-icon size="16" color="primary">
                      mdi-account-circle
                    </v-icon>
                    <span>{{ article.author }}</span>
                  </div>
                  <v-btn color="primary" variant="text" class="read-more">
                    Read More
                    <v-icon right>
                      mdi-arrow-right
                    </v-icon>
                  </v-btn>
                </div>
              </div>
            </div>
          </div>

          <div class="pagination-section">
            <v-pagination
              v-model="currentPage"
              :length="totalPages"
              :total-visible="7"
              color="primary"
            />
          </div>
        </div>

        <div class="categories-section">
          <h2>Browse by Category</h2>
          <div class="categories-grid">
            <div v-for="category in categoryStats" :key="category.name" class="category-card">
              <div class="category-icon">
                <v-icon size="32" :color="category.color">
                  {{ category.icon }}
                </v-icon>
              </div>
              <h3>{{ category.name }}</h3>
              <p>{{ category.description }}</p>
              <div class="category-stats">
                <span>{{ category.articleCount }} articles</span>
              </div>
              <v-btn color="primary" variant="text" class="category-btn">
                Browse {{ category.name }}
              </v-btn>
            </div>
          </div>
        </div>

        <div class="newsletter-section">
          <div class="newsletter-card">
            <div class="newsletter-content">
              <h2>Stay Updated</h2>
              <p>
                Get the latest articles, tutorials, and product updates delivered to your inbox. 
                No spam, just valuable content for developers building the future.
              </p>
              <div class="newsletter-features">
                <div class="newsletter-feature">
                  <v-icon size="20" color="success">
                    mdi-check
                  </v-icon>
                  <span>Weekly curated content</span>
                </div>
                <div class="newsletter-feature">
                  <v-icon size="20" color="success">
                    mdi-check
                  </v-icon>
                  <span>Exclusive tutorials</span>
                </div>
                <div class="newsletter-feature">
                  <v-icon size="20" color="success">
                    mdi-check
                  </v-icon>
                  <span>Product announcements</span>
                </div>
              </div>
              <div class="newsletter-form">
                <v-text-field
                  v-model="email"
                  placeholder="Enter your email"
                  variant="outlined"
                  density="compact"
                  class="email-input"
                />
                <v-btn color="primary" variant="elevated" class="subscribe-btn">
                  Subscribe
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const selectedCategory = ref('All')
const searchQuery = ref('')
const currentPage = ref(1)
const email = ref('')

const categories = ['All', 'AI & ML', 'Tutorials', 'Product Updates', 'Performance', 'Deployment']

const articles = ref([
  {
    id: 1,
    title: 'Getting Started with Cloudless Wizard',
    excerpt: 'A comprehensive guide to building your first AI-powered application using our platform.',
    category: 'Tutorials',
    date: 'March 14, 2025',
    readTime: '5 min read',
    author: 'Sarah Chen',
    icon: 'mdi-rocket-launch',
    iconColor: 'primary',
    tags: ['Getting Started', 'Tutorial', 'AI']
  },
  {
    id: 2,
    title: 'Understanding AI Model Training',
    excerpt: 'Deep dive into the fundamentals of machine learning model training and optimization.',
    category: 'AI & ML',
    date: 'March 13, 2025',
    readTime: '12 min read',
    author: 'Dr. Michael Rodriguez',
    icon: 'mdi-brain',
    iconColor: 'purple',
    tags: ['Machine Learning', 'Training', 'AI']
  },
  {
    id: 3,
    title: 'New Features: Enhanced Pipeline Builder',
    excerpt: 'Discover the latest improvements to our pipeline builder with drag-and-drop functionality.',
    category: 'Product Updates',
    date: 'March 12, 2025',
    readTime: '3 min read',
    author: 'Alex Thompson',
    icon: 'mdi-update',
    iconColor: 'success',
    tags: ['Product Update', 'Pipeline', 'Features']
  },
  {
    id: 4,
    title: 'Optimizing Model Performance',
    excerpt: 'Best practices for improving the performance and accuracy of your AI models.',
    category: 'Performance',
    date: 'March 11, 2025',
    readTime: '8 min read',
    author: 'Lisa Wang',
    icon: 'mdi-speedometer',
    iconColor: 'warning',
    tags: ['Performance', 'Optimization', 'AI']
  },
  {
    id: 5,
    title: 'Deploying Models to Production',
    excerpt: 'Step-by-step guide to deploying your trained models to production environments.',
    category: 'Deployment',
    date: 'March 10, 2025',
    readTime: '10 min read',
    author: 'David Kim',
    icon: 'mdi-server',
    iconColor: 'info',
    tags: ['Deployment', 'Production', 'DevOps']
  },
  {
    id: 6,
    title: 'Building Custom Chatbots',
    excerpt: 'Learn how to create intelligent chatbots that can handle complex conversations.',
    category: 'AI & ML',
    date: 'March 9, 2025',
    readTime: '15 min read',
    author: 'Emma Wilson',
    icon: 'mdi-chat',
    iconColor: 'teal',
    tags: ['Chatbots', 'NLP', 'AI']
  }
])

const categoryStats = ref([
  {
    name: 'AI & ML',
    description: 'Articles about artificial intelligence and machine learning',
    articleCount: 15,
    icon: 'mdi-brain',
    color: 'purple'
  },
  {
    name: 'Tutorials',
    description: 'Step-by-step guides and how-to articles',
    articleCount: 12,
    icon: 'mdi-school',
    color: 'primary'
  },
  {
    name: 'Product Updates',
    description: 'Latest features and platform improvements',
    articleCount: 8,
    icon: 'mdi-update',
    color: 'success'
  },
  {
    name: 'Performance',
    description: 'Tips and tricks for optimizing your applications',
    articleCount: 6,
    icon: 'mdi-speedometer',
    color: 'warning'
  },
  {
    name: 'Deployment',
    description: 'Deployment strategies and best practices',
    articleCount: 4,
    icon: 'mdi-server',
    color: 'info'
  }
])

const filteredArticles = computed(() => {
  let filtered = articles.value

  if (selectedCategory.value !== 'All') {
    filtered = filtered.filter(article => article.category === selectedCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(article => 
      article.title.toLowerCase().includes(query) ||
      article.excerpt.toLowerCase().includes(query) ||
      article.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }

  return filtered
})

const totalPages = computed(() => Math.ceil(filteredArticles.value.length / 6))
</script>

<style scoped>
.blog-page {
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

.blog-content {
  max-width: 1000px;
  margin: 0 auto;
}

.featured-section {
  margin-bottom: 4rem;
}

.featured-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.featured-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.featured-main {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  display: flex;
  gap: 2rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.featured-main:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.featured-image {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.featured-content {
  flex: 1;
}

.article-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.category {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.date, .read-time {
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.8rem;
}

.featured-main h3 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
  line-height: 1.3;
}

.featured-main p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tag {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.featured-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.featured-side {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.featured-side:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.featured-side .featured-image {
  min-width: 60px;
}

.featured-side h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.featured-side p {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.read-more-small {
  font-size: 0.8rem;
  padding: 0;
  min-width: auto;
}

.articles-section {
  margin-bottom: 4rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-header h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.filter-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.category-filter {
  min-width: 150px;
}

.search-filter {
  min-width: 200px;
}

.articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.article-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.article-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.article-image {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.article-content h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
  line-height: 1.4;
}

.article-content p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.article-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.9rem;
}

.pagination-section {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}

.categories-section {
  margin-bottom: 4rem;
}

.categories-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.category-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.category-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.category-icon {
  margin-bottom: 1rem;
}

.category-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.category-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin-bottom: 1rem;
}

.category-stats {
  margin-bottom: 1.5rem;
}

.category-stats span {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.category-btn {
  font-size: 0.9rem;
}

.newsletter-section {
  margin-top: 4rem;
}

.newsletter-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  color: white;
}

.newsletter-content h2 {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.newsletter-content p {
  font-size: 1.1rem;
  margin-bottom: 2rem;
  opacity: 0.9;
  line-height: 1.6;
}

.newsletter-features {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.newsletter-feature {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.newsletter-form {
  display: flex;
  gap: 1rem;
  max-width: 500px;
  margin: 0 auto;
  flex-wrap: wrap;
}

.email-input {
  flex: 1;
  min-width: 250px;
}

.subscribe-btn {
  white-space: nowrap;
}

@media (max-width: 768px) {
  .blog-page {
    padding: 1rem;
  }
  
  .content-container {
    padding: 2rem;
  }
  
  .featured-grid {
    grid-template-columns: 1fr;
  }
  
  .featured-main {
    flex-direction: column;
    text-align: center;
  }
  
  .articles-grid {
    grid-template-columns: 1fr;
  }
  
  .categories-grid {
    grid-template-columns: 1fr;
  }
  
  .newsletter-features {
    flex-direction: column;
    align-items: center;
  }
  
  .newsletter-form {
    flex-direction: column;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-controls {
    flex-direction: column;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
}
</style> 