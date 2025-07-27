<template>
  <div>
    <v-container class="blog-page">
      <!-- Hero Section -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <h1 class="text-h2 font-weight-bold mb-4">
            Blog
          </h1>
          <p class="text-h6 text-medium-emphasis">
            Insights, tutorials, and updates from the Cloudless Wizard team
          </p>
        </v-col>
      </v-row>

      <!-- Featured Articles Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <div class="text-center mb-8">
            <h2 class="text-h3 font-weight-bold mb-4">
              Featured Articles
            </h2>
          </div>

          <v-row>
            <!-- Main Featured Article -->
            <v-col cols="12" lg="8" class="mb-6">
              <BlogCard 
                :article="featuredArticle" 
                :featured="true"
                @click="handleArticleClick(featuredArticle)"
              />
            </v-col>

            <!-- Sidebar Featured Articles -->
            <v-col cols="12" lg="4">
              <v-row>
                <v-col 
                  v-for="article in sidebarArticles" 
                  :key="article.id"
                  cols="12"
                  class="mb-6"
                >
                  <BlogCard 
                    :article="article" 
                    :compact="true"
                    @click="handleArticleClick(article)"
                  />
                </v-col>
              </v-row>
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <!-- Filter and Search Section -->
      <v-row class="mb-8">
        <v-col cols="12">
          <v-card class="filter-card" elevation="2">
            <v-card-text class="pa-6">
              <v-row align="center">
                <v-col cols="12" md="4">
                  <v-select
                    v-model="selectedCategory"
                    :items="categories"
                    label="Filter by category"
                    variant="outlined"
                    density="compact"
                    hide-details
                    clearable
                    :ripple="false"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="selectedTag"
                    :items="tags"
                    label="Filter by tag"
                    variant="outlined"
                    density="compact"
                    hide-details
                    clearable
                    :ripple="false"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="searchQuery"
                    placeholder="Search articles..."
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                    hide-details
                    @update:model-value="filterArticles"
                    :ripple="false"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Latest Articles Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <div class="text-center mb-8">
            <h2 class="text-h3 font-weight-bold mb-4">
              Latest Articles
            </h2>
            <p class="text-body-1 text-medium-emphasis">
              {{ filteredArticles.length }} articles found
            </p>
          </div>

          <v-row>
            <v-col 
              v-for="article in filteredArticles" 
              :key="article.id"
              cols="12" 
              md="6" 
              lg="4"
              class="mb-6"
            >
              <BlogCard 
                :article="article"
                @click="handleArticleClick(article)"
              />
            </v-col>
          </v-row>

          <!-- Load More Button -->
          <v-row v-if="hasMoreArticles" justify="center" class="mt-8">
            <v-col cols="12" sm="6" md="4" class="text-center">
              <v-btn
                color="primary"
                variant="outlined"
                size="large"
                @click="loadMoreArticles"
                :loading="loading"
                :ripple="false"
              >
                <v-icon start>mdi-plus</v-icon>
                Load More Articles
              </v-btn>
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <!-- Newsletter Section -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6">
          <v-card class="newsletter-card" elevation="8" color="primary">
            <v-card-text class="pa-8 text-center">
              <v-icon size="64" color="white" class="mb-4">
                mdi-email-newsletter
              </v-icon>
              <h2 class="text-h4 font-weight-bold mb-4 text-white">
                Stay Updated
              </h2>
              <p class="text-h6 text-white mb-6">
                Get the latest insights and tutorials delivered to your inbox
              </p>
              
              <v-form @submit.prevent="subscribeNewsletter" ref="newsletterFormRef">
                <v-row>
                  <v-col cols="12" sm="8">
                    <v-text-field
                      v-model="newsletterEmail"
                      placeholder="Enter your email address"
                      variant="outlined"
                      type="email"
                      required
                      :rules="[
                        v => !!v || 'Email is required',
                        v => /.+@.+\..+/.test(v) || 'Email must be valid'
                      ]"
                      :disabled="subscribing"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="12" sm="4">
                    <v-btn
                      type="submit"
                      color="white"
                      size="large"
                      :loading="subscribing"
                      :disabled="subscribing"
                      block
                      :ripple="false"
                    >
                      Subscribe
                    </v-btn>
                  </v-col>
                </v-row>
              </v-form>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '@/stores/useNotificationsStore'

