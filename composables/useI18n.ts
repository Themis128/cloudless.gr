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
      search: 'Search'
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
      search: 'Buscar'
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
        import: 'Importer un Bot'
      },
      messages: {
        noBots: 'Aucun bot pour le moment',
        createFirst: 'Créez votre premier bot pour commencer',
        loading: 'Chargement des bots...',
        error: 'Échec du chargement des bots',
        retry: 'Réessayer',
        deleteConfirm: 'Êtes-vous sûr de vouloir supprimer ce bot ?',
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
      search: 'Rechercher'
    }
  }
}

// Available locales
const availableLocales = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' }
]

// Current locale
const currentLocale = ref('en')

// Load saved locale from localStorage
if (process.client) {
  const savedLocale = localStorage.getItem('locale')
  if (savedLocale && messages[savedLocale as keyof typeof messages]) {
    currentLocale.value = savedLocale
  }
}

export const useI18n = () => {
  // Get translation function
  const t = (key: string) => {
    const keys = key.split('.')
    let value: any = messages[currentLocale.value as keyof typeof messages]
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return key // Return key if translation not found
      }
    }
    
    return value || key
  }

  // Switch language
  const switchLanguage = (code: string) => {
    if (messages[code as keyof typeof messages]) {
      currentLocale.value = code
      if (process.client) {
        localStorage.setItem('locale', code)
      }
    }
  }

  // Get current locale
  const locale = computed(() => currentLocale.value)

  // Get available locales
  const locales = computed(() => availableLocales)

  return {
    t,
    locale,
    locales,
    switchLanguage,
    availableLocales
  }
} 