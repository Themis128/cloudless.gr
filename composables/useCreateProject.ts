/**
 * Composable for creating new projects
 */
import { ref } from 'vue'
import type { CreateProjectData, Project } from '~/types/project'

export const useCreateProject = () => {
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // Supabase client
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  // Create a new project
  const createProject = async (projectData: CreateProjectData): Promise<Project> => {
    if (!user.value) {
      throw new Error('User not authenticated')
    }

    try {
      loading.value = true
      error.value = null

      // Create project record
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          type: projectData.type,
          status: 'draft',
          owner_id: user.value.id
        })
        .select()
        .single()

      if (projectError) {
        throw projectError
      }

      // Create initial pipeline if template config provided
      if (projectData.config) {
        const { error: pipelineError } = await supabase
          .from('pipelines')
          .insert({
            project_id: project.id,
            owner_id: user.value.id,
            config: projectData.config
          })

        if (pipelineError) {
          console.warn('Failed to create initial pipeline:', pipelineError)
          // Don't throw here - project was created successfully
        }
      }

      return project
    } catch (err) {
      error.value = err as Error
      console.error('Failed to create project:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Create project from template
  const createFromTemplate = async (templateId: string, projectName: string): Promise<Project> => {
    // This would fetch template configuration from your templates system
    // For now, we'll use a basic implementation
    const templateConfigs = {
      'image-classification': {
        type: 'cv' as const,
        config: {
          nodes: [
            {
              id: 'data-loader-1',
              type: 'data-loader' as const,
              position: { x: 100, y: 100 },
              config: { format: 'image', batch_size: 32 }
            },
            {
              id: 'model-1',
              type: 'model' as const,
              position: { x: 300, y: 100 },
              config: { architecture: 'resnet50', pretrained: true }
            },
            {
              id: 'training-1',
              type: 'training' as const,
              position: { x: 500, y: 100 },
              config: { epochs: 50, learning_rate: 0.001 }
            }
          ],
          connections: []
        }
      },
      'text-classification': {
        type: 'nlp' as const,
        config: {
          nodes: [
            {
              id: 'data-loader-1',
              type: 'data-loader' as const,
              position: { x: 100, y: 100 },
              config: { format: 'text' }
            },
            {
              id: 'model-1',
              type: 'model' as const,
              position: { x: 300, y: 100 },
              config: { architecture: 'bert-base-uncased' }
            }
          ],
          connections: []
        }
      }
    }

    const template = templateConfigs[templateId as keyof typeof templateConfigs]
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    return createProject({
      name: projectName,
      type: template.type,
      config: template.config
    })
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    createProject,
    createFromTemplate
  }
}
