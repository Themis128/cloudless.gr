// composables/useWizardSteps.ts
export const useWizardSteps = () => {
  const steps = [
    { title: 'Project', path: '/projects/create' },
    { title: 'Bot', path: '/bots/builder' },
    { title: 'Model', path: '/models/create' },
    { title: 'Pipeline', path: '/pipelines/create' },
    { title: 'Train', path: '/llm/train' },
    { title: 'Deploy', path: '/models/deploy' },
    { title: 'Debug', path: '/dashboard' }
  ]

  return {
    steps
  }
}
