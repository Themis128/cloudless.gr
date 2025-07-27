import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Define the translation messages
const messages = {
  en: {
    bots: {
      create: 'Create Bot',
      manage: 'Manage Bots',
      test: 'Test Bot',
      delete: 'Delete Bot',
      edit: 'Edit Bot',
      view: 'View Details',
      status: {
        active: 'Active',
        inactive: 'Inactive',
        training: 'Training'
      },
      actions: {
        create: 'Create New Bot',
        test: 'Test Bot',
        manage: 'Manage Bots',
        export: 'Export Data',
        import: 'Import Bot'
      },
      messages: {
        noBots: 'No bots yet',
        createFirst: 'Create your first bot to get started',
        loading: 'Loading bots...',
        error: 'Failed to load bots',
        retry: 'Retry',
        deleteConfirm: 'Are you sure you want to delete this bot?',
        created: 'Bot created successfully',
        updated: 'Bot updated successfully',
        deleted: 'Bot deleted successfully'
      },
      stats: {
        total: 'Total Bots',
        active: 'Active Bots',
        training: 'In Training'
      },
      sidebar: {
        quickActions: 'Quick Actions',
        botStatus: 'Bot Status',
        recentActivity: 'Recent Activity',
        helpResources: 'Help & Resources'
      }
    },
    models: {
      create: 'Create Model',
      manage: 'Manage Models',
      train: 'Train Model',
      delete: 'Delete Model',
      edit: 'Edit Model',
      view: 'View Details',
      status: {
        active: 'Active',
        inactive: 'Inactive',
        training: 'Training',
        deployed: 'Deployed'
      },
      actions: {
        create: 'Create New Model',
        train: 'Train Model',
        manage: 'Manage Models',
        export: 'Export Model',
        import: 'Import Model'
      },
      messages: {
        noModels: 'No models yet',
        createFirst: 'Create your first model to get started',
        loading: 'Loading models...',
        error: 'Failed to load models',
        retry: 'Retry',
        deleteConfirm: 'Are you sure you want to delete this model?',
        created: 'Model created successfully',
        updated: 'Model updated successfully',
        deleted: 'Model deleted successfully'
      }
    },
    pipelines: {
      create: 'Create Pipeline',
      manage: 'Manage Pipelines',
      execute: 'Execute Pipeline',
      delete: 'Delete Pipeline',
      edit: 'Edit Pipeline',
      view: 'View Details',
      status: {
        active: 'Active',
        inactive: 'Inactive',
        running: 'Running',
        completed: 'Completed',
        failed: 'Failed'
      },
      actions: {
        create: 'Create New Pipeline',
        execute: 'Execute Pipeline',
        manage: 'Manage Pipelines',
        export: 'Export Pipeline',
        import: 'Import Pipeline'
      },
      messages: {
        noPipelines: 'No pipelines yet',
        createFirst: 'Create your first pipeline to get started',
        loading: 'Loading pipelines...',
        error: 'Failed to load pipelines',
        retry: 'Retry',
        deleteConfirm: 'Are you sure you want to delete this pipeline?',
        created: 'Pipeline created successfully',
        updated: 'Pipeline updated successfully',
        deleted: 'Pipeline deleted successfully'
      }
    },
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      view: 'View',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      close: 'Close',
      search: 'Search',
      confirm: 'Confirm',
      yes: 'Yes',
      no: 'No',
      ok: 'OK',
      retry: 'Retry',
      refresh: 'Refresh',
      export: 'Export',
      import: 'Import',
      download: 'Download',
      upload: 'Upload',
      settings: 'Settings',
      profile: 'Profile',
      logout: 'Logout',
      login: 'Login',
      register: 'Register',
      dashboard: 'Dashboard',
      analytics: 'Analytics',
      reports: 'Reports',
      help: 'Help',
      support: 'Support',
      documentation: 'Documentation'
    },
    navigation: {
      home: 'Home',
      bots: 'Bots',
      models: 'Models',
      pipelines: 'Pipelines',
      analytics: 'Analytics',
      settings: 'Settings',
      admin: 'Admin',
      profile: 'Profile',
      logout: 'Logout'
    },
    auth: {
      login: 'Login',
      register: 'Register',
      logout: 'Logout',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      name: 'Name',
      forgotPassword: 'Forgot Password?',
      resetPassword: 'Reset Password',
      loginSuccess: 'Login successful',
      registerSuccess: 'Registration successful',
      logoutSuccess: 'Logout successful',
      invalidCredentials: 'Invalid credentials',
      emailRequired: 'Email is required',
      passwordRequired: 'Password is required',
      passwordMismatch: 'Passwords do not match',
      nameRequired: 'Name is required'
    }
  },
  es: {
    bots: {
      create: 'Crear Bot',
      manage: 'Gestionar Bots',
      test: 'Probar Bot',
      delete: 'Eliminar Bot',
      edit: 'Editar Bot',
      view: 'Ver Detalles',
      status: {
        active: 'Activo',
        inactive: 'Inactivo',
        training: 'Entrenando'
      },
      actions: {
        create: 'Crear Nuevo Bot',
        test: 'Probar Bot',
        manage: 'Gestionar Bots',
        export: 'Exportar Datos',
        import: 'Importar Bot'
      },
      messages: {
        noBots: 'Aún no hay bots',
        createFirst: 'Crea tu primer bot para comenzar',
        loading: 'Cargando bots...',
        error: 'Error al cargar bots',
        retry: 'Reintentar',
        deleteConfirm: '¿Estás seguro de que quieres eliminar este bot?',
        created: 'Bot creado exitosamente',
        updated: 'Bot actualizado exitosamente',
        deleted: 'Bot eliminado exitosamente'
      },
      stats: {
        total: 'Total de Bots',
        active: 'Bots Activos',
        training: 'En Entrenamiento'
      },
      sidebar: {
        quickActions: 'Acciones Rápidas',
        botStatus: 'Estado del Bot',
        recentActivity: 'Actividad Reciente',
        helpResources: 'Ayuda y Recursos'
      }
    },
    models: {
      create: 'Crear Modelo',
      manage: 'Gestionar Modelos',
      train: 'Entrenar Modelo',
      delete: 'Eliminar Modelo',
      edit: 'Editar Modelo',
      view: 'Ver Detalles',
      status: {
        active: 'Activo',
        inactive: 'Inactivo',
        training: 'Entrenando',
        deployed: 'Desplegado'
      },
      actions: {
        create: 'Crear Nuevo Modelo',
        train: 'Entrenar Modelo',
        manage: 'Gestionar Modelos',
        export: 'Exportar Modelo',
        import: 'Importar Modelo'
      },
      messages: {
        noModels: 'Aún no hay modelos',
        createFirst: 'Crea tu primer modelo para comenzar',
        loading: 'Cargando modelos...',
        error: 'Error al cargar modelos',
        retry: 'Reintentar',
        deleteConfirm: '¿Estás seguro de que quieres eliminar este modelo?',
        created: 'Modelo creado exitosamente',
        updated: 'Modelo actualizado exitosamente',
        deleted: 'Modelo eliminado exitosamente'
      }
    },
    pipelines: {
      create: 'Crear Pipeline',
      manage: 'Gestionar Pipelines',
      execute: 'Ejecutar Pipeline',
      delete: 'Eliminar Pipeline',
      edit: 'Editar Pipeline',
      view: 'Ver Detalles',
      status: {
        active: 'Activo',
        inactive: 'Inactivo',
        running: 'Ejecutando',
        completed: 'Completado',
        failed: 'Fallido'
      },
      actions: {
        create: 'Crear Nuevo Pipeline',
        execute: 'Ejecutar Pipeline',
        manage: 'Gestionar Pipelines',
        export: 'Exportar Pipeline',
        import: 'Importar Pipeline'
      },
      messages: {
        noPipelines: 'Aún no hay pipelines',
        createFirst: 'Crea tu primer pipeline para comenzar',
        loading: 'Cargando pipelines...',
        error: 'Error al cargar pipelines',
        retry: 'Reintentar',
        deleteConfirm: '¿Estás seguro de que quieres eliminar este pipeline?',
        created: 'Pipeline creado exitosamente',
        updated: 'Pipeline actualizado exitosamente',
        deleted: 'Pipeline eliminado exitosamente'
      }
    },
    common: {
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      view: 'Ver',
      back: 'Atrás',
      next: 'Siguiente',
      previous: 'Anterior',
      close: 'Cerrar',
      search: 'Buscar',
      confirm: 'Confirmar',
      yes: 'Sí',
      no: 'No',
      ok: 'OK',
      retry: 'Reintentar',
      refresh: 'Actualizar',
      export: 'Exportar',
      import: 'Importar',
      download: 'Descargar',
      upload: 'Subir',
      settings: 'Configuración',
      profile: 'Perfil',
      logout: 'Cerrar Sesión',
      login: 'Iniciar Sesión',
      register: 'Registrarse',
      dashboard: 'Panel de Control',
      analytics: 'Analíticas',
      reports: 'Reportes',
      help: 'Ayuda',
      support: 'Soporte',
      documentation: 'Documentación'
    },
    navigation: {
      home: 'Inicio',
      bots: 'Bots',
      models: 'Modelos',
      pipelines: 'Pipelines',
      analytics: 'Analíticas',
      settings: 'Configuración',
      admin: 'Administración',
      profile: 'Perfil',
      logout: 'Cerrar Sesión'
    },
    auth: {
      login: 'Iniciar Sesión',
      register: 'Registrarse',
      logout: 'Cerrar Sesión',
      email: 'Correo Electrónico',
      password: 'Contraseña',
      confirmPassword: 'Confirmar Contraseña',
      name: 'Nombre',
      forgotPassword: '¿Olvidaste tu contraseña?',
      resetPassword: 'Restablecer Contraseña',
      loginSuccess: 'Inicio de sesión exitoso',
      registerSuccess: 'Registro exitoso',
      logoutSuccess: 'Cierre de sesión exitoso',
      invalidCredentials: 'Credenciales inválidas',
      emailRequired: 'El correo electrónico es requerido',
      passwordRequired: 'La contraseña es requerida',
      passwordMismatch: 'Las contraseñas no coinciden',
      nameRequired: 'El nombre es requerido'
    }
  },
  fr: {
    bots: {
      create: 'Créer un Bot',
      manage: 'Gérer les Bots',
      test: 'Tester le Bot',
      delete: 'Supprimer le Bot',
      edit: 'Modifier le Bot',
      view: 'Voir les Détails',
      status: {
        active: 'Actif',
        inactive: 'Inactif',
        training: 'En Formation'
      },
      actions: {
        create: 'Créer un Nouveau Bot',
        test: 'Tester le Bot',
        manage: 'Gérer les Bots',
        export: 'Exporter les Données',
        import: 'Importer le Bot'
      },
      messages: {
        noBots: 'Aucun bot pour le moment',
        createFirst: 'Créez votre premier bot pour commencer',
        loading: 'Chargement des bots...',
        error: 'Échec du chargement des bots',
        retry: 'Réessayer',
        deleteConfirm: 'Êtes-vous sûr de vouloir supprimer ce bot?',
        created: 'Bot créé avec succès',
        updated: 'Bot mis à jour avec succès',
        deleted: 'Bot supprimé avec succès'
      },
      stats: {
        total: 'Total des Bots',
        active: 'Bots Actifs',
        training: 'En Formation'
      },
      sidebar: {
        quickActions: 'Actions Rapides',
        botStatus: 'Statut du Bot',
        recentActivity: 'Activité Récente',
        helpResources: 'Aide et Ressources'
      }
    },
    models: {
      create: 'Créer un Modèle',
      manage: 'Gérer les Modèles',
      train: 'Former le Modèle',
      delete: 'Supprimer le Modèle',
      edit: 'Modifier le Modèle',
      view: 'Voir les Détails',
      status: {
        active: 'Actif',
        inactive: 'Inactif',
        training: 'En Formation',
        deployed: 'Déployé'
      },
      actions: {
        create: 'Créer un Nouveau Modèle',
        train: 'Former le Modèle',
        manage: 'Gérer les Modèles',
        export: 'Exporter le Modèle',
        import: 'Importer le Modèle'
      },
      messages: {
        noModels: 'Aucun modèle pour le moment',
        createFirst: 'Créez votre premier modèle pour commencer',
        loading: 'Chargement des modèles...',
        error: 'Échec du chargement des modèles',
        retry: 'Réessayer',
        deleteConfirm: 'Êtes-vous sûr de vouloir supprimer ce modèle?',
        created: 'Modèle créé avec succès',
        updated: 'Modèle mis à jour avec succès',
        deleted: 'Modèle supprimé avec succès'
      }
    },
    pipelines: {
      create: 'Créer un Pipeline',
      manage: 'Gérer les Pipelines',
      execute: 'Exécuter le Pipeline',
      delete: 'Supprimer le Pipeline',
      edit: 'Modifier le Pipeline',
      view: 'Voir les Détails',
      status: {
        active: 'Actif',
        inactive: 'Inactif',
        running: 'En Cours',
        completed: 'Terminé',
        failed: 'Échoué'
      },
      actions: {
        create: 'Créer un Nouveau Pipeline',
        execute: 'Exécuter le Pipeline',
        manage: 'Gérer les Pipelines',
        export: 'Exporter le Pipeline',
        import: 'Importer le Pipeline'
      },
      messages: {
        noPipelines: 'Aucun pipeline pour le moment',
        createFirst: 'Créez votre premier pipeline pour commencer',
        loading: 'Chargement des pipelines...',
        error: 'Échec du chargement des pipelines',
        retry: 'Réessayer',
        deleteConfirm: 'Êtes-vous sûr de vouloir supprimer ce pipeline?',
        created: 'Pipeline créé avec succès',
        updated: 'Pipeline mis à jour avec succès',
        deleted: 'Pipeline supprimé avec succès'
      }
    },
    common: {
      loading: 'Chargement...',
      error: 'Erreur',
      success: 'Succès',
      cancel: 'Annuler',
      save: 'Enregistrer',
      delete: 'Supprimer',
      edit: 'Modifier',
      view: 'Voir',
      back: 'Retour',
      next: 'Suivant',
      previous: 'Précédent',
      close: 'Fermer',
      search: 'Rechercher',
      confirm: 'Confirmer',
      yes: 'Oui',
      no: 'Non',
      ok: 'OK',
      retry: 'Réessayer',
      refresh: 'Actualiser',
      export: 'Exporter',
      import: 'Importer',
      download: 'Télécharger',
      upload: 'Téléverser',
      settings: 'Paramètres',
      profile: 'Profil',
      logout: 'Déconnexion',
      login: 'Connexion',
      register: 'S\'inscrire',
      dashboard: 'Tableau de Bord',
      analytics: 'Analyses',
      reports: 'Rapports',
      help: 'Aide',
      support: 'Support',
      documentation: 'Documentation'
    },
    navigation: {
      home: 'Accueil',
      bots: 'Bots',
      models: 'Modèles',
      pipelines: 'Pipelines',
      analytics: 'Analyses',
      settings: 'Paramètres',
      admin: 'Administration',
      profile: 'Profil',
      logout: 'Déconnexion'
    },
    auth: {
      login: 'Connexion',
      register: 'S\'inscrire',
      logout: 'Déconnexion',
      email: 'E-mail',
      password: 'Mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      name: 'Nom',
      forgotPassword: 'Mot de passe oublié?',
      resetPassword: 'Réinitialiser le mot de passe',
      loginSuccess: 'Connexion réussie',
      registerSuccess: 'Inscription réussie',
      logoutSuccess: 'Déconnexion réussie',
      invalidCredentials: 'Identifiants invalides',
      emailRequired: 'L\'e-mail est requis',
      passwordRequired: 'Le mot de passe est requis',
      passwordMismatch: 'Les mots de passe ne correspondent pas',
      nameRequired: 'Le nom est requis'
    }
  }
}

