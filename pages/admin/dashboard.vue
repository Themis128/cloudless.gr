<template>
  <v-container class="py-6">
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h4 pa-6">
            <v-icon icon="mdi-view-dashboard" class="me-3"></v-icon>
            Admin Dashboard
          </v-card-title>
          
          <v-card-text>
            <v-row>
              <!-- Quick Stats -->
              <v-col cols="12" md="3">
                <v-card color="primary" variant="tonal">
                  <v-card-text class="text-center">
                    <v-icon icon="mdi-email" size="48" class="mb-2"></v-icon>
                    <div class="text-h5">{{ stats.contactSubmissions }}</div>
                    <div class="text-body-2">Contact Submissions</div>
                  </v-card-text>
                </v-card>
              </v-col>
              
              <v-col cols="12" md="3">
                <v-card color="success" variant="tonal">
                  <v-card-text class="text-center">
                    <v-icon icon="mdi-account-group" size="48" class="mb-2"></v-icon>
                    <div class="text-h5">{{ stats.totalUsers }}</div>
                    <div class="text-body-2">Total Users</div>
                  </v-card-text>
                </v-card>
              </v-col>
              
              <v-col cols="12" md="3">
                <v-card color="info" variant="tonal">
                  <v-card-text class="text-center">
                    <v-icon icon="mdi-folder-multiple" size="48" class="mb-2"></v-icon>
                    <div class="text-h5">{{ stats.projects }}</div>
                    <div class="text-body-2">Projects</div>
                  </v-card-text>
                </v-card>
              </v-col>
              
              <v-col cols="12" md="3">
                <v-card color="warning" variant="tonal">
                  <v-card-text class="text-center">
                    <v-icon icon="mdi-chart-line" size="48" class="mb-2"></v-icon>
                    <div class="text-h5">{{ stats.systemHealth }}</div>
                    <div class="text-body-2">System Health</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
            
            <!-- Quick Actions -->
            <v-row class="mt-6">
              <v-col cols="12">
                <v-card>
                  <v-card-title>Quick Actions</v-card-title>
                  <v-card-text>
                    <v-row>
                      <v-col cols="12" md="4">
                        <v-btn 
                          to="/admin/contact-submissions" 
                          color="primary" 
                          variant="outlined" 
                          block
                          size="large"
                        >
                          <v-icon icon="mdi-email" class="me-2"></v-icon>
                          View Contact Submissions
                        </v-btn>
                      </v-col>
                      
                      <v-col cols="12" md="4">
                        <v-btn 
                          to="/admin/users" 
                          color="success" 
                          variant="outlined" 
                          block
                          size="large"
                        >
                          <v-icon icon="mdi-account-group" class="me-2"></v-icon>
                          Manage Users
                        </v-btn>
                      </v-col>
                      
                      <v-col cols="12" md="4">
                        <v-btn 
                          to="/admin/settings" 
                          color="info" 
                          variant="outlined" 
                          block
                          size="large"
                        >
                          <v-icon icon="mdi-cog" class="me-2"></v-icon>
                          System Settings
                        </v-btn>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
            
            <!-- Recent Activity -->
            <v-row class="mt-6">
              <v-col cols="12" md="6">
                <v-card>
                  <v-card-title>Recent Contact Submissions</v-card-title>
                  <v-list>
                    <v-list-item 
                      v-for="submission in recentSubmissions" 
                      :key="submission.id"
                      :to="`/admin/contact-submissions?highlight=${submission.id}`"
                    >
                      <v-list-item-title>{{ submission.subject }}</v-list-item-title>
                      <v-list-item-subtitle>
                        From: {{ submission.email }} • {{ formatDate(submission.createdAt) }}
                      </v-list-item-subtitle>                      <template #append>
                        <v-chip 
                          :color="getStatusColor(submission.status)" 
                          size="small"
                        >
                          {{ submission.status }}
                        </v-chip>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-card>
              </v-col>
              
              <v-col cols="12" md="6">
                <v-card>
                  <v-card-title>System Status</v-card-title>
                  <v-card-text>
                    <v-list>
                      <v-list-item>
                        <v-list-item-title>Database Connection</v-list-item-title>                        <template #append>
                          <v-chip color="success" size="small">
                            <v-icon icon="mdi-check-circle" class="me-1"></v-icon>
                            Healthy
                          </v-chip>
                        </template>
                      </v-list-item>
                      
                      <v-list-item>
                        <v-list-item-title>API Response Time</v-list-item-title>
                        <template #append>
                          <v-chip color="success" size="small">
                            {{ systemStatus.apiResponseTime }}ms
                          </v-chip>
                        </template>
                      </v-list-item>
                      
                      <v-list-item>
                        <v-list-item-title>Server Uptime</v-list-item-title>                        <template #append>
                          <v-chip color="info" size="small">
                            {{ systemStatus.uptime }}
                          </v-chip>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// Admin authentication and permissions
const { isAdmin, checkSession } = useAuth()

// Page metadata for admin route protection
definePageMeta({
  layout: 'admin',
  middleware: '04-admin-required'
})

const { $fetch } = useNuxtApp()

// Reactive data
const stats = ref({
  contactSubmissions: 42,
  totalUsers: 1337,
  projects: 89,
  systemHealth: '98%'
});

const recentSubmissions = ref([]);

const systemStatus = ref({
  apiResponseTime: 45,
  uptime: '7 days, 14 hours'
});

// Methods
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'new': return 'primary';
    case 'read': return 'info';
    case 'replied': return 'success';
    case 'archived': return 'grey';
    default: return 'primary';
  }
};

// Load dashboard data
const loadDashboardData = async () => {
  try {    // Load contact submissions count
    const contactResponse = await ($fetch as any)('/api/contact-submissions?limit=5');
    if (contactResponse) {
      stats.value.contactSubmissions = contactResponse.total || 0;
      recentSubmissions.value = contactResponse.submissions || [];
    }
    
    // Mock data for other stats (replace with real API calls)
    stats.value.totalUsers = 42;
    stats.value.projects = 15;
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    // Use fallback data
    stats.value = {
      contactSubmissions: 12,
      totalUsers: 42,
      projects: 15,
      systemHealth: '98%'
    };
    
    recentSubmissions.value = [
      {
        id: 1,
        subject: 'Project Inquiry',
        email: 'john@example.com',
        status: 'new',
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        subject: 'Technical Support',
        email: 'jane@example.com',
        status: 'read',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
  }
};

// Load data on mount
onMounted(async () => {
  // Ensure admin access before loading data
  await checkSession()
  if (!isAdmin.value) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required'
    })
  }
  
  await loadDashboardData()
})
</script>
