import { defineStore } from 'pinia'

export interface DocumentationPage {
  id: string
  title: string
  description: string
  content?: string
  path: string
  icon: string
  category: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  tags: string[]
  lastUpdated: string

  estimatedReadTime: number
}

export interface DocumentationSection {
  id: string
  title: string
  description: string
  icon: string
  pages: DocumentationPage[]

}

export interface SearchResult {
  page: DocumentationPage
  score: number
  matchedContent: string
}

interface DocumentationState {
  pages: DocumentationPage[]
  sections: DocumentationSection[]
  searchResults: SearchResult[]
  searchQuery: string
  loading: boolean
  error: string | null
  lastSearchTime: number
}

export const useDocumentationStore = defineStore('documentation', {
  state: (): DocumentationState => ({
    pages: [],
    sections: [],
    searchResults: [],
    searchQuery: '',
    loading: false,
    error: null,
    lastSearchTime: 0
  }),

  getters: {
    // Get public documentation pages (accessible to all users)

    // All documentation pages (no role-based filtering)
    allPages: (state) => state.pages,
    // All documentation sections (no role-based filtering)
    allSections: (state) => state.sections,
    
    // Get pages by category
    pagesByCategory: (state) => (category: string) => 
      state.pages.filter(page => page.category === category),
    
    // Get pages by difficulty
    pagesByDifficulty: (state) => (difficulty: DocumentationPage['difficulty']) =>
      state.pages.filter(page => page.difficulty === difficulty),
    
    // Get recent pages (updated in last 30 days)
    recentPages: (state) => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return state.pages
        .filter(page => new Date(page.lastUpdated) > thirtyDaysAgo)
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    },
    
    // Get quick links for landing page
    quickLinks: (state) => {
      return state.pages
        .filter(page => page.tags.includes('quick-start') || page.tags.includes('popular'))
        .slice(0, 6)
    },
      // Get search statistics
    searchStats: (state) => ({
      totalPages: state.pages.length,
      lastSearchResultCount: state.searchResults.length,
      hasActiveSearch: state.searchQuery.length > 0
    })
  },

  actions: {
    // Initialize documentation data
    async initialize() {
      this.loading = true
      this.error = null
      try {
        await this.loadDocumentationData()
      } catch (error) {
        this.error = `Failed to initialize documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error('Documentation store initialization error:', error)
      } finally {
        this.loading = false
      }
    },

    // Load public documentation data
    async loadDocumentationData() {
      // All documentation pages (no admin-only)
      const publicPages: DocumentationPage[] = [
        {
          id: 'getting-started',
          title: 'Getting Started',
          description: 'Quick start guide to begin using the platform',
          path: '/documentation/getting-started',
          icon: 'mdi-rocket-launch',
          category: 'Getting Started',
          difficulty: 'Beginner',
          tags: ['quick-start', 'beginner', 'setup'],
          lastUpdated: '2025-06-15',

          estimatedReadTime: 5
        },
        {
          id: 'api-reference',
          title: 'API Reference',
          description: 'Complete API documentation and examples',
          path: '/documentation/api-reference',
          icon: 'mdi-api',
          category: 'Reference',
          difficulty: 'Intermediate',
          tags: ['api', 'reference', 'endpoints'],
          lastUpdated: '2025-06-18',

          estimatedReadTime: 15
        },
        {
          id: 'user-guide',
          title: 'User Guide',
          description: 'Comprehensive user manual and tutorials',
          path: '/documentation/user-guide',
          icon: 'mdi-book-open-page-variant',
          category: 'Guides',
          difficulty: 'Beginner',
          tags: ['manual', 'tutorial', 'features'],
          lastUpdated: '2025-06-10',

          estimatedReadTime: 20
        },
        {
          id: 'troubleshooting',
          title: 'Troubleshooting',
          description: 'Common issues and solutions',
          path: '/documentation/troubleshooting',
          icon: 'mdi-tools',
          category: 'Support',
          difficulty: 'Intermediate',
          tags: ['problems', 'solutions', 'support'],
          lastUpdated: '2025-06-12',

          estimatedReadTime: 10
        },
        {
          id: 'faq',
          title: 'FAQ',
          description: 'Frequently asked questions',
          path: '/documentation/faq',
          icon: 'mdi-help-circle',
          category: 'Support',
          difficulty: 'Beginner',
          tags: ['questions', 'answers', 'popular'],
          lastUpdated: '2025-06-14',

          estimatedReadTime: 8
        }
      ]

      // Public documentation sections
      const publicSections: DocumentationSection[] = [
        {
          id: 'getting-started-section',
          title: 'Getting Started',
          description: 'Everything you need to start using the platform',
          icon: 'mdi-rocket-launch',
          pages: publicPages.filter(p => p.category === 'Getting Started'),

        },
        {
          id: 'guides-section',
          title: 'User Guides',
          description: 'Step-by-step tutorials and comprehensive guides',
          icon: 'mdi-book-open-variant',
          pages: publicPages.filter(p => p.category === 'Guides'),

        },
        {
          id: 'reference-section',
          title: 'API Reference',
          description: 'Technical documentation and API specifications',
          icon: 'mdi-api',
          pages: publicPages.filter(p => p.category === 'Reference'),

        },
        {
          id: 'support-section',
          title: 'Support',
          description: 'Help, troubleshooting, and frequently asked questions',
          icon: 'mdi-help-circle',
          pages: publicPages.filter(p => p.category === 'Support'),

        }
      ]

      this.pages.push(...publicPages)
      this.sections.push(...publicSections)
    },

    // Load admin documentation data
    async loadAdminDocumentationData() {
      // Admin-only documentation pages
      const adminPages: DocumentationPage[] = [
        {
          id: 'page-structure',
          title: 'Page Structure & Access Control',
          description: 'Application page hierarchy and access control system',
          path: '/admin/docs/page-structure',
          icon: 'mdi-file-tree',
          category: 'Architecture',
          difficulty: 'Advanced',
          tags: ['structure', 'access-control', 'routing'],
          lastUpdated: '2025-06-21',

          estimatedReadTime: 12
        },
        {
          id: 'navigation',
          title: 'Navigation Guide',
          description: 'User flows and navigation patterns for admin and user interfaces',
          path: '/admin/docs/navigation',
          icon: 'mdi-navigation',
          category: 'Architecture',
          difficulty: 'Intermediate',
          tags: ['navigation', 'user-flows', 'interface'],
          lastUpdated: '2025-06-21',

          estimatedReadTime: 10
        },
        {
          id: 'stores',
          title: 'Store Architecture',
          description: 'Pinia store structure, authentication flows, and state management',
          path: '/admin/docs/stores',
          icon: 'mdi-database',
          category: 'Development',
          difficulty: 'Advanced',
          tags: ['pinia', 'state-management', 'stores'],
          lastUpdated: '2025-06-21',

          estimatedReadTime: 15
        },
        {
          id: 'authentication',
          title: 'Authentication System',
          description: 'Authentication implementation, role-based access, and security',
          path: '/admin/docs/authentication',
          icon: 'mdi-shield-account',
          category: 'Security',
          difficulty: 'Advanced',
          tags: ['authentication', 'security', 'roles'],
          lastUpdated: '2025-06-21',

          estimatedReadTime: 18
        },
        {
          id: 'development',
          title: 'Development Guide',
          description: 'Development setup, coding standards, and contribution guidelines',
          path: '/admin/docs/development',
          icon: 'mdi-code-braces',
          category: 'Development',
          difficulty: 'Intermediate',
          tags: ['development', 'setup', 'standards'],
          lastUpdated: '2025-06-21',

          estimatedReadTime: 14
        },
        {
          id: 'system-admin',
          title: 'System Administration',
          description: 'System maintenance, database management, and admin procedures',
          path: '/admin/docs/system-admin',
          icon: 'mdi-cog',
          category: 'Administration',
          difficulty: 'Advanced',
          tags: ['system', 'maintenance', 'administration'],
          lastUpdated: '2025-06-21',

          estimatedReadTime: 20
        }
      ]

      // Admin documentation sections
      const adminSections: DocumentationSection[] = [
        {
          id: 'architecture-section',
          title: 'System Architecture',
          description: 'Application structure, routing, and architectural patterns',
          icon: 'mdi-file-tree',
          pages: adminPages.filter(p => p.category === 'Architecture'),

        },
        {
          id: 'development-section',
          title: 'Development',
          description: 'Development guides, store architecture, and coding standards',
          icon: 'mdi-code-braces',
          pages: adminPages.filter(p => p.category === 'Development'),

        },
        {
          id: 'security-section',
          title: 'Security & Authentication',
          description: 'Authentication systems, security implementation, and access control',
          icon: 'mdi-shield-account',
          pages: adminPages.filter(p => p.category === 'Security'),

        },
        {
          id: 'administration-section',
          title: 'System Administration',
          description: 'System maintenance, database management, and administrative procedures',
          icon: 'mdi-cog',
          pages: adminPages.filter(p => p.category === 'Administration'),

        }
      ]

      this.pages.push(...adminPages)
      this.sections.push(...adminSections)
    },

    // Search documentation
    async searchDocumentation(query: string) {
      if (!query.trim()) {
        this.searchResults = []
        this.searchQuery = ''
        return []
      }

      this.searchQuery = query.toLowerCase()
      this.lastSearchTime = Date.now()
      

      // No role-based filtering, just return all pages
      const searchablePages = this.pages

      const results: SearchResult[] = []

      searchablePages.forEach(page => {
        let score = 0
        let matchedContent = ''

        // Search in title (highest weight)
        if (page.title.toLowerCase().includes(this.searchQuery)) {
          score += 10
          matchedContent = page.title
        }

        // Search in description (medium weight)
        if (page.description.toLowerCase().includes(this.searchQuery)) {
          score += 5
          if (!matchedContent) matchedContent = page.description
        }

        // Search in tags (medium weight)
        const matchingTags = page.tags.filter(tag => 
          tag.toLowerCase().includes(this.searchQuery)
        )
        if (matchingTags.length > 0) {
          score += 3 * matchingTags.length
          if (!matchedContent) matchedContent = `Tags: ${matchingTags.join(', ')}`
        }

        // Search in category (low weight)
        if (page.category.toLowerCase().includes(this.searchQuery)) {
          score += 2
          if (!matchedContent) matchedContent = page.category
        }

        if (score > 0) {
          results.push({
            page,
            score,
            matchedContent
          })
        }
      })

      // Sort by score (descending)
      results.sort((a, b) => b.score - a.score)

      this.searchResults = results
      return results
    },

    // Clear search results
    clearSearch() {
      this.searchResults = []
      this.searchQuery = ''
    },

    // Get page by ID
    getPageById(id: string): DocumentationPage | undefined {
      return this.pages.find(page => page.id === id)
    },

    // Get page by path
    getPageByPath(path: string): DocumentationPage | undefined {
      return this.pages.find(page => page.path === path)
    },

    // Get section by ID
    getSectionById(id: string): DocumentationSection | undefined {
      return this.sections.find(section => section.id === id)
    },

    // Update page content (admin only)
    async updatePageContent(pageId: string, content: string) {


      const page = this.getPageById(pageId)
      if (!page) {
        throw new Error(`Page with ID ${pageId} not found`)
      }

      try {
        // In a real implementation, this would make an API call to update the content
        page.content = content
        page.lastUpdated = new Date().toISOString().split('T')[0]
        
        return { success: true, message: 'Page content updated successfully' }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new Error(`Failed to update page content: ${errorMessage}`)
      }
    },

    // Add new documentation page (admin only)
    async addPage(newPage: Omit<DocumentationPage, 'id' | 'lastUpdated'>) {


      try {
        const page: DocumentationPage = {
          ...newPage,
          id: `${newPage.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          lastUpdated: new Date().toISOString().split('T')[0]
        }

        this.pages.push(page)
        
        // Update sections if needed
        const section = this.sections.find(s => 
          s.pages.some(p => p.category === page.category)
        )
        if (section) {
          section.pages.push(page)
        }

        return { success: true, page, message: 'Page added successfully' }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new Error(`Failed to add page: ${errorMessage}`)
      }
    },

    // Remove documentation page (no admin check)
    async removePage(pageId: string) {
      try {
        const pageIndex = this.pages.findIndex(page => page.id === pageId)
        if (pageIndex === -1) {
          throw new Error(`Page with ID ${pageId} not found`)
        }
        this.pages.splice(pageIndex, 1)
        // Remove from sections
        this.sections.forEach(section => {
          const sectionPageIndex = section.pages.findIndex(p => p.id === pageId)
          if (sectionPageIndex !== -1) {
            section.pages.splice(sectionPageIndex, 1)
          }
        })
        return { success: true, message: 'Page removed successfully' }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new Error(`Failed to remove page: ${errorMessage}`)
      }
    },

    // Clear all data
    clearData() {
      this.pages = []
      this.sections = []
      this.searchResults = []
      this.searchQuery = ''
      this.error = null
    }
  }
})
