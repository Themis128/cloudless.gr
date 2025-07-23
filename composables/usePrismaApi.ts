import { ref } from 'vue'

// Prisma API composable for database operations
export const usePrismaApi = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Generic API call function
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      return response
    } catch (err: any) {
      error.value = err.message || 'An error occurred'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Project operations
  const getProjects = () => apiCall('/api/projects')
  
  const getProject = (id: number) => apiCall(`/api/projects/${id}`)
  
  const createProject = (projectData: any) => 
    apiCall('/api/projects', {
      method: 'POST',
      body: projectData
    })

  // User operations
  const getUsers = () => apiCall('/api/users')
  
  const getUser = (id: number) => apiCall(`/api/users/${id}`)
  
  const createUser = (userData: any) => 
    apiCall('/api/users', {
      method: 'POST',
      body: userData
    })

  // Contact operations
  const createContactSubmission = (contactData: any) => 
    apiCall('/api/contact', {
      method: 'POST',
      body: contactData
    })

  const getContactSubmissions = () => apiCall('/api/contact-submissions')

  return {
    isLoading,
    error,
    getProjects,
    getProject,
    createProject,
    getUsers,
    getUser,
    createUser,
    createContactSubmission,
    getContactSubmissions
  }
}