<template>
  <div class="blog-page">
    <div class="page-header">
      <h1>Blog</h1>
      <p class="subtitle">
        Insights, tutorials, and updates from the Cloudless Wizard team
      </p>
    </div>

    <div class="content-grid">
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
                <span>Early access to new features</span>
              </div>
              <div class="newsletter-feature">
                <v-icon size="20" color="success">
                  mdi-check
                </v-icon>
                <span>Exclusive tutorials and tips</span>
              </div>
            </div>
            <div class="newsletter-form">
              <v-text-field
                v-model="email"
                placeholder="Enter your email address"
                variant="outlined"
                density="compact"
                hide-details
                class="email-input"
              />
              <v-btn color="primary" variant="elevated" class="subscribe-btn">
                Subscribe
              </v-btn>
            </div>
            <p class="newsletter-note">
              Join 10,000+ developers who get our weekly insights
            </p>
          </div>
        </div>
      </div>

      <div class="popular-section">
        <h2>Most Popular Articles</h2>
        <div class="popular-grid">
          <div v-for="(article, index) in popularArticles" :key="article.id" class="popular-card">
            <div class="popular-rank">
              {{ index + 1 }}
            </div>
            <div class="popular-content">
              <h4>{{ article.title }}</h4>
              <div class="popular-meta">
                <span class="category">{{ article.category }}</span>
                <span class="views">{{ article.views }} views</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const selectedCategory = ref('All')
const searchQuery = ref('')
const email = ref('')
const currentPage = ref(1)
const totalPages = ref(5)

const categories = [
  'All',
  'AI & ML',
  'Tutorials',
  'Product Updates',
  'Case Studies',
  'Developer Tips',
  'Performance',
  'Security',
  'Deployment'
]

const articles = [
  {
    id: 1,
    title: 'Getting Started with Model Training',
    excerpt: 'A comprehensive guide to training your first AI model using Cloudless Wizard\'s intuitive interface. Learn data preprocessing, model selection, and deployment best practices.',
    category: 'Tutorials',
    date: 'March 12, 2025',
    readTime: '12 min read',
    author: 'Sarah Kim',
    icon: 'mdi-brain',
    iconColor: 'primary',
    tags: ['AI', 'Training', 'Beginner', 'MLOps']
  },
  {
    id: 2,
    title: 'New Features: Enhanced Pipeline Builder',
    excerpt: 'Discover the latest improvements to our pipeline builder, including new connectors, monitoring tools, and real-time data processing capabilities.',
    category: 'Product Updates',
    date: 'March 10, 2025',
    readTime: '6 min read',
    author: 'Marcus Rodriguez',
    icon: 'mdi-timeline',
    iconColor: 'success',
    tags: ['Pipeline', 'Features', 'Update', 'Real-time']
  },
  {
    id: 3,
    title: 'Optimizing Cloud Costs with AI',
    excerpt: 'Learn how to use machine learning to optimize your cloud infrastructure costs and improve performance. Real-world case studies and actionable strategies.',
    category: 'AI & ML',
    date: 'March 8, 2025',
    readTime: '15 min read',
    author: 'Dr. Emily Watson',
    icon: 'mdi-chart-line',
    iconColor: 'warning',
    tags: ['Cost Optimization', 'ML', 'Cloud', 'Case Study']
  },
  {
    id: 4,
    title: 'Case Study: E-commerce Bot Success',
    excerpt: 'How a leading e-commerce company increased customer satisfaction by 40% and reduced support costs by 60% using our chatbot platform.',
    category: 'Case Studies',
    date: 'March 5, 2025',
    readTime: '10 min read',
    author: 'Alex Chen',
    icon: 'mdi-shopping',
    iconColor: 'info',
    tags: ['Case Study', 'E-commerce', 'Success', 'Chatbot']
  },
  {
    id: 5,
    title: '10 Tips for Better Model Performance',
    excerpt: 'Expert tips and best practices for improving the performance of your machine learning models. From data quality to hyperparameter tuning.',
    category: 'Developer Tips',
    date: 'March 3, 2025',
    readTime: '8 min read',
    author: 'Dr. Emily Watson',
    icon: 'mdi-lightbulb',
    iconColor: 'secondary',
    tags: ['Tips', 'Performance', 'Best Practices', 'ML']
  },
  {
    id: 6,
    title: 'Deploying to Multiple Cloud Providers',
    excerpt: 'A step-by-step guide to deploying your applications across multiple cloud providers simultaneously. Learn about multi-cloud strategies and best practices.',
    category: 'Tutorials',
    date: 'March 1, 2025',
    readTime: '14 min read',
    author: 'Marcus Rodriguez',
    icon: 'mdi-cloud',
    iconColor: 'primary',
    tags: ['Deployment', 'Multi-cloud', 'Tutorial', 'DevOps']
  },
  {
    id: 7,
    title: 'Securing Your AI Applications',
    excerpt: 'Essential security practices for AI applications, including data protection, model security, and compliance considerations for enterprise deployments.',
    category: 'Security',
    date: 'February 28, 2025',
    readTime: '11 min read',
    author: 'Security Team',
    icon: 'mdi-shield-check',
    iconColor: 'error',
    tags: ['Security', 'AI', 'Compliance', 'Enterprise']
  },
  {
    id: 8,
    title: 'Building Real-time Data Pipelines',
    excerpt: 'Learn how to build scalable real-time data pipelines that can process millions of events per second with minimal latency.',
    category: 'Performance',
    date: 'February 25, 2025',
    readTime: '16 min read',
    author: 'Sarah Kim',
    icon: 'mdi-lightning-bolt',
    iconColor: 'warning',
    tags: ['Real-time', 'Performance', 'Data Pipeline', 'Scalability']
  }
]

