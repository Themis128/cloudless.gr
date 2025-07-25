<template>
  <div>
    <LayoutPageStructure
      title="Projects Documentation"
      subtitle="Learn how to manage and organize your projects"
      back-button-to="/documentation"
      :has-sidebar="false"
      :white-header="true"
    >
      <template #main>
        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h5">
            <v-icon start color="primary">mdi-folder-multiple</v-icon>
            Projects Overview
          </v-card-title>
          <v-card-text>
            <p class="text-body-1 mb-4">
              Projects are the foundation of your development workflow. They help you organize your work,
              track progress, and collaborate with team members effectively.
            </p>
            
            <v-alert type="info" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              <strong>Tip:</strong> Use projects to group related work, track milestones, and maintain
              a clear overview of your development activities.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-plus-circle</v-icon>
            Creating Projects
          </v-card-title>
          <v-card-text>
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Step 1: Navigate to Projects</h4>
              <p class="text-body-2">Go to the Projects section in your dashboard.</p>
            </div>
            
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Step 2: Create New Project</h4>
              <p class="text-body-2">Click the "Create Project" button and fill in the required information:</p>
              <ul class="text-body-2 mt-2">
                <li><strong>Project Name:</strong> A descriptive name for your project</li>
                <li><strong>Description:</strong> Brief overview of what the project entails</li>
                <li><strong>Category:</strong> Select the appropriate category</li>
                <li><strong>Status:</strong> Set initial project status</li>
              </ul>
            </div>
            
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Step 3: Configure Settings</h4>
              <p class="text-body-2">Set up project-specific configurations and assign team members.</p>
            </div>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-cog</v-icon>
            Managing Projects
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Project Dashboard</h4>
                <p class="text-body-2 mb-3">
                  Each project has its own dashboard showing:
                </p>
                <ul class="text-body-2">
                  <li>Project overview and status</li>
                  <li>Recent activity and updates</li>
                  <li>Team member assignments</li>
                  <li>Progress tracking</li>
                </ul>
              </v-col>
              
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Project Settings</h4>
                <p class="text-body-2 mb-3">
                  Configure project-specific settings:
                </p>
                <ul class="text-body-2">
                  <li>Update project information</li>
                  <li>Manage team permissions</li>
                  <li>Set up integrations</li>
                  <li>Configure notifications</li>
                </ul>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-chart-line</v-icon>
            Project Analytics
          </v-card-title>
          <v-card-text>
            <p class="text-body-1 mb-4">
              Track your project's performance and progress with built-in analytics:
            </p>
            
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="primary" class="mb-2">mdi-calendar-clock</v-icon>
                  <h5 class="text-h6">Timeline</h5>
                  <p class="text-body-2">Track project milestones and deadlines</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="success" class="mb-2">mdi-check-circle</v-icon>
                  <h5 class="text-h6">Progress</h5>
                  <p class="text-body-2">Monitor completion rates and goals</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="info" class="mb-2">mdi-account-group</v-icon>
                  <h5 class="text-h6">Team</h5>
                  <p class="text-body-2">Track team productivity and contributions</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="warning" class="mb-2">mdi-alert</v-icon>
                  <h5 class="text-h6">Issues</h5>
                  <p class="text-body-2">Monitor and resolve project issues</p>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-help-circle</v-icon>
            Best Practices
          </v-card-title>
          <v-card-text>
            <v-alert type="success" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-lightbulb</v-icon>
              </template>
              <strong>Organize Effectively:</strong> Use clear naming conventions and categorize projects appropriately.
            </v-alert>
            
            <v-alert type="info" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-account-multiple</v-icon>
              </template>
              <strong>Team Collaboration:</strong> Assign appropriate roles and permissions to team members.
            </v-alert>
            
            <v-alert type="warning" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-calendar</v-icon>
              </template>
              <strong>Regular Updates:</strong> Keep project information current and update status regularly.
            </v-alert>
            
            <v-alert type="error" variant="tonal">
              <template #prepend>
                <v-icon>mdi-shield-check</v-icon>
              </template>
              <strong>Security:</strong> Ensure proper access controls and data protection measures.
            </v-alert>
          </v-card-text>
        </v-card>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
// SEO Meta Tags
useHead({
  title: 'Projects Documentation - Cloudless',
  meta: [
    { name: 'description', content: 'Learn how to manage and organize your projects effectively with our comprehensive documentation.' },
    { property: 'og:title', content: 'Projects Documentation - Cloudless' },
    { property: 'og:description', content: 'Project management documentation and best practices' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Projects Documentation - Cloudless' },
    { name: 'twitter:description', content: 'Project management documentation and best practices' }
  ]
})

// Page Meta
definePageMeta({
  title: 'Projects Documentation',
  description: 'Learn how to manage and organize your projects'
})
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.v-card-title {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  padding-bottom: 1rem;
}

.v-alert {
  border-radius: 8px;
}
</style> 