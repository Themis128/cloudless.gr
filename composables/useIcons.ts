/**
 * Icon Management Composable
 * Centralized icon configuration and utilities following best practices
 */

export const useIcons = () => {
  // Project type icons mapping
  const projectTypeIcons = {
    // Frontend Frameworks
    react: 'mdi-react',
    vue: 'mdi-vuejs',
    angular: 'mdi-angular',
    nuxt: 'mdi-nuxt',
    svelte: 'mdi-fire',
    
    // Backend Technologies
    nodejs: 'mdi-nodejs',
    python: 'mdi-language-python',
    java: 'mdi-language-java',
    go: 'mdi-language-go',
    rust: 'mdi-language-rust',
    php: 'mdi-language-php',
    
    // Databases
    mongodb: 'mdi-leaf',
    postgresql: 'mdi-elephant',
    mysql: 'mdi-database',
    redis: 'mdi-database-outline',
    firebase: 'mdi-firebase',
    supabase: 'mdi-database-lightning',
    
    // DevOps & Infrastructure
    docker: 'mdi-docker',
    kubernetes: 'mdi-kubernetes',
    aws: 'mdi-aws',
    azure: 'mdi-microsoft-azure',
    gcp: 'mdi-google-cloud',
    terraform: 'mdi-terraform',
    
    // AI/ML
    tensorflow: 'mdi-brain',
    pytorch: 'mdi-robot',
    jupyter: 'mdi-notebook',
    'machine-learning': 'mdi-brain',
    'deep-learning': 'mdi-robot-outline',
    
    // General
    api: 'mdi-api',
    microservice: 'mdi-hexagon-multiple',
    fullstack: 'mdi-layers',
    mobile: 'mdi-cellphone',
    desktop: 'mdi-desktop-classic',
    web: 'mdi-web',
    
    // File Types
    json: 'mdi-code-json',
    yaml: 'mdi-file-code',
    xml: 'mdi-xml',
    csv: 'mdi-file-delimited',
    sql: 'mdi-database-search',
    markdown: 'mdi-language-markdown',
    
    // Development
    git: 'mdi-git',
    github: 'mdi-github',
    gitlab: 'mdi-gitlab',
    vscode: 'mdi-microsoft-visual-studio-code',
    npm: 'mdi-npm',
    webpack: 'mdi-webpack',
    vite: 'mdi-lightning-bolt',
  }

  // Status icons for projects
  const statusIcons = {
    draft: 'mdi-file-document-edit-outline',
    active: 'mdi-play-circle',
    paused: 'mdi-pause-circle',
    completed: 'mdi-check-circle',
    error: 'mdi-alert-circle',
    archived: 'mdi-archive',
    deployed: 'mdi-rocket',
    training: 'mdi-brain',
    testing: 'mdi-test-tube',
    building: 'mdi-hammer-wrench',
  }

  // Action icons
  const actionIcons = {
    create: 'mdi-plus-circle',
    edit: 'mdi-pencil',
    delete: 'mdi-trash-can',
    view: 'mdi-eye',
    download: 'mdi-download',
    upload: 'mdi-upload',
    share: 'mdi-share-variant',
    copy: 'mdi-content-copy',
    save: 'mdi-content-save',
    refresh: 'mdi-refresh',
    search: 'mdi-magnify',
    filter: 'mdi-filter',
    sort: 'mdi-sort',
    expand: 'mdi-chevron-down',
    collapse: 'mdi-chevron-up',
    menu: 'mdi-menu',
    close: 'mdi-close',
    settings: 'mdi-cog',
    info: 'mdi-information',
    help: 'mdi-help-circle',
  }

  // Navigation icons
  const navigationIcons = {
    home: 'mdi-home',
    dashboard: 'mdi-view-dashboard',
    projects: 'mdi-folder-multiple',
    analytics: 'mdi-chart-line',
    settings: 'mdi-cog',
    profile: 'mdi-account',
    team: 'mdi-account-group',
    notifications: 'mdi-bell',
    messages: 'mdi-message',
    calendar: 'mdi-calendar',
    tasks: 'mdi-clipboard-list',
    files: 'mdi-file-document-multiple',
  }
  // Get icon by type and key
  const getIcon = (type: 'project' | 'status' | 'action' | 'navigation', key: string): string => {
    const iconMaps = {
      project: projectTypeIcons,
      status: statusIcons,
      action: actionIcons,
      navigation: navigationIcons,
    }
    
    const iconMap = iconMaps[type]
    return (iconMap as Record<string, string>)[key] ?? 'mdi-help-circle'
  }

  // Get icon color based on type
  const getIconColor = (type: string, status?: string): string => {
    const colorMap: Record<string, string> = {
      // Project types
      react: 'info',
      vue: 'success',
      angular: 'error',
      python: 'warning',
      nodejs: 'success',
      docker: 'info',
      kubernetes: 'primary',
      
      // Statuses
      active: 'success',
      completed: 'success',
      error: 'error',
      draft: 'grey',
      paused: 'warning',
      deployed: 'primary',
      training: 'info',
      
      // Fallback
      default: 'grey-darken-1'
    }
    
    return colorMap[type] ?? colorMap[status ?? ''] ?? colorMap.default
  }

  // Create icon component props
  const createIconProps = (iconName: string, options?: {
    size?: string | number
    color?: string
    spin?: boolean
  }) => {
    return {
      icon: iconName,
      size: options?.size ?? 'default',
      color: options?.color ?? 'current',
      class: options?.spin ? 'icon-spin' : undefined,
    }
  }

  // Project-specific helper functions
  const getProjectIcon = (type: string): string => {
    return getIcon('project', type)
  }

  const getProjectColor = (type: string): string => {
    return getIconColor(type)
  }

  const getStatusIcon = (status: string): string => {
    return getIcon('status', status)
  }

  const getStatusColor = (status: string): string => {
    return getIconColor('', status)
  }

  return {
    projectTypeIcons,
    statusIcons,
    actionIcons,
    navigationIcons,
    getIcon,
    getIconColor,
    createIconProps,
    getProjectIcon,
    getProjectColor,
    getStatusIcon,
    getStatusColor,
  }
}

// CSS for spinning icons (add to your main CSS)
export const iconStyles = `
.icon-spin {
  animation: icon-spin 2s linear infinite;
}

@keyframes icon-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`