const categoryStats = [
  {
    name: 'AI & ML',
    description: 'Latest developments in artificial intelligence and machine learning',
    articleCount: 15,
    icon: 'mdi-brain',
    color: 'primary'
  },
  {
    name: 'Tutorials',
    description: 'Step-by-step guides to help you master our platform',
    articleCount: 23,
    icon: 'mdi-school',
    color: 'success'
  },
  {
    name: 'Product Updates',
    description: 'New features and improvements to Cloudless Wizard',
    articleCount: 8,
    icon: 'mdi-update',
    color: 'info'
  },
  {
    name: 'Case Studies',
    description: 'Real-world success stories from our customers',
    articleCount: 12,
    icon: 'mdi-chart-box',
    color: 'warning'
  },
  {
    name: 'Developer Tips',
    description: 'Best practices and tips for better development',
    articleCount: 18,
    icon: 'mdi-lightbulb',
    color: 'secondary'
  },
  {
    name: 'Performance',
    description: 'Optimization strategies and performance insights',
    articleCount: 9,
    icon: 'mdi-speedometer',
    color: 'error'
  }
]

const popularArticles = [
  {
    id: 1,
    title: 'Building Intelligent Chatbots with Cloudless Wizard',
    category: 'AI & ML',
    views: '12.5K'
  },
  {
    id: 2,
    title: '10 Tips for Better Model Performance',
    category: 'Developer Tips',
    views: '8.9K'
  },
  {
    id: 3,
    title: 'Case Study: E-commerce Bot Success',
    category: 'Case Studies',
    views: '7.2K'
  },
  {
    id: 4,
    title: 'Optimizing Cloud Costs with AI',
    category: 'AI & ML',
    views: '6.8K'
  },
  {
    id: 5,
    title: 'Deploying to Multiple Cloud Providers',
    category: 'Tutorials',
    views: '5.4K'
  }
]

const filteredArticles = computed(() => {
  let filtered = articles

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

.content-grid {
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.featured-section,
.articles-section,
.categories-section,
.newsletter-section,
.popular-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.featured-section h2,
.articles-section h2,
.categories-section h2,
.popular-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.featured-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.featured-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.featured-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.featured-main {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.featured-image {
  flex-shrink: 0;
  text-align: center;
}

.featured-content h3 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
  line-height: 1.3;
}

.featured-content h4 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.featured-content p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.featured-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.featured-side {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.featured-side .featured-content h4 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.featured-side .featured-content p {
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.category {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.date,
.read-time {
  color: rgba(0, 0, 0, 0.5);
  font-size: 0.8rem;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tag {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.7);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.filter-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.category-filter,
.search-filter {
  min-width: 200px;
}

.articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

.article-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.article-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.article-image {
  margin-bottom: 1.5rem;
  text-align: center;
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

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.category-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.category-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.category-icon {
  margin-bottom: 1rem;
}

.category-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.category-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.category-stats {
  margin-bottom: 1.5rem;
}

.category-stats span {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.newsletter-card {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
}

.newsletter-content h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.newsletter-content p {
  font-size: 1.1rem;
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 2rem;
  line-height: 1.7;
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
  color: rgba(0, 0, 0, 0.7);
}

.newsletter-form {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.email-input {
  min-width: 300px;
}

.subscribe-btn {
  min-width: 120px;
}

.newsletter-note {
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.5);
  margin: 0;
}

.popular-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.popular-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.popular-card:hover {
  transform: translateX(4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.popular-rank {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.popular-content h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.popular-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.popular-meta .category {
  font-size: 0.8rem;
}

.views {
  color: rgba(0, 0, 0, 0.5);
  font-size: 0.8rem;
}

.read-more,
.read-more-small {
  font-weight: 500;
}

.read-more-small {
  font-size: 0.9rem;
}

.category-btn {
  font-weight: 500;
}

@media (max-width: 768px) {
  .blog-page {
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
  
  .featured-grid {
    grid-template-columns: 1fr;
  }
  
  .featured-main {
    flex-direction: column;
    text-align: center;
  }
  
  .featured-side {
    flex-direction: column;
    text-align: center;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-controls {
    flex-direction: column;
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
    align-items: center;
  }
  
  .email-input {
    min-width: auto;
    width: 100%;
  }
}
</style> 