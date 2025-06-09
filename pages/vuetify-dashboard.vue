<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <v-card class="mb-6">
            <v-card-title class="text-h4 d-flex align-center">
              <v-icon icon="mdi-view-dashboard" size="large" class="me-2" color="primary"></v-icon>
              User Dashboard
              <v-spacer></v-spacer>
              <v-btn color="primary" prepend-icon="mdi-refresh" @click="refreshData">Refresh</v-btn>
            </v-card-title>
          </v-card>
        </v-col>
      </v-row>

      <!-- Dashboard Statistics -->
      <v-row>
        <v-col cols="12" md="3">
          <v-card class="mb-4 dashboard-stat" color="primary" theme="dark">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon icon="mdi-account-multiple" size="x-large" class="me-4"></v-icon>
                <div>
                  <div class="text-h4">{{ stats.users }}</div>
                  <div>Total Users</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3">
          <v-card class="mb-4 dashboard-stat" color="secondary" theme="dark">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon icon="mdi-file-document-multiple" size="x-large" class="me-4"></v-icon>
                <div>
                  <div class="text-h4">{{ stats.projects }}</div>
                  <div>Projects</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3">
          <v-card class="mb-4 dashboard-stat" color="accent" theme="dark">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon icon="mdi-message-text" size="x-large" class="me-4"></v-icon>
                <div>
                  <div class="text-h4">{{ stats.messages }}</div>
                  <div>Messages</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3">
          <v-card class="mb-4 dashboard-stat" color="info" theme="dark">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon icon="mdi-check-circle" size="x-large" class="me-4"></v-icon>
                <div>
                  <div class="text-h4">{{ stats.completed }}</div>
                  <div>Completed</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Tabs for different sections -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-tabs v-model="activeTab" bg-color="primary" align-tabs="start">
              <v-tab value="projects">Projects</v-tab>
              <v-tab value="tasks">Tasks</v-tab>
              <v-tab value="messages">Messages</v-tab>
              <v-tab value="analytics">Analytics</v-tab>
            </v-tabs>

            <v-card-text>
              <v-window v-model="activeTab">
                <v-window-item value="projects">
                  <v-data-table
                    :headers="projectHeaders"
                    :items="projects"
                    :items-per-page="5"
                    class="elevation-1"
                  >
                    <template v-slot:item.status="{ item }">
                      <v-chip :color="getStatusColor(item.raw.status)" size="small">
                        {{ item.raw.status }}
                      </v-chip>
                    </template>
                    <template v-slot:item.actions="{ item }">
                      <v-icon size="small" class="me-2" @click="editItem(item.raw)" color="blue">
                        mdi-pencil
                      </v-icon>
                      <v-icon size="small" @click="deleteItem(item.raw)" color="red">
                        mdi-delete
                      </v-icon>
                    </template>
                  </v-data-table>
                </v-window-item>

                <v-window-item value="tasks">
                  <v-list lines="two">
                    <v-list-subheader>Today's Tasks</v-list-subheader>
                    <v-list-item
                      v-for="(task, i) in tasks"
                      :key="i"
                      :value="task"
                      :title="task.title"
                      :subtitle="task.description"
                    >
                      <template v-slot:prepend>
                        <v-checkbox-btn v-model="task.completed" color="primary"></v-checkbox-btn>
                      </template>

                      <template v-slot:append>
                        <v-chip :color="getPriorityColor(task.priority)" size="small">
                          {{ task.priority }}
                        </v-chip>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-window-item>

                <v-window-item value="messages">
                  <p>Your messages will appear here</p>
                </v-window-item>

                <v-window-item value="analytics">
                  <p>Analytics data will appear here</p>
                </v-window-item>
              </v-window>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- User Settings Card -->
      <v-row class="mt-6">
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-cog" class="me-2" color="primary"></v-icon>
              Dashboard Settings
            </v-card-title>

            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-switch
                    v-model="settings.notifications"
                    color="primary"
                    label="Enable notifications"
                  ></v-switch>

                  <v-switch
                    v-model="settings.darkMode"
                    color="primary"
                    label="Dark mode"
                    @change="toggleTheme"
                  ></v-switch>
                </v-col>

                <v-col cols="12" md="6">
                  <v-select
                    v-model="settings.refreshRate"
                    :items="refreshOptions"
                    label="Dashboard refresh rate"
                  ></v-select>
                </v-col>
              </v-row>

              <v-divider class="my-4"></v-divider>

              <v-row>
                <v-col cols="12" class="text-end">
                  <v-btn color="primary" @click="saveSettings">Save Settings</v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Notifications -->
    <v-snackbar
      v-model="notification.show"
      :color="notification.color"
      :timeout="notification.timeout"
    >
      {{ notification.text }}

      <template v-slot:actions>
        <v-btn variant="text" @click="notification.show = false"> Close </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useTheme } from 'vuetify';