// Types
interface Article {
  id: string
  title: string
  excerpt: string
  content: string
  category: string
  tags: string[]
  author: string
  publishDate: string
  readTime: string
  featured: boolean
  image?: string
}

// Composables
const router = useRouter()
const notificationsStore = useNotificationsStore()

// Form refs
const newsletterFormRef = ref()

// Reactive state
const selectedCategory = ref('')
const selectedTag = ref('')
const searchQuery = ref('')
const loading = ref(false)
const subscribing = ref(false)
const newsletterEmail = ref('')

// Blog data
const featuredArticle: Article = {
  id: 'building-intelligent-chatbots',
  title: 'Building Intelligent Chatbots with Cloudless Wizard',
  excerpt: 'Learn how to create sophisticated chatbots using our AI-powered bot builder. We\'ll walk through the complete process from data preparation to deployment.',
  content: 'Full article content here...',
  category: 'AI & ML',
  tags: ['Chatbots', 'AI', 'Tutorial', 'NLP'],
  author: 'Sarah Chen',
  publishDate: 'March 15, 2025',
  readTime: '8 min read',
  featured: true,
  image: '/blog/chatbots.jpg'
}

const sidebarArticles: Article[] = [
  {
    id: 'optimizing-cloud-costs',
    title: 'Optimizing Cloud Costs with AI',
    excerpt: 'Discover how machine learning can help you reduce cloud infrastructure costs by up to 40%.',
    content: 'Full article content here...',
    category: 'Performance',
    tags: ['Cloud', 'Cost Optimization', 'AI'],
    author: 'Michael Rodriguez',
    publishDate: 'March 12, 2025',
    readTime: '5 min read',
    featured: false,
    image: '/blog/cloud-costs.jpg'
  },
  {
    id: 'zero-downtime-deployments',
    title: 'Zero-Downtime Deployments',
    excerpt: 'Learn the strategies and tools for deploying applications without any service interruption.',
    content: 'Full article content here...',
    category: 'Deployment',
    tags: ['Deployment', 'DevOps', 'CI/CD'],
    author: 'Emily Watson',
    publishDate: 'March 10, 2025',
    readTime: '6 min read',
    featured: false,
    image: '/blog/deployments.jpg'
  }
]

const articles: Article[] = [
  {
    id: 'ai-model-optimization',
    title: 'Advanced AI Model Optimization Techniques',
    excerpt: 'Explore cutting-edge techniques for optimizing AI model performance and reducing inference time.',
    content: 'Full article content here...',
    category: 'AI & ML',
    tags: ['AI', 'Optimization', 'Performance'],
    author: 'Alex Johnson',
    publishDate: 'March 8, 2025',
    readTime: '10 min read',
    featured: false
  },
  {
    id: 'data-pipeline-design',
    title: 'Designing Scalable Data Pipelines',
    excerpt: 'Best practices for building robust and scalable data processing pipelines for AI applications.',
    content: 'Full article content here...',
    category: 'Data Engineering',
    tags: ['Data Pipelines', 'Scalability', 'Architecture'],
    author: 'David Kim',
    publishDate: 'March 5, 2025',
    readTime: '12 min read',
    featured: false
  },
  {
    id: 'mlops-best-practices',
    title: 'MLOps Best Practices for Production',
    excerpt: 'Essential practices for managing machine learning models in production environments.',
    content: 'Full article content here...',
    category: 'MLOps',
    tags: ['MLOps', 'Production', 'Best Practices'],
    author: 'Lisa Wang',
    publishDate: 'March 3, 2025',
    readTime: '15 min read',
    featured: false
  },
  {
    id: 'ai-ethics-guidelines',
    title: 'AI Ethics and Responsible Development',
    excerpt: 'Guidelines for developing AI systems that are fair, transparent, and accountable.',
    content: 'Full article content here...',
    category: 'AI Ethics',
    tags: ['AI Ethics', 'Responsible AI', 'Transparency'],
    author: 'Sarah Chen',
    publishDate: 'March 1, 2025',
    readTime: '8 min read',
    featured: false
  },
  {
    id: 'real-time-analytics',
    title: 'Building Real-Time Analytics with AI',
    excerpt: 'How to implement real-time analytics systems using AI and streaming data technologies.',
    content: 'Full article content here...',
    category: 'Analytics',
    tags: ['Analytics', 'Real-time', 'Streaming'],
    author: 'Michael Rodriguez',
    publishDate: 'February 28, 2025',
    readTime: '11 min read',
    featured: false
  },
  {
    id: 'ai-security-best-practices',
    title: 'AI Security Best Practices',
    excerpt: 'Protecting your AI systems from security threats and ensuring data privacy.',
    content: 'Full article content here...',
    category: 'Security',
    tags: ['Security', 'AI', 'Privacy'],
    author: 'Emily Watson',
    publishDate: 'February 25, 2025',
    readTime: '9 min read',
    featured: false
  }
]

