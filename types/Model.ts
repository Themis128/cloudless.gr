// Model type
export interface Model {
  id: string
  name: string
  type?: string
  description?: string
  version?: string
  framework?: string
  status?: 'draft' | 'training' | 'ready' | 'deployed' | 'archived'
  created_at?: string
  updated_at?: string
  owner_id?: string
  project_id?: string
  config?: any
  metrics?: any
}

