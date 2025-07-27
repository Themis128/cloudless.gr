<template>
  <v-container class="code-analyzer-container">
    <div class="text-center mb-8">
      <h1 class="text-h3 font-weight-bold mb-4">Code Analyzer</h1>
      <p class="text-body-1 text-medium-emphasis">
        Analyze code quality, identify potential issues, and get optimization suggestions with AI-powered insights.
      </p>
    </div>

    <v-row>
      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="text-h5 mb-4">Input Code</v-card-title>
          
          <v-form @submit.prevent="analyzeCode">
            <v-textarea
              v-model="codeInput"
              label="Code to Analyze"
              placeholder="Paste your code here for analysis..."
              rows="15"
              variant="outlined"
              class="mb-4 font-family-monospace"
              auto-grow
            ></v-textarea>

            <v-select
              v-model="analysisType"
              label="Analysis Type"
              :items="[
                { title: 'Comprehensive Analysis', value: 'comprehensive' },
                { title: 'Performance Analysis', value: 'performance' },
                { title: 'Security Analysis', value: 'security' },
                { title: 'Code Quality', value: 'quality' },
                { title: 'Best Practices', value: 'best-practices' }
              ]"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-select
              v-model="language"
              label="Programming Language"
              :items="[
                { title: 'JavaScript/TypeScript', value: 'javascript' },
                { title: 'Python', value: 'python' },
                { title: 'Java', value: 'java' },
                { title: 'C#', value: 'csharp' },
                { title: 'Go', value: 'go' },
                { title: 'Rust', value: 'rust' },
                { title: 'PHP', value: 'php' },
                { title: 'Ruby', value: 'ruby' }
              ]"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-checkbox
              v-model="includeSuggestions"
              label="Include improvement suggestions"
              class="mb-4"
            ></v-checkbox>

            <v-btn
              color="primary"
              size="large"
              block
              :loading="isAnalyzing"
              :disabled="!codeInput.trim()"
              @click="analyzeCode"
            >
              {{ isAnalyzing ? 'Analyzing...' : 'Analyze Code' }}
            </v-btn>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="d-flex align-center justify-space-between">
            <span class="text-h5">Analysis Results</span>
            <v-btn
              color="success"
              variant="outlined"
              size="small"
              @click="exportResults"
              :disabled="!analysisResults"
            >
              Export Results
            </v-btn>
          </v-card-title>
          
          <v-card-text>
            <div v-if="analysisResults" class="analysis-results">
              <!-- Overall Score -->
              <v-card class="mb-4" variant="outlined">
                <v-card-text class="text-center">
                  <div class="text-h4 font-weight-bold mb-2" :class="getScoreColor(analysisResults.score)">
                    {{ analysisResults.score }}/100
                  </div>
                  <div class="text-body-2 text-medium-emphasis">Overall Code Quality Score</div>
                </v-card-text>
              </v-card>

              <!-- Issues Summary -->
              <v-expansion-panels class="mb-4">
                <v-expansion-panel v-if="analysisResults.issues.length > 0">
                  <v-expansion-panel-title>
                    <div class="d-flex align-center">
                      <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
                      Issues Found ({{ analysisResults.issues.length }})
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list>
                      <v-list-item
                        v-for="(issue, index) in analysisResults.issues"
                        :key="index"
                        class="mb-2"
                      >
                        <template #prepend>
                          <v-icon :color="getIssueColor(issue.severity)" size="small">
                            {{ getIssueIcon(issue.severity) }}
                          </v-icon>
                        </template>
                        <v-list-item-title class="text-body-2 font-weight-medium">
                          {{ issue.title }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption">
                          {{ issue.description }}
                        </v-list-item-subtitle>
                        <template #append>
                          <v-chip :color="getIssueColor(issue.severity)" size="small" variant="tonal">
                            {{ issue.severity }}
                          </v-chip>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel v-if="analysisResults.suggestions.length > 0">
                  <v-expansion-panel-title>
                    <div class="d-flex align-center">
                      <v-icon color="info" class="mr-2">mdi-lightbulb</v-icon>
                      Suggestions ({{ analysisResults.suggestions.length }})
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list>
                      <v-list-item
                        v-for="(suggestion, index) in analysisResults.suggestions"
                        :key="index"
                        class="mb-2"
                      >
                        <template #prepend>
                          <v-icon color="info" size="small">mdi-lightbulb-outline</v-icon>
                        </template>
                        <v-list-item-title class="text-body-2 font-weight-medium">
                          {{ suggestion.title }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption">
                          {{ suggestion.description }}
                        </v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel v-if="analysisResults.metrics">
                  <v-expansion-panel-title>
                    <div class="d-flex align-center">
                      <v-icon color="success" class="mr-2">mdi-chart-line</v-icon>
                      Code Metrics
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-row>
                      <v-col cols="6" v-for="(value, key) in analysisResults.metrics" :key="key">
                        <v-card variant="outlined" class="text-center pa-3">
                          <div class="text-h6 font-weight-bold text-primary">{{ value }}</div>
                          <div class="text-caption text-medium-emphasis">{{ formatMetricName(key) }}</div>
                        </v-card>
                      </v-col>
                    </v-row>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

              <!-- Summary -->
              <v-alert
                :type="getSummaryType(analysisResults.score)"
                variant="tonal"
                class="mb-4"
              >
                <div class="font-weight-medium">{{ analysisResults.summary.title }}</div>
                <div class="text-body-2">{{ analysisResults.summary.description }}</div>
              </v-alert>
            </div>
            <div v-else class="text-center text-medium-emphasis pa-8">
              <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-code-braces</v-icon>
              <p>Analysis results will appear here...</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-8">
      <v-col cols="12">
        <h2 class="text-h4 text-center mb-6">Example Code Snippets</h2>
        <v-row>
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('performance-issue')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="warning" class="mb-4">mdi-timer-sand</v-icon>
                <h4 class="text-h6 mb-2">Performance Issue</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Code with potential performance bottlenecks
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('security-vulnerability')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="error" class="mb-4">mdi-shield-alert</v-icon>
                <h4 class="text-h6 mb-2">Security Vulnerability</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Code with potential security issues
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('clean-code')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="success" class="mb-4">mdi-check-circle</v-icon>
                <h4 class="text-h6 mb-2">Clean Code</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Well-structured, maintainable code
                </p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToolsStore } from '~/stores/toolsStore'

definePageMeta({
  title: 'Code Analyzer'
})

// Use tools store
const toolsStore = useToolsStore()

// Reactive state
const codeInput = ref('')
const analysisType = ref('comprehensive')
const language = ref('javascript')
const includeSuggestions = ref(true)
const isAnalyzing = ref(false)
const analysisResults = ref<any>(null)

const examples = {
  'performance-issue': `function processLargeArray(items) {
  let result = [];
  
  for (let i = 0; i < items.length; i++) {
    // Inefficient nested loop
    for (let j = 0; j < items.length; j++) {
      if (items[i].id === items[j].id) {
        result.push(items[i]);
      }
    }
  }
  
  return result;
}

// DOM manipulation in loop
function updateElements() {
  const elements = document.querySelectorAll('.item');
  for (let i = 0; i < elements.length; i++) {
    elements[i].style.display = 'none';
    elements[i].innerHTML = 'Updated';
    elements[i].style.display = 'block';
  }
}`,
  'security-vulnerability': `// SQL Injection vulnerability
function getUserData(userId) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  return database.execute(query);
}

// XSS vulnerability
function displayUserInput(userInput) {
  document.getElementById('output').innerHTML = userInput;
}

// Hardcoded credentials
const config = {
  username: 'admin',
  password: 'password123',
  apiKey: 'sk-1234567890abcdef'
};`,
  'clean-code': `// Clean, well-structured code
class UserService {
  constructor(private userRepository: UserRepository) {}
  
  async getUserById(id: string): Promise<User | null> {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid user ID provided');
    }
    
    try {
      const user = await this.userRepository.findById(id);
      return user || null;
    } catch (error) {
      logger.error('Failed to fetch user', { id, error });
      throw new Error('User not found');
    }
  }
  
  async createUser(userData: CreateUserDto): Promise<User> {
    const validationResult = this.validateUserData(userData);
    if (!validationResult.isValid) {
      throw new ValidationError(validationResult.errors);
    }
    
    const user = await this.userRepository.create(userData);
    return user;
  }
  
  private validateUserData(data: CreateUserDto): ValidationResult {
    const errors: string[] = [];
    
    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push('Valid email is required');
    }
    
    if (!data.name || data.name.length < 2) {
      errors.push('Name must be at least 2 characters long');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}`
}

const loadExample = (exampleKey: string) => {
  codeInput.value = examples[exampleKey as keyof typeof examples]
}

const analyzeCode = async () => {
  if (!codeInput.value.trim()) {
    alert('Please enter some code to analyze')
    return
  }

  isAnalyzing.value = true
  analysisResults.value = null

  try {
    const prompt = `Analyze the following ${language.value} code for ${analysisType.value} analysis:

${codeInput.value}

Please provide a comprehensive analysis including:
- Overall code quality score (0-100)
- List of issues found with severity levels (critical, high, medium, low)
- Code metrics (lines of code, complexity, etc.)
- Improvement suggestions (if requested)
- Summary of findings

Format the response as JSON with the following structure:
{
  "score": number,
  "issues": [{"title": string, "description": string, "severity": string}],
  "suggestions": [{"title": string, "description": string}],
  "metrics": {"linesOfCode": number, "complexity": number, "maintainability": number},
  "summary": {"title": string, "description": string}
}`

    const response = await $fetch('/api/generate', {
      method: 'POST',
      body: { prompt }
    }) as any

    const responseText = response?.response || response || 'Failed to analyze code'
    
    try {
      // Try to parse JSON response
      analysisResults.value = JSON.parse(responseText)
    } catch (parseError) {
      // If not JSON, create a basic analysis result
      analysisResults.value = {
        score: 75,
        issues: [
          {
            title: 'Analysis completed',
            description: responseText,
            severity: 'info'
          }
        ],
        suggestions: [],
        metrics: {
          linesOfCode: codeInput.value.split('\n').length,
          complexity: 1,
          maintainability: 75
        },
        summary: {
          title: 'Analysis Complete',
          description: 'Code analysis has been completed. Review the results above.'
        }
      }
    }

    // Record tool usage
    toolsStore.recordToolUsage('code-analyzer', true)
  } catch (error) {
    console.error('Error analyzing code:', error)
    analysisResults.value = {
      score: 0,
      issues: [
        {
          title: 'Analysis Failed',
          description: 'Error analyzing code. Please try again.',
          severity: 'critical'
        }
      ],
      suggestions: [],
      metrics: {},
      summary: {
        title: 'Analysis Failed',
        description: 'Unable to analyze the provided code.'
      }
    }
  } finally {
    isAnalyzing.value = false
  }
}

const exportResults = () => {
  if (!analysisResults.value) return
  
  const dataStr = JSON.stringify(analysisResults.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'code-analysis-results.json'
  link.click()
  URL.revokeObjectURL(url)
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-success'
  if (score >= 60) return 'text-warning'
  return 'text-error'
}

const getIssueColor = (severity: string) => {
  const colorMap: Record<string, string> = {
    'critical': 'error',
    'high': 'error',
    'medium': 'warning',
    'low': 'info'
  }
  return colorMap[severity] || 'grey'
}

const getIssueIcon = (severity: string) => {
  const iconMap: Record<string, string> = {
    'critical': 'mdi-alert-octagon',
    'high': 'mdi-alert-circle',
    'medium': 'mdi-alert',
    'low': 'mdi-information'
  }
  return iconMap[severity] || 'mdi-information'
}

const getSummaryType = (score: number) => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

const formatMetricName = (key: string) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
}

// Record tool usage on mount
onMounted(() => {
  toolsStore.recordToolUsage('code-analyzer')
})
</script>

<style scoped>
.code-analyzer-container {
  max-width: 1200px;
  margin: 0 auto;
}

.example-card {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.example-card:hover {
  transform: translateY(-2px);
}

.font-family-monospace {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.analysis-results {
  max-height: 600px;
  overflow-y: auto;
}
</style> 