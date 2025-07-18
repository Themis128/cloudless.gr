// composables/useWizardSteps.ts
export const useWizardSteps = () => {
  const steps = [
    {
      title: 'Pipeline Details',
      subtitle: 'Set basic pipeline information',
      path: '/pipelines/create',
      description: `<strong>Step 1: Pipeline Details</strong><br>Set up your pipeline's basic information.<br><ul><li>Enter a descriptive name for your pipeline</li><li>Add a description to help team members understand its purpose</li><li>Configure basic pipeline settings</li></ul>`
    },
    {
      title: 'Model Selection',
      subtitle: 'Choose models for your pipeline',
      path: '/pipelines/create',
      description: `<strong>Step 2: Model Selection</strong><br>Select the AI models to use in your pipeline.<br><ul><li>Choose from available trained models</li><li>Configure model-specific parameters</li><li>Set up model input/output mappings</li></ul>`
    },
    {
      title: 'Pipeline Config',
      subtitle: 'Configure pipeline steps and logic',
      path: '/pipelines/create',
      description: `<strong>Step 3: Pipeline Configuration</strong><br>Define your pipeline's processing steps and logic.<br><ul><li>Add and order processing steps</li><li>Configure step parameters and connections</li><li>Set up error handling and retries</li></ul>`
    },
    {
      title: 'Review',
      subtitle: 'Review and validate pipeline',
      path: '/pipelines/create',
      description: `<strong>Step 4: Review & Validate</strong><br>Review your pipeline configuration before creation.<br><ul><li>Verify all settings and connections</li><li>Check for potential issues or optimizations</li><li>Confirm pipeline structure and flow</li></ul>`
    }
  ]

  return {
    steps
  }
}
