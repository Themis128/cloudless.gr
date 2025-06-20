<template>
  <div class="faq-page">
    <!-- Header -->
    <div class="page-header">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="mb-4"
        @click="navigateTo('/documentation')"
      >
        Back to Documentation
      </v-btn>

      <div class="header-content">
        <h1 class="text-h3 font-weight-bold mb-2">
          <v-icon icon="mdi-frequently-asked-questions" class="me-3" color="primary" />
          Frequently Asked Questions
        </h1>
        <p class="text-h6 text-medium-emphasis">
          Find answers to common questions about the Cloudless.gr platform
        </p>
      </div>
    </div>

    <!-- Search -->
    <v-card class="search-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <v-text-field
          v-model="searchQuery"
          label="Search FAQs..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          class="search-field"
          clearable
          @input="filterFAQs"
        />

        <div class="search-stats mt-2">
          <v-chip size="small" class="me-2"> {{ filteredFAQs.length }} questions </v-chip>
          <v-chip
            v-for="category in activeCategories"
            :key="category"
            size="small"
            class="me-2"
            closable
            @click:close="removeCategory(category)"
          >
            {{ category }}
          </v-chip>
        </div>
      </v-card-text>
    </v-card>

    <!-- Popular Questions -->
    <v-card class="popular-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">
          <v-icon icon="mdi-star" class="me-2" color="primary" />
          Most Popular Questions
        </h3>
        <v-row>
          <v-col v-for="faq in popularFAQs" :key="faq.id" cols="12" md="6">
            <v-card class="popular-item h-100" elevation="1" @click="scrollToFAQ(faq.id)">
              <v-card-text class="pa-4">
                <div class="d-flex align-center mb-2">
                  <v-icon
                    :icon="getCategoryIcon(faq.category)"
                    color="primary"
                    class="me-2"
                    size="small"
                  />
                  <v-chip size="x-small" color="primary" variant="outlined">{{
                    faq.category
                  }}</v-chip>
                </div>
                <h4 class="text-body-1 font-weight-medium">{{ faq.question }}</h4>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- FAQ Categories -->
    <div class="faq-categories">
      <div v-for="category in categories" :key="category.name" class="category-section mb-8">
        <v-card elevation="2">
          <v-card-text class="pa-6">
            <div class="category-header mb-4">
              <h2 class="text-h4 font-weight-bold mb-2">
                <v-icon :icon="category.icon" class="me-3" :color="category.color" />
                {{ category.name }}
              </h2>
              <p class="text-body-1 text-medium-emphasis">{{ category.description }}</p>
            </div>

            <v-expansion-panels class="faq-panels">
              <v-expansion-panel
                v-for="faq in getFilteredFAQs(category.name)"
                :id="`faq-${faq.id}`"
                :key="faq.id"
                :title="faq.question"
              >
                <template #title>
                  <div class="faq-title">
                    <span class="font-weight-medium">{{ faq.question }}</span>
                    <v-chip v-if="faq.isPopular" size="x-small" color="warning" class="ms-2">
                      Popular
                    </v-chip>
                  </div>
                </template>

                <v-expansion-panel-text>
                  <div class="faq-content">
                    <div class="faq-answer mb-4">
                      <div v-html="faq.answer" />
                    </div>

                    <div v-if="faq.codeExample" class="code-example mb-4">
                      <h4 class="text-h6 font-weight-bold mb-2">Example</h4>
                      <v-code class="faq-code d-block">{{ faq.codeExample }}</v-code>
                    </div>

                    <div v-if="faq.relatedLinks" class="related-links mb-4">
                      <h4 class="text-h6 font-weight-bold mb-2">Related Resources</h4>
                      <div class="links-grid">
                        <v-btn
                          v-for="link in faq.relatedLinks"
                          :key="link.title"
                          :to="link.internal ? link.url : undefined"
                          :href="link.internal ? undefined : link.url"
                          :target="link.internal ? undefined : '_blank'"
                          variant="outlined"
                          size="small"
                          class="me-2 mb-2"
                        >
                          {{ link.title }}
                        </v-btn>
                      </div>
                    </div>

                    <div class="faq-feedback">
                      <v-divider class="mb-3" />
                      <div class="d-flex align-center justify-space-between">
                        <span class="text-body-2 text-medium-emphasis">Was this helpful?</span>
                        <div>
                          <v-btn
                            size="small"
                            variant="text"
                            prepend-icon="mdi-thumb-up"
                            @click="submitFeedback(faq.id, true)"
                          >
                            Yes
                          </v-btn>
                          <v-btn
                            size="small"
                            variant="text"
                            prepend-icon="mdi-thumb-down"
                            @click="submitFeedback(faq.id, false)"
                          >
                            No
                          </v-btn>
                        </div>
                      </div>
                    </div>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </div>
    </div>

    <!-- Contact Section -->
    <v-card class="contact-card" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">
          <v-icon icon="mdi-help-circle" class="me-2" color="primary" />
          Can't Find What You're Looking For?
        </h3>
        <p class="text-body-1 mb-4">
          If you can't find the answer to your question, we're here to help!
        </p>

        <v-row>
          <v-col cols="12" md="6">
            <v-card class="contact-option h-100" elevation="1">
              <v-card-text class="pa-4 text-center">
                <v-icon icon="mdi-email" size="48" color="primary" class="mb-3" />
                <h4 class="text-h6 font-weight-bold mb-2">Email Support</h4>
                <p class="text-body-2 mb-3">Get detailed help via email</p>
                <v-btn color="primary" href="mailto:support@cloudless.gr"> Contact Support </v-btn>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card class="contact-option h-100" elevation="1">
              <v-card-text class="pa-4 text-center">
                <v-icon icon="mdi-forum" size="48" color="primary" class="mb-3" />
                <h4 class="text-h6 font-weight-bold mb-2">Community Forum</h4>
                <p class="text-body-2 mb-3">Ask the community</p>
                <v-btn color="primary" href="https://forum.cloudless.gr" target="_blank">
                  Visit Forum
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'FAQ - Documentation',
  description: 'Frequently asked questions about the Cloudless.gr platform',
  layout: 'documentation',
});

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  isPopular?: boolean;
  codeExample?: string;
  relatedLinks?: Array<{
    title: string;
    url: string;
    internal?: boolean;
  }>;
}

