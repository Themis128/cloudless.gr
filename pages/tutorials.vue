<template>
  <div>
    <v-container class="tutorials-page">
      <!-- Hero Section -->
      <v-row justify="center" class="mb-8">
        <v-col cols="12" md="8" lg="6">
          <div class="text-center">
            <h1 class="text-h2 font-weight-bold mb-4">Tutorials</h1>
            <p class="text-body-1 text-medium-emphasis">
              Learn how to build amazing AI applications with Cloudless.gr
            </p>
          </div>
        </v-col>
      </v-row>

      <!-- Getting Started Section -->
      <v-row>
        <v-col cols="12">
          <section class="mb-8">
            <h2 class="text-h4 mb-6 d-flex align-center">
              <v-icon color="primary" class="mr-2">mdi-rocket-launch</v-icon>
              Getting Started
            </h2>

            <v-row>
              <v-col
                v-for="tutorial in gettingStartedTutorials"
                :key="tutorial.id"
                cols="12"
                md="6"
                lg="3"
              >
                <TutorialCard
                  :tutorial="tutorial"
                  @click="handleTutorialClick(tutorial)"
                />
              </v-col>
            </v-row>
          </section>

          <!-- Bot Development Section -->
          <section class="mb-8">
            <h2 class="text-h4 mb-6 d-flex align-center">
              <v-icon color="primary" class="mr-2">mdi-robot</v-icon>
              Bot Development
            </h2>

            <v-row>
              <v-col
                v-for="tutorial in botDevelopmentTutorials"
                :key="tutorial.id"
                cols="12"
                md="6"
                lg="4"
              >
                <TutorialCard
                  :tutorial="tutorial"
                  @click="handleTutorialClick(tutorial)"
                />
              </v-col>
            </v-row>
          </section>

          <!-- Learning Paths Section -->
          <section class="mb-8">
            <h2 class="text-h4 mb-6 d-flex align-center">
              <v-icon color="primary" class="mr-2"
                >mdi-book-open-variant</v-icon
              >
              Learning Paths
            </h2>

            <v-row>
              <v-col
                v-for="path in learningPaths"
                :key="path.id"
                cols="12"
                lg="6"
              >
                <LearningPathCard :path="path" @click="handlePathClick(path)" />
              </v-col>
            </v-row>
          </section>

          <!-- Video Tutorials Section -->
          <section class="mb-8">
            <h2 class="text-h4 mb-6 d-flex align-center">
              <v-icon color="primary" class="mr-2">mdi-play-circle</v-icon>
              Video Tutorials
            </h2>

            <v-row>
              <v-col
                v-for="video in videoTutorials"
                :key="video.id"
                cols="12"
                md="6"
                lg="4"
              >
                <VideoCard :video="video" @click="handleVideoClick(video)" />
              </v-col>
            </v-row>
          </section>
        </v-col>
      </v-row>
    </v-container>

    <!-- Loading Dialog -->
    <v-dialog v-model="loadingDialog" persistent max-width="300">
      <v-card>
        <v-card-text class="text-center pa-4">
          <v-progress-circular indeterminate color="primary" size="48" />
          <p class="mt-4 text-body-1">Loading tutorial...</p>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useNotificationsStore } from '@/stores/useNotificationsStore'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LearningPathCard from '~/components/ui/LearningPathCard.vue'
import TutorialCard from '~/components/ui/TutorialCard.vue'
import VideoCard from '~/components/ui/VideoCard.vue'

// Types
interface Tutorial {
  id: string
  title: string
  description: string
  icon: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  duration: string
  views: string
  category: string
}

interface LearningPath {
  id: string
  title: string
  description: string
  icon: string
  steps: string[]
}

interface Video {
  id: string
  title: string
  description: string
  duration: string
  views: string
}

// Composables
const router = useRouter()
const notificationsStore = useNotificationsStore()

// Reactive state
const loadingDialog = ref(false)

// Data
const gettingStartedTutorials: Tutorial[] = [
  {
    id: 'first-bot',
    title: 'Your First Bot',
    description: 'Create your first AI chatbot in under 10 minutes',
    icon: 'mdi-rocket-launch',
    difficulty: 'Beginner',
    duration: '10 min',
    views: '2.5k views',
    category: 'getting-started',
  },
  {
    id: 'model-training-basics',
    title: 'Model Training Basics',
    description: 'Learn how to train your first custom AI model',
    icon: 'mdi-brain',
    difficulty: 'Beginner',
    duration: '15 min',
    views: '1.8k views',
    category: 'getting-started',
  },
  {
    id: 'first-pipeline',
    title: 'Building Your First Pipeline',
    description: 'Create a data processing pipeline from scratch',
    icon: 'mdi-timeline',
    difficulty: 'Beginner',
    duration: '20 min',
    views: '1.2k views',
    category: 'getting-started',
  },
  {
    id: 'api-integration',
    title: 'API Integration',
    description: 'Connect your applications to Cloudless.gr APIs',
    icon: 'mdi-api',
    difficulty: 'Beginner',
    duration: '12 min',
    views: '3.1k views',
    category: 'getting-started',
  },
]