export const useI18nStore = defineStore('i18n', () => {
  // State
  const currentLocale = ref('en')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const currentMessages = computed(() => messages[currentLocale.value] || messages.en)
  const availableLocales = computed(() => Object.keys(messages))
  const localeNames = computed(() => ({
    en: 'English',
    es: 'Español',
    fr: 'Français'
  }))

  // Translation function
  const t = (key: string) => {
    try {
      const keys = key.split('.')
      let value = currentMessages.value
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k]
        } else {
          console.warn(`Translation key not found: ${key}`)
          return key
        }
      }
      
      return typeof value === 'string' ? value : key
    } catch (err) {
      console.error('Translation error:', err)
      return key
    }
  }

  // Switch language
  const switchLanguage = (code: string) => {
    if (availableLocales.value.includes(code)) {
      currentLocale.value = code
      
      // Store in localStorage
      if (process.client) {
        localStorage.setItem('locale', code)
      }
      
      // Update document language
      if (process.client) {
        document.documentElement.lang = code
      }
    } else {
      console.warn(`Unsupported locale: ${code}`)
    }
  }

  // Initialize locale from localStorage or browser
  const initializeLocale = () => {
    if (process.client) {
      // Try to get from localStorage first
      const storedLocale = localStorage.getItem('locale')
      if (storedLocale && availableLocales.value.includes(storedLocale)) {
        currentLocale.value = storedLocale
      } else {
        // Try to get from browser
        const browserLocale = navigator.language.split('-')[0]
        if (availableLocales.value.includes(browserLocale)) {
          currentLocale.value = browserLocale
        }
      }
      
      // Update document language
      document.documentElement.lang = currentLocale.value
    }
  }

  // Set loading state
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  // Set error state
  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
  }

  // Clear error
  const clearError = () => {
    error.value = null
  }

  // Get locale name
  const getLocaleName = (code: string) => {
    return localeNames.value[code] || code
  }

  // Format date according to locale
  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString(currentLocale.value, options)
  }

  // Format number according to locale
  const formatNumber = (number: number, options?: Intl.NumberFormatOptions) => {
    return number.toLocaleString(currentLocale.value, options)
  }

  // Format currency according to locale
  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat(currentLocale.value, {
      style: 'currency',
      currency
    }).format(amount)
  }

  return {
    // State
    currentLocale,
    isLoading,
    error,
    
    // Computed
    currentMessages,
    availableLocales,
    localeNames,
    
    // Methods
    t,
    switchLanguage,
    initializeLocale,
    setLoading,
    setError,
    clearError,
    getLocaleName,
    formatDate,
    formatNumber,
    formatCurrency
  }
}) 