const searchQuery = ref('');
const activeCategories = ref<string[]>([]);
const filteredFAQs = ref<FAQ[]>([]);

const categories = [
  {
    name: 'Getting Started',
    description: 'Basic questions about setting up and using the platform',
    icon: 'mdi-rocket-launch',
    color: 'primary',
  },
  {
    name: 'Projects',
    description: 'Questions about creating and managing projects',
    icon: 'mdi-folder',
    color: 'success',
  },
  {
    name: 'Training',
    description: 'Model training and data management questions',
    icon: 'mdi-brain',
    color: 'info',
  },
  {
    name: 'Deployment',
    description: 'Questions about deploying and scaling models',
    icon: 'mdi-cloud',
    color: 'warning',
  },
  {
    name: 'Billing',
    description: 'Pricing, plans, and billing questions',
    icon: 'mdi-credit-card',
    color: 'error',
  },
  {
    name: 'Technical',
    description: 'Technical questions and troubleshooting',
    icon: 'mdi-cog',
    color: 'purple',
  },
];

const allFAQs: FAQ[] = [
  {
    id: 'getting-started-1',
    question: 'How do I create my first project?',
    answer: `
      <p>Creating your first project is easy! Follow these steps:</p>
      <ol>
        <li>Log in to your Cloudless.gr account</li>
        <li>Navigate to the Projects section</li>
        <li>Click the "Create Project" button</li>
        <li>Choose a template or start from scratch</li>
        <li>Configure your project settings</li>
        <li>Click "Create" to launch your project</li>
      </ol>
      <p>Your project will be ready in just a few minutes!</p>
    `,
    category: 'Getting Started',
    isPopular: true,
    relatedLinks: [
      { title: 'Getting Started Guide', url: '/documentation/getting-started', internal: true },
      { title: 'Project Templates', url: '/projects/templates', internal: true },
    ],
  },
  {
    id: 'getting-started-2',
    question: 'What programming languages are supported?',
    answer: `
      <p>Cloudless.gr supports multiple programming languages and frameworks:</p>
      <ul>
        <li><strong>Python:</strong> TensorFlow, PyTorch, Scikit-learn, Keras</li>
        <li><strong>R:</strong> Full R environment with popular ML packages</li>
        <li><strong>JavaScript:</strong> TensorFlow.js, Node.js</li>
        <li><strong>Julia:</strong> MLJ.jl and other ML packages</li>
      </ul>
      <p>We're constantly adding support for more languages and frameworks based on user demand.</p>
    `,
    category: 'Getting Started',
    isPopular: true,
  },
  {
    id: 'projects-1',
    question: 'Can I collaborate with my team on projects?',
    answer: `
      <p>Yes! Team collaboration is a core feature of Cloudless.gr:</p>
      <ul>
        <li>Invite team members to your projects</li>
        <li>Set different permission levels (viewer, editor, admin)</li>
        <li>Share notebooks and experiments</li>
        <li>Comment and discuss directly in the platform</li>
        <li>Track changes and version history</li>
      </ul>
      <p>Team features are available on Pro and Enterprise plans.</p>
    `,
    category: 'Projects',
    isPopular: true,
    relatedLinks: [
      { title: 'Team Management Guide', url: '/documentation/team-management', internal: true },
      { title: 'Pricing Plans', url: '/pricing', internal: true },
    ],
  },
  {
    id: 'projects-2',
    question: 'How do I import data into my project?',
    answer: `
      <p>There are several ways to import data into your projects:</p>
      <ol>
        <li><strong>Upload Files:</strong> Drag and drop files directly into your project</li>
        <li><strong>Connect to Databases:</strong> PostgreSQL, MySQL, MongoDB, and more</li>
        <li><strong>API Connections:</strong> REST APIs and webhooks</li>
        <li><strong>Cloud Storage:</strong> AWS S3, Google Cloud Storage, Azure Blob</li>
        <li><strong>Git Repositories:</strong> Clone data from Git repos</li>
      </ol>
      <p>All data is encrypted and stored securely in our cloud infrastructure.</p>
    `,
    category: 'Projects',
    codeExample: `# Example: Upload data via Python SDK
from cloudless import Client

client = Client(api_key="your-api-key")
client.data.upload("./dataset.csv", project_id="proj_123")`,
  },
  {
    id: 'training-1',
    question: 'How long does model training take?',
    answer: `
      <p>Training time depends on several factors:</p>
      <ul>
        <li><strong>Dataset size:</strong> Larger datasets take longer to process</li>
        <li><strong>Model complexity:</strong> Deep neural networks require more time</li>
        <li><strong>Compute resources:</strong> GPU instances train faster than CPU</li>
        <li><strong>Framework optimization:</strong> Some frameworks are more efficient</li>
      </ul>
      <p>Typical training times:</p>
      <ul>
        <li>Simple models: 5-30 minutes</li>
        <li>Computer vision: 1-6 hours</li>
        <li>Large language models: 6-24+ hours</li>
      </ul>
    `,
    category: 'Training',
    isPopular: true,
  },
  {
    id: 'training-2',
    question: 'Can I use my own custom datasets?',
    answer: `
      <p>Absolutely! Cloudless.gr is designed to work with your custom datasets:</p>
      <ul>
        <li>Upload CSV, JSON, Parquet, and image files</li>
        <li>Connect to your existing databases</li>
        <li>Use our data preprocessing tools</li>
        <li>Validate data quality automatically</li>
        <li>Version your datasets for reproducibility</li>
      </ul>
      <p>We support datasets up to 100GB on Pro plans and unlimited on Enterprise.</p>
    `,
    category: 'Training',
  },
  {
    id: 'deployment-1',
    question: 'How do I deploy my trained model?',
    answer: `
      <p>Deploying models is simple with our one-click deployment:</p>
      <ol>
        <li>Select your trained model from the Models tab</li>
        <li>Click "Deploy" and choose your configuration</li>
        <li>Select compute resources (CPU/GPU, memory)</li>
        <li>Configure auto-scaling settings</li>
        <li>Deploy to staging or production</li>
      </ol>
      <p>Your model will be available as a REST API endpoint within minutes!</p>
    `,
    category: 'Deployment',
    isPopular: true,
    codeExample: `# Example: Deploy via API
curl -X POST https://api.cloudless.gr/v1/deployments \\
  -H "Authorization: Bearer your-token" \\
  -d '{
    "model_id": "model_123",
    "environment": "production",
    "instance_type": "gpu-small"
  }'`,
  },
  {
    id: 'billing-1',
    question: 'How does pricing work?',
    answer: `
      <p>Our pricing is based on actual compute usage:</p>
      <ul>
        <li><strong>Free Tier:</strong> 10 hours/month compute, 1GB storage</li>
        <li><strong>Pro:</strong> $29/month for 100 hours compute, 10GB storage</li>
        <li><strong>Enterprise:</strong> Custom pricing for unlimited usage</li>
      </ul>
      <p>Additional charges apply for:</p>
      <ul>
        <li>Extra compute hours: $0.50/hour CPU, $2.00/hour GPU</li>
        <li>Additional storage: $0.10/GB/month</li>
        <li>Data transfer: $0.05/GB</li>
      </ul>
    `,
    category: 'Billing',
    isPopular: true,
    relatedLinks: [
      { title: 'Pricing Details', url: '/pricing', internal: true },
      { title: 'Usage Dashboard', url: '/dashboard/usage', internal: true },
    ],
  },
  {
    id: 'technical-1',
    question: 'What happens if my training job fails?',
    answer: `
      <p>If a training job fails, here's what happens:</p>
      <ul>
        <li>You'll receive an immediate notification</li>
        <li>Logs are automatically saved for debugging</li>
        <li>Partial results and checkpoints are preserved</li>
        <li>You can restart from the last checkpoint</li>
        <li>No charges for failed compute time</li>
      </ul>
      <p>Common failure causes and solutions:</p>
      <ul>
        <li><strong>Out of memory:</strong> Reduce batch size or use larger instance</li>
        <li><strong>Data errors:</strong> Check data format and preprocessing</li>
        <li><strong>Code errors:</strong> Review logs and fix syntax/logic issues</li>
      </ul>
    `,
    category: 'Technical',
  },
];

