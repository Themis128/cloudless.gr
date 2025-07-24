export const formatPipelineDate = (date: Date | string): string => {
  const d = new Date(date)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60))
  
  if (diffInHours < 1) {
    return 'Just now'
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`
  } else if (diffInHours < 168) { // 7 days
    const days = Math.floor(diffInHours / 24)
    return `${days}d ago`
  } else {
    return d.toLocaleDateString()
  }
}

export const exportPipelineData = (pipelines: any[]): string => {
  const exportData = pipelines.map(pipeline => ({
    id: pipeline.id,
    name: pipeline.name,
    description: pipeline.description,
    config: pipeline.config,
    status: pipeline.status,
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt
  }))
  
  return JSON.stringify(exportData, null, 2)
}

export const validatePipelineConfig = (config: string): { isValid: boolean; error?: string } => {
  try {
    const parsed = JSON.parse(config)
    
    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      return { isValid: false, error: 'Pipeline must have a steps array' }
    }
    
    if (parsed.steps.length === 0) {
      return { isValid: false, error: 'Pipeline must have at least one step' }
    }
    
    // Validate each step
    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i]
      if (!step.name || !step.type) {
        return { 
          isValid: false, 
          error: `Step ${i + 1} must have a name and type` 
        }
      }
    }
    
    return { isValid: true }
  } catch (error) {
    return { isValid: false, error: 'Invalid JSON configuration' }
  }
}

export const getPipelineStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'success'
    case 'running':
      return 'info'
    case 'draft':
      return 'warning'
    case 'completed':
      return 'primary'
    case 'error':
      return 'error'
    case 'paused':
      return 'grey'
    default:
      return 'grey'
  }
}

export const getPipelineStatusIcon = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'mdi-check-circle'
    case 'running':
      return 'mdi-play-circle'
    case 'draft':
      return 'mdi-pencil'
    case 'completed':
      return 'mdi-check'
    case 'error':
      return 'mdi-alert-circle'
    case 'paused':
      return 'mdi-pause-circle'
    default:
      return 'mdi-help-circle'
  }
}

export const calculatePipelineComplexity = (pipeline: any): number => {
  try {
    const config = typeof pipeline.config === 'string' 
      ? JSON.parse(pipeline.config) 
      : pipeline.config
    
    let complexity = 0
    
    // Base complexity for having a pipeline
    complexity += 1
    
    // Add complexity for each step
    if (config.steps && Array.isArray(config.steps)) {
      complexity += config.steps.length * 2
    }
    
    // Add complexity for conditional logic
    if (config.conditions) {
      complexity += Object.keys(config.conditions).length * 3
    }
    
    // Add complexity for error handling
    if (config.errorHandling) {
      complexity += 2
    }
    
    return Math.min(complexity, 10) // Cap at 10
  } catch {
    return 1
  }
}

export const getPipelineExecutionTime = (pipeline: any): number => {
  try {
    const config = typeof pipeline.config === 'string' 
      ? JSON.parse(pipeline.config) 
      : pipeline.config
    
    // Estimate execution time based on steps
    let estimatedTime = 0
    
    if (config.steps && Array.isArray(config.steps)) {
      estimatedTime = config.steps.length * 0.5 // 0.5 seconds per step
    }
    
    return Math.max(estimatedTime, 0.1) // Minimum 0.1 seconds
  } catch {
    return 1.0
  }
}

export const sanitizePipelineName = (name: string): string => {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters except spaces, hyphens, underscores
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .substring(0, 100) // Limit length
}

export const generatePipelineSlug = (name: string): string => {
  return sanitizePipelineName(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
} 