<template>
  <div class="llm-local-page">
    <h1>Local LLM Management</h1>

    <!-- Quota Usage -->
    <section>
      <h2>Quota Usage</h2>
      <button @click="fetchQuota" :disabled="quotaLoading">Refresh Quota</button>
      <div v-if="quotaLoading">Loading...</div>
      <div v-else-if="quota">
        <div>Jobs running: {{ quota.jobs_running }} / {{ quota.max_jobs }}</div>
        <div>Disk usage: {{ quota.disk_mb }}MB / {{ quota.max_disk_mb }}MB</div>
      </div>
    </section>

    <!-- Upload Model -->
    <section>
      <h2>Upload Model</h2>
      <form @submit.prevent="uploadModel">
        <input type="file" ref="modelFile" required />
        <input v-model="uploadOwner" placeholder="Owner/User" required />
        <button :disabled="uploading">Upload</button>
      </form>
      <div v-if="uploadStatus" :class="{ error: uploadError, success: !uploadError }">{{ uploadStatus }}</div>
    </section>

    <!-- List Models -->
    <section>
      <h2>Your Models</h2>
      <input v-model="listOwner" placeholder="Owner/User" @change="fetchModels" />
      <button @click="fetchModels">Refresh</button>
      <ul>
        <li v-for="model in models" :key="model.name">{{ model.name }}</li>
      </ul>
    </section>

    <!-- Train Model -->
    <section>
      <h2>Train/Fine-tune Model</h2>
      <form @submit.prevent="startTraining">
        <input v-model="trainOwner" placeholder="Owner/User" required />
        <input v-model="trainModelName" placeholder="Model Name" required />
        <input v-model="trainDataPath" placeholder="Train Data Path (on server)" required />
        <input v-model.number="trainEpochs" type="number" placeholder="Epochs" />
        <input v-model.number="trainBatchSize" type="number" placeholder="Batch Size" />
        <button :disabled="training">Start Training</button>
      </form>
      <div v-if="trainStatus" :class="{ error: trainError, success: !trainError }">{{ trainStatus }}</div>
    </section>

    <!-- Inference -->
    <section>
      <h2>Run Inference</h2>
      <form @submit.prevent="runInference">
        <input v-model="inferOwner" placeholder="Owner/User" required />
        <input v-model="inferModelName" placeholder="Model Name" required />
        <input v-model="inferPrompt" placeholder="Prompt" required />
        <button :disabled="inferLoading">Run</button>
      </form>
      <div v-if="inferResult" :class="{ error: inferError, success: !inferError }">Result: {{ inferResult }}</div>
    </section>

    <!-- Job Status -->
    <section>
      <h2>Job Status</h2>
      <input v-model="jobId" placeholder="Job ID" />
      <button @click="fetchJobStatus">Check Status</button>
      <div v-if="jobStatus">Status: {{ jobStatus.status }}<br />Result: {{ jobStatus.result }}</div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const API_BASE = 'http://localhost:8000' // Adjust if needed

// Quota
const quota = ref(null)
const quotaLoading = ref(false)
async function fetchQuota() {
  if (!uploadOwner.value) return
  quotaLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/llms/quota?owner=${encodeURIComponent(uploadOwner.value)}`)
    quota.value = await res.json()
  } catch (e) {
    quota.value = null
  }
  quotaLoading.value = false
}

// Upload
const modelFile = ref(null)
const uploadOwner = ref('')
const uploading = ref(false)
const uploadStatus = ref('')
const uploadError = ref(false)

async function uploadModel() {
  if (!modelFile.value?.files[0] || !uploadOwner.value) return
  uploading.value = true
  uploadStatus.value = ''
  uploadError.value = false
  const formData = new FormData()
  formData.append('file', modelFile.value.files[0])
  formData.append('owner', uploadOwner.value)
  try {
    const res = await fetch(`${API_BASE}/llms/upload`, {
      method: 'POST',
      body: formData
    })
    if (!res.ok) {
      const err = await res.json()
      uploadStatus.value = err.detail || 'Upload failed.'
      uploadError.value = true
    } else {
      const data = await res.json()
      uploadStatus.value = data.status === 'success' ? 'Upload successful!' : 'Upload failed.'
      uploadError.value = data.status !== 'success'
      fetchQuota()
    }
  } catch (e) {
    uploadStatus.value = 'Error uploading.'
    uploadError.value = true
  }
  uploading.value = false
}

// List Models
const listOwner = ref('')
const models = ref([])
async function fetchModels() {
  if (!listOwner.value) return
  const res = await fetch(`${API_BASE}/llms/list?owner=${encodeURIComponent(listOwner.value)}`)
  models.value = await res.json()
}

// Train
const trainOwner = ref('')
const trainModelName = ref('')
const trainDataPath = ref('')
const trainEpochs = ref(1)
const trainBatchSize = ref(1)
const training = ref(false)
const trainStatus = ref('')
const trainError = ref(false)
async function startTraining() {
  training.value = true
  trainStatus.value = ''
  trainError.value = false
  try {
    const res = await fetch(`${API_BASE}/llms/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_name: trainModelName.value,
        train_data_path: trainDataPath.value,
        config: { epochs: trainEpochs.value, batch_size: trainBatchSize.value },
        owner: trainOwner.value
      })
    })
    if (!res.ok) {
      const err = await res.json()
      trainStatus.value = err.detail || 'Error starting training.'
      trainError.value = true
    } else {
      const data = await res.json()
      trainStatus.value = `Job queued: ${data.job_id}`
      trainError.value = false
      fetchQuota()
    }
  } catch (e) {
    trainStatus.value = 'Error starting training.'
    trainError.value = true
  }
  training.value = false
}

// Inference
const inferOwner = ref('')
const inferModelName = ref('')
const inferPrompt = ref('')
const inferLoading = ref(false)
const inferResult = ref('')
const inferError = ref(false)
async function runInference() {
  inferLoading.value = true
  inferResult.value = ''
  inferError.value = false
  try {
    const res = await fetch(`${API_BASE}/llms/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_name: inferModelName.value,
        prompt: inferPrompt.value,
        owner: inferOwner.value
      })
    })
    if (!res.ok) {
      const err = await res.json()
      inferResult.value = err.detail || 'Error running inference.'
      inferError.value = true
    } else {
      const data = await res.json()
      inferResult.value = `Job queued: ${data.job_id}`
      inferError.value = false
      fetchQuota()
    }
  } catch (e) {
    inferResult.value = 'Error running inference.'
    inferError.value = true
  }
  inferLoading.value = false
}

// Job Status
const jobId = ref('')
const jobStatus = ref(null)
async function fetchJobStatus() {
  if (!jobId.value) return
  const res = await fetch(`${API_BASE}/llms/job-status/${jobId.value}`)
  jobStatus.value = await res.json()
}
</script>

<style scoped>
.llm-local-page {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem;
}
section {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 8px;
}
input, button {
  margin: 0.5rem 0.5rem 0.5rem 0;
}
.error {
  color: #d32f2f;
  font-weight: bold;
}
.success {
  color: #388e3c;
  font-weight: bold;
}
<<<<<<< HEAD
</style>
=======
</style>
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