const popularFAQs = computed(() => {
  return allFAQs.filter((faq) => faq.isPopular);
});

const getCategoryIcon = (category: string) => {
  const categoryMap = categories.find((cat) => cat.name === category);
  return categoryMap?.icon || 'mdi-help-circle';
};

const getFilteredFAQs = (category: string) => {
  return filteredFAQs.value.filter((faq) => faq.category === category);
};

const filterFAQs = () => {
  const query = searchQuery.value.toLowerCase();
  if (!query && activeCategories.value.length === 0) {
    filteredFAQs.value = allFAQs;
    return;
  }

  filteredFAQs.value = allFAQs.filter((faq) => {
    const matchesSearch =
      !query ||
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query) ||
      faq.category.toLowerCase().includes(query);

    const matchesCategory =
      activeCategories.value.length === 0 || activeCategories.value.includes(faq.category);

    return matchesSearch && matchesCategory;
  });
};

const removeCategory = (category: string) => {
  activeCategories.value = activeCategories.value.filter((c) => c !== category);
  filterFAQs();
};

const scrollToFAQ = (faqId: string) => {
  const element = document.getElementById(`faq-${faqId}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
    // Trigger expansion panel to open
    setTimeout(() => {
      const panel = element.querySelector('.v-expansion-panel-title');
      if (panel) {
        (panel as HTMLElement).click();
      }
    }, 500);
  }
};

const submitFeedback = (faqId: string, helpful: boolean) => {
  // In a real app, this would send feedback to the server
  console.log(`FAQ ${faqId} was ${helpful ? 'helpful' : 'not helpful'}`);

  // Show a toast or snackbar
  // useToast().success(helpful ? 'Thanks for your feedback!' : 'We\'ll work on improving this answer.');
};

// Initialize
onMounted(() => {
  filteredFAQs.value = allFAQs;
});
</script>

<style scoped>
.faq-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  color: white;
}

.page-header {
  margin-bottom: 32px;
}

.header-content {
  text-align: center;
  margin-top: 16px;
}

.search-card,
.popular-card,
.category-section .v-card,
.contact-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.search-field {
  margin-bottom: 16px;
}

.search-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.popular-item {
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.popular-item:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(var(--v-theme-primary), 0.2);
}

.category-section {
  margin-bottom: 32px;
}

.faq-title {
  display: flex;
  align-items: center;
  width: 100%;
}

.faq-content {
  padding-top: 16px;
}

.faq-code {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
  overflow-x: auto;
}

.links-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.contact-option {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.faq-panels {
  background: transparent;
}

.faq-feedback {
  margin-top: 16px;
}

@media (max-width: 768px) {
  .faq-page {
    padding: 16px;
  }

  .faq-title {
    flex-direction: column;
    align-items: flex-start;
  }

  .faq-title .v-chip {
    margin-top: 8px;
    margin-left: 0;
  }
}
</style>
