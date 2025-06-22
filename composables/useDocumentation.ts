/**
 * Documentation composable for easy access to documentation store functionality
 */
export const useDocumentation = () => {
  const docStore = useDocumentationStore()
  const authStore = useAuthStore()

  // Initialize documentation if not already loaded
  const initializeIfNeeded = async () => {
    if (docStore.pages.length === 0) {
      await docStore.initialize()
    }
  }

  // Search documentation with proper access control
  const searchDocs = async (query: string) => {
    await initializeIfNeeded()
    const includeAdminDocs = authStore.isAdmin
    return await docStore.searchDocumentation(query, includeAdminDocs)
  }

  // Get accessible pages based on user role
  const getAccessiblePages = async () => {
    await initializeIfNeeded()
    return authStore.isAdmin ? docStore.pages : docStore.publicPages
  }

  // Get accessible sections based on user role
  const getAccessibleSections = async () => {
    await initializeIfNeeded()
    return authStore.isAdmin ? docStore.sections : docStore.publicSections
  }

  // Get quick links for the current user
  const getQuickLinks = async () => {
    await initializeIfNeeded()
    return docStore.quickLinks
  }

  // Get recent documentation updates
  const getRecentUpdates = async () => {
    await initializeIfNeeded()
    const recentPages = docStore.recentPages
    // Filter by access level
    return authStore.isAdmin 
      ? recentPages 
      : recentPages.filter(page => !page.isAdminOnly)
  }

  // Get documentation by category with access control
  const getPagesByCategory = async (category: string) => {
    await initializeIfNeeded()
    const pages = docStore.pagesByCategory(category)
    return authStore.isAdmin 
      ? pages 
      : pages.filter(page => !page.isAdminOnly)
  }

  // Get documentation by difficulty with access control
  const getPagesByDifficulty = async (difficulty: 'Beginner' | 'Intermediate' | 'Advanced') => {
    await initializeIfNeeded()
    const pages = docStore.pagesByDifficulty(difficulty)
    return authStore.isAdmin 
      ? pages 
      : pages.filter(page => !page.isAdminOnly)
  }

  // Get page details with access control
  const getPageDetails = async (pageId: string) => {
    await initializeIfNeeded()
    const page = docStore.getPageById(pageId)
    
    if (!page) return null
    
    // Check access permissions
    if (page.isAdminOnly && !authStore.isAdmin) {
      throw new Error('Admin access required for this documentation page')
    }
    
    return page
  }

  // Get navigation breadcrumbs for a page
  const getBreadcrumbs = async (pageId: string) => {
    await initializeIfNeeded()
    const page = docStore.getPageById(pageId)
    
    if (!page) return []
    
    const breadcrumbs = [
      { title: 'Documentation', path: '/documentation' }
    ]
    
    if (page.isAdminOnly) {
      breadcrumbs.push({ title: 'Admin Documentation', path: '/admin/docs' })
    }
    
    // Find the section this page belongs to
    const section = docStore.sections.find(s => 
      s.pages.some(p => p.id === pageId)
    )
    
    if (section) {
      breadcrumbs.push({ 
        title: section.title, 
        path: page.isAdminOnly ? '/admin/docs' : '/documentation'
      })
    }
    
    breadcrumbs.push({ title: page.title, path: page.path })
    
    return breadcrumbs
  }

  // Get related pages
  const getRelatedPages = async (pageId: string, limit = 3) => {
    await initializeIfNeeded()
    const currentPage = docStore.getPageById(pageId)
    
    if (!currentPage) return []
    
    // Find pages with similar tags or same category
    const allPages = authStore.isAdmin ? docStore.pages : docStore.publicPages
    const relatedPages = allPages
      .filter(page => page.id !== pageId)
      .map(page => {
        let score = 0
        
        // Same category gets high score
        if (page.category === currentPage.category) score += 10
        
        // Similar difficulty gets medium score
        if (page.difficulty === currentPage.difficulty) score += 5
        
        // Shared tags get points
        const sharedTags = page.tags.filter(tag => currentPage.tags.includes(tag))
        score += sharedTags.length * 3
        
        return { page, score }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.page)
    
    return relatedPages
  }

  // Get statistics for admin dashboard
  const getDocumentationStats = async () => {
    await initializeIfNeeded()
    return {
      ...docStore.searchStats,
      recentUpdates: docStore.recentPages.length,
      categories: [...new Set(docStore.pages.map(p => p.category))].length,
      averageReadTime: Math.round(
        docStore.pages.reduce((sum, page) => sum + page.estimatedReadTime, 0) / 
        docStore.pages.length
      )
    }
  }

  // Admin-only functions
  const adminFunctions = {
    addPage: docStore.addPage.bind(docStore),
    updatePageContent: docStore.updatePageContent.bind(docStore),
    removePage: docStore.removePage.bind(docStore)
  }

  return {
    // Store reference
    store: docStore,
    
    // Reactive getters
    loading: computed(() => docStore.loading),
    error: computed(() => docStore.error),
    searchResults: computed(() => docStore.searchResults),
    searchQuery: computed(() => docStore.searchQuery),
    
    // Methods
    initializeIfNeeded,
    searchDocs,
    getAccessiblePages,
    getAccessibleSections,
    getQuickLinks,
    getRecentUpdates,
    getPagesByCategory,
    getPagesByDifficulty,
    getPageDetails,
    getBreadcrumbs,
    getRelatedPages,
    getDocumentationStats,
    
    // Clear functions
    clearSearch: docStore.clearSearch.bind(docStore),
    clearData: docStore.clearData.bind(docStore),
    
    // Admin functions (only available if user is admin)
    ...(authStore.isAdmin ? { admin: adminFunctions } : {})
  }
}