const botDevelopmentTutorials: Tutorial[] = [
  {
    id: 'advanced-bot-config',
    title: 'Advanced Bot Configuration',
    description: 'Configure complex bot behaviors and responses',
    icon: 'mdi-robot',
    difficulty: 'Intermediate',
    duration: '45 min',
    views: '950 views',
    category: 'bot-development',
  },
  {
    id: 'webhook-integration',
    title: 'Webhook Integration',
    description: 'Connect your bot to external services via webhooks',
    icon: 'mdi-webhook',
    difficulty: 'Intermediate',
    duration: '60 min',
    views: '720 views',
    category: 'bot-development',
  },
  {
    id: 'multi-language-bot',
    title: 'Multi-language Bot',
    description: 'Build a bot that can handle multiple languages',
    icon: 'mdi-translate',
    difficulty: 'Intermediate',
    duration: '75 min',
    views: '680 views',
    category: 'bot-development',
  },
  {
    id: 'document-processing',
    title: 'Document Processing Pipeline',
    description: 'Create a pipeline for processing and analyzing documents',
    icon: 'mdi-file-document',
    difficulty: 'Advanced',
    duration: '150 min',
    views: '280 views',
    category: 'bot-development',
  },
]

const learningPaths: LearningPath[] = [
  {
    id: 'bot-developer',
    title: 'Bot Developer Path',
    description:
      'Master the art of building intelligent chatbots and conversational AI',
    icon: 'mdi-robot',
    steps: [
      'Your First Bot',
      'Advanced Bot Configuration',
      'Webhook Integration',
      'Conversation Design',
      'Customer Support Bot Project',
    ],
  },
  {
    id: 'ai-model-developer',
    title: 'AI Model Developer Path',
    description: 'Learn to train, fine-tune, and deploy custom AI models',
    icon: 'mdi-brain',
    steps: [
      'Model Training Basics',
      'Data Preparation',
      'Fine-tuning Techniques',
      'Model Deployment',
      'Production Optimization',
    ],
  },
  {
    id: 'pipeline-engineer',
    title: 'Pipeline Engineer Path',
    description: 'Build scalable data processing and ML pipelines',
    icon: 'mdi-timeline',
    steps: [
      'Pipeline Basics',
      'Data Transformation',
      'ML Pipeline Integration',
      'Monitoring & Alerting',
      'Production Deployment',
    ],
  },
]

const videoTutorials: Video[] = [
  {
    id: 'getting-started-video',
    title: 'Getting Started with Cloudless.gr',
    description:
      'A comprehensive overview of the platform and its capabilities',
    duration: '15:30',
    views: '2.1k views',
  },
  {
    id: 'first-ai-bot-video',
    title: 'Building Your First AI Bot',
    description: 'Step-by-step guide to creating an intelligent chatbot',
    duration: '22:15',
    views: '1.8k views',
  },
  {
    id: 'advanced-model-training-video',
    title: 'Advanced Model Training',
    description: 'Deep dive into custom model training and optimization',
    duration: '45:20',
    views: '950 views',
  },
  {
    id: 'pipeline-orchestration-video',
    title: 'Pipeline Orchestration',
    description: 'Learn to build and manage complex data pipelines',
    duration: '38:45',
    views: '720 views',
  },
]

// Methods
const handleTutorialClick = async (tutorial: Tutorial) => {
  try {
    loadingDialog.value = true
    // Simulate loading time
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Navigate to tutorial page
    await router.push(`/tutorials/${tutorial.id}`)
    notificationsStore.success(
      'Tutorial Started',
      `Starting tutorial: ${tutorial.title}`
    )
  } catch (error) {
    notificationsStore.error('Error', 'Failed to load tutorial')
  } finally {
    loadingDialog.value = false
  }
}

const handlePathClick = async (path: LearningPath) => {
  try {
    loadingDialog.value = true
    await new Promise(resolve => setTimeout(resolve, 1000))

    await router.push(`/learning-paths/${path.id}`)
    notificationsStore.success(
      'Learning Path Started',
      `Starting learning path: ${path.title}`
    )
  } catch (error) {
    notificationsStore.error('Error', 'Failed to load learning path')
  } finally {
    loadingDialog.value = false
  }
}

const handleVideoClick = async (video: Video) => {
  try {
    loadingDialog.value = true
    await new Promise(resolve => setTimeout(resolve, 1000))

    await router.push(`/videos/${video.id}`)
    notificationsStore.success('Video Started', `Playing video: ${video.title}`)
  } catch (error) {
    notificationsStore.error('Error', 'Failed to load video')
  } finally {
    loadingDialog.value = false
  }
}

// Meta
definePageMeta({
  title: 'Tutorials',
  description:
    'Learn how to build amazing AI applications with Cloudless.gr tutorials and learning paths',
  layout: 'default',
})
</script>

<style scoped>
.tutorials-page {
  max-width: 1200px;
  margin: 0 auto;
}

/* Accessibility improvements */
h1,
h2 {
  scroll-margin-top: 80px;
}

/* Focus styles for better accessibility */
:deep(.v-card) {
  outline: none;
}

:deep(.v-card:focus-visible) {
  outline: 2px solid var(--v-primary-base);
  outline-offset: 2px;
}

/* Smooth transitions */
:deep(.v-card) {
  transition:
    transform 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out;
}

:deep(.v-card:hover) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

/* Responsive improvements */
@media (max-width: 600px) {
  .tutorials-page {
    padding: 0 16px;
  }
}
</style>
