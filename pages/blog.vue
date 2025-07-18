<template>
  <div class="blog-page">
    <div class="page-header">
      <h1>Blog</h1>
      <p class="subtitle">Insights, tutorials, and updates from the Cloudless Wizard team</p>
    </div>

    <div class="content-grid">
      <div class="featured-section">
        <h2>Featured Articles</h2>
        <div class="featured-grid">
          <div class="featured-card">
            <div class="featured-image">
              <v-icon size="64" color="primary">mdi-robot</v-icon>
            </div>
            <div class="featured-content">
              <div class="article-meta">
                <span class="category">AI & ML</span>
                <span class="date">March 15, 2025</span>
              </div>
              <h3>Building Intelligent Chatbots with Cloudless Wizard</h3>
              <p>
                Learn how to create sophisticated chatbots using our AI-powered bot builder. 
                We'll walk through the process of training custom models and deploying them 
                to production with just a few clicks.
              </p>
              <div class="article-tags">
                <span class="tag">Chatbots</span>
                <span class="tag">AI</span>
                <span class="tag">Tutorial</span>
              </div>
              <v-btn color="primary" variant="text" class="read-more">
                Read More
                <v-icon right>mdi-arrow-right</v-icon>
              </v-btn>
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
          </div>
        </div>

        <div class="articles-grid">
          <div class="article-card" v-for="article in filteredArticles" :key="article.id">
            <div class="article-image">
              <v-icon size="48" :color="article.iconColor">{{ article.icon }}</v-icon>
            </div>
            <div class="article-content">
              <div class="article-meta">
                <span class="category">{{ article.category }}</span>
                <span class="date">{{ article.date }}</span>
              </div>
              <h3>{{ article.title }}</h3>
              <p>{{ article.excerpt }}</p>
              <div class="article-tags">
                <span class="tag" v-for="tag in article.tags" :key="tag">{{ tag }}</span>
              </div>
              <v-btn color="primary" variant="text" class="read-more">
                Read More
                <v-icon right>mdi-arrow-right</v-icon>
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <div class="newsletter-section">
        <div class="newsletter-card">
          <div class="newsletter-content">
            <h2>Stay Updated</h2>
            <p>
              Get the latest articles, tutorials, and product updates delivered to your inbox. 
              No spam, just valuable content for developers.
            </p>
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const selectedCategory = ref('All')
const email = ref('')

const categories = [
  'All',
  'AI & ML',
  'Tutorials',
  'Product Updates',
  'Case Studies',
  'Developer Tips'
]

const articles = [
  {
    id: 1,
    title: 'Getting Started with Model Training',
    excerpt: 'A comprehensive guide to training your first AI model using Cloudless Wizard\'s intuitive interface.',
    category: 'Tutorials',
    date: 'March 12, 2025',
    icon: 'mdi-brain',
    iconColor: 'primary',
    tags: ['AI', 'Training', 'Beginner']
  },
  {
    id: 2,
    title: 'New Features: Enhanced Pipeline Builder',
    excerpt: 'Discover the latest improvements to our pipeline builder, including new connectors and monitoring tools.',
    category: 'Product Updates',
    date: 'March 10, 2025',
    icon: 'mdi-timeline',
    iconColor: 'success',
    tags: ['Pipeline', 'Features', 'Update']
  },
  {
    id: 3,
    title: 'Optimizing Cloud Costs with AI',
    excerpt: 'Learn how to use machine learning to optimize your cloud infrastructure costs and improve performance.',
    category: 'AI & ML',
    date: 'March 8, 2025',
    icon: 'mdi-chart-line',
    iconColor: 'warning',
    tags: ['Cost Optimization', 'ML', 'Cloud']
  },
  {
    id: 4,
    title: 'Case Study: E-commerce Bot Success',
    excerpt: 'How a leading e-commerce company increased customer satisfaction by 40% using our chatbot platform.',
    category: 'Case Studies',
    date: 'March 5, 2025',
    icon: 'mdi-shopping',
    iconColor: 'info',
    tags: ['Case Study', 'E-commerce', 'Success']
  },
  {
    id: 5,
    title: '10 Tips for Better Model Performance',
    excerpt: 'Expert tips and best practices for improving the performance of your machine learning models.',
    category: 'Developer Tips',
    date: 'March 3, 2025',
    icon: 'mdi-lightbulb',
    iconColor: 'secondary',
    tags: ['Tips', 'Performance', 'Best Practices']
  },
  {
    id: 6,
    title: 'Deploying to Multiple Cloud Providers',
    excerpt: 'A step-by-step guide to deploying your applications across multiple cloud providers simultaneously.',
    category: 'Tutorials',
    date: 'March 1, 2025',
    icon: 'mdi-cloud',
    iconColor: 'primary',
    tags: ['Deployment', 'Multi-cloud', 'Tutorial']
  }
]

const filteredArticles = computed(() => {
  if (selectedCategory.value === 'All') {
    return articles
  }
  return articles.filter(article => article.category === selectedCategory.value)
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
.newsletter-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.featured-section h2,
.articles-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.featured-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

.featured-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 3rem;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.featured-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.featured-image {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 16px;
}

.featured-content h3 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.featured-content p {
  font-size: 1.1rem;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.category-filter {
  min-width: 200px;
}

.articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.article-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.category {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.date {
  color: rgba(0, 0, 0, 0.5);
  font-size: 0.9rem;
}

.article-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
  line-height: 1.4;
}

.article-card p {
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
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 500;
}

.read-more {
  padding: 0;
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
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
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
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .subtitle {
    font-size: 1rem;
  }
  
  .content-grid {
    gap: 3rem;
  }
  
  .featured-card {
    grid-template-columns: 1fr;
    text-align: center;
    padding: 2rem;
  }
  
  .featured-image {
    width: 100px;
    height: 100px;
    margin: 0 auto 1.5rem;
  }
  
  .featured-content h3 {
    font-size: 1.5rem;
  }
  
  .articles-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .category-filter {
    min-width: auto;
  }
  
  .newsletter-form {
    flex-direction: column;
  }
  
  .email-input {
    min-width: auto;
  }
}
</style> 