definePageMeta({
  layout: 'vuetify',
  title: 'Dashboard',
  description: 'User Dashboard powered by Vuetify',
});

// Theme handling
const theme = useTheme();
const settings = ref({
  notifications: true,
  darkMode: theme.global.name.value === 'dark',
  refreshRate: '5 minutes',
});

// Dashboard tabs
const activeTab = ref('projects');

// Dashboard statistics
const stats = ref({
  users: 256,
  projects: 48,
  messages: 124,
  completed: 38,
});

// Projects data for data table
const projectHeaders = [
  { title: 'Project', key: 'name' },
  { title: 'Client', key: 'client' },
  { title: 'Deadline', key: 'deadline' },
  { title: 'Status', key: 'status' },
  { title: 'Progress', key: 'progress' },
  { title: 'Actions', key: 'actions', sortable: false },
];

const projects = ref([
  {
    id: 1,
    name: 'Website Redesign',
    client: 'XYZ Corp',
    deadline: '2025-06-15',
    status: 'In Progress',
    progress: 65,
  },
  {
    id: 2,
    name: 'Mobile App',
    client: 'ABC Inc',
    deadline: '2025-07-20',
    status: 'Pending',
    progress: 20,
  },
  {
    id: 3,
    name: 'Cloud Migration',
    client: 'Tech Solutions',
    deadline: '2025-05-30',
    status: 'Completed',
    progress: 100,
  },
  {
    id: 4,
    name: 'E-commerce Platform',
    client: 'Retail Pro',
    deadline: '2025-08-10',
    status: 'In Progress',
    progress: 45,
  },
  {
    id: 5,
    name: 'SEO Optimization',
    client: 'Marketing Inc',
    deadline: '2025-05-28',
    status: 'Pending',
    progress: 10,
  },
]);

// Tasks data
const tasks = ref([
  {
    title: 'Review pull requests',
    description: 'Check and approve code changes',
    completed: false,
    priority: 'High',
  },
  {
    title: 'Client meeting',
    description: 'Discuss project requirements and timeline',
    completed: true,
    priority: 'Medium',
  },
  {
    title: 'Update documentation',
    description: 'Add API documentation for new endpoints',
    completed: false,
    priority: 'Low',
  },
  {
    title: 'Fix responsive design issues',
    description: 'Address layout problems on mobile',
    completed: false,
    priority: 'High',
  },
]);

// Settings options
const refreshOptions = ['1 minute', '5 minutes', '15 minutes', '30 minutes', '1 hour'];

// Notification setup
const notification = ref({
  show: false,
  text: '',
  color: 'success',
  timeout: 3000,
});

// Get color for status chip
const getStatusColor = (status) => {
  switch (status) {
    case 'Completed':
      return 'success';
    case 'In Progress':
      return 'primary';
    case 'Pending':
      return 'warning';
    default:
      return 'grey';
  }
};

// Get color for priority chip
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'High':
      return 'error';
    case 'Medium':
      return 'warning';
    case 'Low':
      return 'success';
    default:
      return 'grey';
  }
};

// Toggle dark/light theme
const toggleTheme = () => {
  theme.global.name.value = settings.value.darkMode ? 'dark' : 'light';
};

// Save settings
const saveSettings = () => {
  notification.value = {
    show: true,
    text: 'Settings saved successfully!',
    color: 'success',
    timeout: 3000,
  };
};

// Refresh dashboard data
const refreshData = () => {
  // In a real app, you would fetch data from an API here
  notification.value = {
    show: true,
    text: 'Dashboard data refreshed!',
    color: 'info',
    timeout: 3000,
  };
};

// Edit item
const editItem = (item) => {
  notification.value = {
    show: true,
    text: `Editing project: ${item.name}`,
    color: 'info',
    timeout: 3000,
  };
};

// Delete item
const deleteItem = (item) => {
  notification.value = {
    show: true,
    text: `Project ${item.name} would be deleted`,
    color: 'error',
    timeout: 3000,
  };
};
</script>

<style scoped>
.dashboard-stat {
  transition: all 0.3s ease;
}

.dashboard-stat:hover {
  transform: translateY(-5px);
}
</style>
