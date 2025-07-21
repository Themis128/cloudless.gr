export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: string
  features: string[]
  technologies: string[]
  techStack: string[]
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  estimatedTime: string
  includes: string[]
  config: {
    type: string
    algorithm?: string
    framework?: string
    pipeline?: {
      nodes: Array<{
        id: string
        type: string
        label: string
        config?: any
      }>
    }
    nodes?: Array<{
      id: string
      type: string
      label: string
      config?: any
    }>
  }
}

export interface Project {
  id?: string
  name: string
  description: string | null
  template_id?: string
  owner_id: string
  created_at?: string
  updated_at?: string | null
  is_active?: boolean
  config?: any
  status?: 'draft' | 'active' | 'archived'
} 