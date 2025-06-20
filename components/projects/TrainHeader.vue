<template>
  <div class="train-header">
    <div class="breadcrumb-nav mb-4">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="mb-2"
        @click="navigateTo(`/projects/${projectId}`)"
      >
        Back to Project
      </v-btn>
    </div>

    <div class="header-content">
      <div class="project-info d-flex align-center">
        <v-avatar :color="getProjectColor(project?.type)" size="48" class="me-4">
          <v-icon :icon="getProjectIcon(project?.type)" color="white" />
        </v-avatar>
        <div>
          <h1 class="text-h4 mb-1">{{ project?.name || 'Training' }}</h1>
          <p class="text-body-1 opacity-90">Train and optimize your machine learning models</p>
        </div>
      </div>

      <div class="header-actions d-flex align-center gap-3">
        <v-btn
          v-if="currentSession && currentSession.status === 'running'"
          color="error"
          variant="outlined"
          prepend-icon="mdi-stop"
          :loading="stopping"
          @click="$emit('stop-training', currentSession)"
        >
          Stop Training
        </v-btn>

        <v-btn
          color="primary"
          prepend-icon="mdi-play"
          :disabled="isTraining"
          :loading="starting"
          @click="$emit('start-training')"
        >
          Start Training
        </v-btn>
      </div>
    </div>

    <!-- Training Statistics -->
    <div class="training-stats mt-6">
      <v-row>
        <v-col cols="6" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ stats.activeSessions }}</div>
            <div class="stat-label">Active Sessions</div>
            <v-icon icon="mdi-brain" color="primary" size="20" />
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ stats.bestAccuracy }}%</div>
            <div class="stat-label">Best Accuracy</div>
            <v-icon icon="mdi-chart-line" color="success" size="20" />
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ stats.avgTime }}h</div>
            <div class="stat-label">Avg Training Time</div>
            <v-icon icon="mdi-clock" color="warning" size="20" />
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalSessions }}</div>
            <div class="stat-label">Total Sessions</div>
            <v-icon icon="mdi-check-circle" color="info" size="20" />
          </div>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup lang="ts">

import type { Project } from '@/types/project';

// Use the simplified UI type for training session
import type { TrainingConfig, TrainingMetrics } from '@/types/project';
interface TrainingSessionUI {
  id: string;
  project_id: string;
  name: string;
  status: string;
  config: TrainingConfig;
  progress?: number;
  metrics?: TrainingMetrics;
  logs?: string | null;
  started_at?: string;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  isActive?: boolean;
  currentEpoch?: number;
  totalEpochs?: number;
}

interface TrainingStats {
  activeSessions: number;
  bestAccuracy: number;
  avgTime: number;
  totalSessions: number;
}


defineProps<{
  project?: Project | null;
  projectId: string;
  currentSession?: TrainingSessionUI | null;
  stats: TrainingStats;
  isTraining?: boolean;
  starting?: boolean;
  stopping?: boolean;
}>();

defineEmits<{
  startTraining: [];
  stopTraining: [session: TrainingSessionUI];
}>();

// Composables
const { getProjectIcon, getProjectColor } = useIcons();
</script>

<style scoped>
.train-header {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-info)) 100%
  );
  color: white;
  padding: 2rem 0;
  position: relative;
  overflow: hidden;
}

.train-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" fill="white" opacity="0.08"><path d="M0,60 Q250,10 500,60 T1000,60 L1000,100 L0,100 Z"/></svg>')
    repeat-x;
  background-size: 1000px 100px;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.train-header .v-btn {
  color: rgba(255, 255, 255, 0.9);
  border-radius: 24px;
  transition: all 0.3s ease;
}

.train-header .v-btn:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.training-stats {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  position: relative;
  z-index: 1;
}

.stat-item {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
  position: relative;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  opacity: 0.9;
  margin-bottom: 0.5rem;
}

.stat-item .v-icon {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  opacity: 0.7;
}

.header-actions {
  gap: 12px;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .training-stats {
    margin-top: 1rem;
  }
}
</style>
