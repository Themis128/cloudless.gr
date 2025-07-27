// Client-safe utility functions for project data manipulation

export function findThumbnailImage(images: any[]): any | undefined {
  return images.find(image => image.is_thumbnail)
}

export function findPrimaryTags(tags: any[]): any[] {
  return tags.filter(tag => tag.is_primary)
}

export function findFavoriteProjects(projects: any[]): any[] {
  return projects.filter(project => project.isFavorite)
}

// Additional client-safe utility functions
export function formatProjectDuration(duration: string): string {
  return duration.toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

export function getProjectStatusColor(status: string): string {
  switch (status) {
    case 'published':
      return '#10b981'
    case 'draft':
      return '#f59e0b'
    case 'archived':
      return '#6b7280'
    default:
      return '#6b7280'
  }
}

export function truncateDescription(description: string, maxLength: number = 150): string {
  if (description.length <= maxLength) return description
  return description.slice(0, maxLength).trim() + '...'
}
