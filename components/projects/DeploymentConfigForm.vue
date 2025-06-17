<template>
  <v-card class="ma-4">
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2">mdi-rocket-launch</v-icon>
      Deployment Configuration
    </v-card-title>
    
    <v-card-text>
      <v-form ref="form" v-model="valid" @submit.prevent="handleSubmit">
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="config.deployment_name"
              label="Deployment Name"
              :rules="[rules.required]"
              required
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-select
              v-model="config.environment"
              :items="environments"
              label="Environment"
              :rules="[rules.required]"
              required
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="config.instance_type"
              :items="instanceTypes"
              label="Instance Type"
              :rules="[rules.required]"
              required
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.min_instances"
              label="Minimum Instances"
              type="number"
              :rules="[rules.required, rules.positive]"
              required
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.max_instances"
              label="Maximum Instances"
              type="number"
              :rules="[rules.required, rules.positive, rules.maxGreaterThanMin]"
              required
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.cpu_limit"
              label="CPU Limit (cores)"
              type="number"
              step="0.1"
              :rules="[rules.required, rules.positive]"
              required
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.memory_limit"
              label="Memory Limit (GB)"
              type="number"
              step="0.5"
              :rules="[rules.required, rules.positive]"
              required
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.disk_size"
              label="Disk Size (GB)"
              type="number"
              :rules="[rules.required, rules.positive]"
              required
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-textarea
              v-model="config.environment_variables"
              label="Environment Variables"
              rows="3"
              placeholder="KEY1=value1&#10;KEY2=value2"
              hint="One variable per line in KEY=value format"
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12" md="6">
            <v-switch
              v-model="config.auto_scaling"
              label="Enable Auto Scaling"
              color="primary"
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-switch
              v-model="config.health_check"
              label="Enable Health Check"
              color="primary"
            />
          </v-col>
        </v-row>
        
        <v-row v-if="config.health_check">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="config.health_check_path"
              label="Health Check Path"
              placeholder="/health"
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.health_check_interval"
              label="Check Interval (seconds)"
              type="number"
              placeholder="30"
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-textarea
              v-model="config.notes"
              label="Deployment Notes"
              rows="3"
              placeholder="Optional notes about this deployment configuration..."
            />
          </v-col>
        </v-row>
        
        <!-- Advanced Configuration -->
        <v-expansion-panels class="mt-4">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-cog</v-icon>
              Advanced Configuration
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="config.custom_domain"
                    label="Custom Domain"
                    placeholder="api.example.com"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-switch
                    v-model="config.ssl_enabled"
                    label="SSL Enabled"
                    color="primary"
                  />
                </v-col>
              </v-row>
              
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="config.timeout"
                    label="Request Timeout (seconds)"
                    type="number"
                    placeholder="30"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="config.max_requests_per_minute"
                    label="Rate Limit (requests/minute)"
                    type="number"
                    placeholder="1000"
                  />
                </v-col>
              </v-row>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-form>
    </v-card-text>
    
    <v-card-actions>
      <v-spacer />
      <v-btn 
        variant="outlined" 
        @click="resetForm"
      >
        Reset
      </v-btn>
      <v-btn 
        color="primary" 
        :disabled="!valid || loading"
        :loading="loading"
        @click="handleSubmit"
      >
        Deploy Model
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

interface DeploymentConfig {
  deployment_name: string
  environment: string
  instance_type: string
  min_instances: number
  max_instances: number
  cpu_limit: number
  memory_limit: number
  disk_size: number
  environment_variables: string
  auto_scaling: boolean
  health_check: boolean
  health_check_path?: string
  health_check_interval?: number
  notes: string
  custom_domain?: string
  ssl_enabled: boolean
  timeout?: number
  max_requests_per_minute?: number
}

const props = defineProps<{
  projectId: string
  modelId?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [config: DeploymentConfig]
}>()

const form = ref()
const valid = ref(false)

const config = reactive<DeploymentConfig>({
  deployment_name: '',
  environment: 'production',
  instance_type: 't3.medium',
  min_instances: 1,
  max_instances: 3,
  cpu_limit: 1,
  memory_limit: 2,
  disk_size: 20,
  environment_variables: '',
  auto_scaling: true,
  health_check: true,
  health_check_path: '/health',
  health_check_interval: 30,
  notes: '',
  ssl_enabled: true,
  timeout: 30,
  max_requests_per_minute: 1000
})

const environments = [
  { title: 'Development', value: 'development' },
  { title: 'Staging', value: 'staging' },
  { title: 'Production', value: 'production' }
]

const instanceTypes = [
  { title: 't3.micro (1 vCPU, 1GB RAM)', value: 't3.micro' },
  { title: 't3.small (1 vCPU, 2GB RAM)', value: 't3.small' },
  { title: 't3.medium (2 vCPU, 4GB RAM)', value: 't3.medium' },
  { title: 't3.large (2 vCPU, 8GB RAM)', value: 't3.large' },
  { title: 't3.xlarge (4 vCPU, 16GB RAM)', value: 't3.xlarge' },
  { title: 'c5.large (2 vCPU, 4GB RAM) - Compute Optimized', value: 'c5.large' },
  { title: 'c5.xlarge (4 vCPU, 8GB RAM) - Compute Optimized', value: 'c5.xlarge' },
  { title: 'r5.large (2 vCPU, 16GB RAM) - Memory Optimized', value: 'r5.large' },
  { title: 'r5.xlarge (4 vCPU, 32GB RAM) - Memory Optimized', value: 'r5.xlarge' }
]

const rules = {
  required: (value: any) => !!value || 'This field is required',
  positive: (value: number) => value > 0 || 'Must be greater than 0',
  maxGreaterThanMin: (value: number) => {
    return value >= config.min_instances || 'Maximum must be greater than or equal to minimum'
  }
}

function handleSubmit() {
  if (valid.value) {
    emit('submit', { ...config })
  }
}

function resetForm() {
  Object.assign(config, {
    deployment_name: '',
    environment: 'production',
    instance_type: 't3.medium',
    min_instances: 1,
    max_instances: 3,
    cpu_limit: 1,
    memory_limit: 2,
    disk_size: 20,
    environment_variables: '',
    auto_scaling: true,
    health_check: true,
    health_check_path: '/health',
    health_check_interval: 30,
    notes: '',
    ssl_enabled: true,
    timeout: 30,
    max_requests_per_minute: 1000
  })
  form.value?.resetValidation()
}
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.v-card-title {
  background: linear-gradient(45deg, #1976d2, #42a5f5);
  color: white;
  border-radius: 12px 12px 0 0;
}

.v-expansion-panels {
  border-radius: 8px;
}
</style>
