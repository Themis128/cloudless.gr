/**
 * Documentation composable for easy access to documentation store functionality
 */
import { computed } from 'vue'
import { useDocumentationStore } from '~/stores/documentationStore'
import type { DocumentationPage, DocumentationSection } from '~/stores/documentationStore'
export const useDocumentation = () => {
  const docStore = useDocumentationStore()

  // Initialize documentation if not already loaded
  const initializeIfNeeded = async () => {
    if (docStore.pages.length === 0) {
      await docStore.initialize()
    }
  }

  // Search documentation (all docs are public now)
  const searchDocs = async (query: string) => {
    await initializeIfNeeded()
    return await docStore.searchDocumentation(query, false)
  }

  // Get all pages (all docs are public now)
  const getAccessiblePages = async () => {
    await initializeIfNeeded()
    return docStore.pages
  }

  // Get all sections (all docs are public now)
  const getAccessibleSections = async () => {
    await initializeIfNeeded()
    return docStore.sections
  }

  // Get quick links for the current user
  const getQuickLinks = async () => {
    await initializeIfNeeded()
    return docStore.quickLinks
  }

  // Get recent documentation updates (all docs are public now)
  const getRecentUpdates = async () => {
    await initializeIfNeeded()
    return docStore.recentPages
  }

  // Get documentation by category (all docs are public now)
  const getPagesByCategory = async (category: string) => {
    await initializeIfNeeded()
    return docStore.pagesByCategory(category)
  }

  // Get documentation by difficulty (all docs are public now)
  const getPagesByDifficulty = async (difficulty: 'Beginner' | 'Intermediate' | 'Advanced') => {
    await initializeIfNeeded()
    return docStore.pagesByDifficulty(difficulty)
  }

  // Get page details (all docs are public now)
  const getPageDetails = async (pageId: string) => {
    await initializeIfNeeded()
    return docStore.getPageById(pageId)
  }

  // Get navigation breadcrumbs for a page (all docs are public now)
  const getBreadcrumbs = async (pageId: string) => {
    await initializeIfNeeded()
    const page = docStore.getPageById(pageId)
    if (!page) return []
    const breadcrumbs = [
      { title: 'Documentation', path: '/documentation' }
    ]
    // Find the section this page belongs to
    const section = docStore.sections.find((s: DocumentationSection) => s.pages.some((p: DocumentationPage) => p.id === pageId))
    if (section) {
      breadcrumbs.push({ title: section.title, path: '/documentation' })
    }
    breadcrumbs.push({ title: page.title, path: page.path })
    return breadcrumbs
  }

  // Get related pages (all docs are public now)
  const getRelatedPages = async (pageId: string, limit = 3) => {
    await initializeIfNeeded()
    const currentPage = docStore.getPageById(pageId)
    if (!currentPage) return []
    // Find pages with similar tags or same category
    const allPages: DocumentationPage[] = docStore.pages
    const relatedPages = allPages
      .filter((page: DocumentationPage) => page.id !== pageId)
      .map((page: DocumentationPage) => {
        let score = 0
        // Same category gets high score
        if (page.category === currentPage.category) score += 10
        // Similar difficulty gets medium score
        if (page.difficulty === currentPage.difficulty) score += 5
        // Shared tags get points
        const sharedTags = page.tags.filter((tag: string) => currentPage.tags.includes(tag))
        score += sharedTags.length * 3
        return { page, score }
      })
      .filter((item: { page: DocumentationPage; score: number }) => item.score > 0)
      .sort((a: { page: DocumentationPage; score: number }, b: { page: DocumentationPage; score: number }) => b.score - a.score)
      .slice(0, limit)
      .map((item: { page: DocumentationPage; score: number }) => item.page)
    return relatedPages
  }

  // Get statistics for documentation
  const getDocumentationStats = async () => {
    await initializeIfNeeded()
    return {
      ...docStore.searchStats,
      recentUpdates: docStore.recentPages.length,
      categories: [...new Set(docStore.pages.map((p: DocumentationPage) => p.category))].length,
      averageReadTime: Math.round(
        docStore.pages.reduce((sum: number, page: DocumentationPage) => sum + page.estimatedReadTime, 0) /
        docStore.pages.length
      )
    }
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
  }
}