// Computed properties
const categories = computed(() => {
  const allCategories = [
    featuredArticle.category,
    ...sidebarArticles.map(a => a.category),
    ...articles.map(a => a.category)
  ]
  return [...new Set(allCategories)].sort()
})

const tags = computed(() => {
  const allTags = [
    ...featuredArticle.tags,
    ...sidebarArticles.flatMap(a => a.tags),
    ...articles.flatMap(a => a.tags)
  ]
  return [...new Set(allTags)].sort()
})

const filteredArticles = computed(() => {
  let filtered = articles

  if (selectedCategory.value) {
    filtered = filtered.filter(article => article.category === selectedCategory.value)
  }

  if (selectedTag.value) {
    filtered = filtered.filter(article => article.tags.includes(selectedTag.value))
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(article =>
      article.title.toLowerCase().includes(query) ||
      article.excerpt.toLowerCase().includes(query) ||
      article.content.toLowerCase().includes(query) ||
      article.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }

  return filtered
})

const hasMoreArticles = computed(() => {
  // This would typically check against a pagination system
  return false
})

// Methods
const filterArticles = () => {
  // The filtering is handled by computed properties
  notificationsStore.info('Filter Applied', `Showing ${filteredArticles.value.length} articles`)
}

const handleArticleClick = (article: Article) => {
  try {
    router.push(`/blog/${article.id}`)
    notificationsStore.info('Article', `Opening: ${article.title}`)
  } catch (error) {
    notificationsStore.error('Error', 'Failed to open article')
  }
}

const loadMoreArticles = async () => {
  loading.value = true
  try {
    // Simulate loading more articles
    await new Promise(resolve => setTimeout(resolve, 1000))
    notificationsStore.success('Articles Loaded', 'More articles have been loaded')
  } catch (error) {
    notificationsStore.error('Error', 'Failed to load more articles')
  } finally {
    loading.value = false
  }
}

const subscribeNewsletter = async () => {
  const { valid } = await newsletterFormRef.value.validate()
  
  if (!valid) {
    notificationsStore.error('Validation Error', 'Please enter a valid email address')
    return
  }

  subscribing.value = true
  try {
    // Simulate newsletter subscription
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Reset form
    newsletterEmail.value = ''
    newsletterFormRef.value.resetValidation()
    
    notificationsStore.success('Subscribed!', 'Thank you for subscribing to our newsletter')
  } catch (error) {
    notificationsStore.error('Error', 'Failed to subscribe to newsletter')
  } finally {
    subscribing.value = false
  }
}

// Meta
definePageMeta({
  title: 'Blog - Cloudless Wizard',
  description: 'Insights, tutorials, and updates from the Cloudless Wizard team. Learn about AI development, best practices, and industry trends.',
  layout: 'default'
})
</script>

<style scoped>
.blog-page {
  max-width: 1200px;
  margin: 0 auto;
}

.filter-card {
  border-radius: 16px;
  transition: all 0.3s ease-in-out;
}

.filter-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.newsletter-card {
  background: linear-gradient(135deg, var(--v-theme-primary) 0%, var(--v-theme-secondary) 100%);
  border-radius: 16px;
}

/* Responsive improvements */
@media (max-width: 600px) {
  .blog-page {
    padding: 0 16px;
  }
}

/* Accessibility improvements */
:focus-visible {
  outline: 2px solid var(--v-theme-primary);
  outline-offset: 2px;
}

/* Smooth transitions */
.v-card {
  transition: all 0.3s ease-in-out;
}
</style> 