// composables/useWizardSteps.ts
export const useWizardSteps = () => {
  const steps = [
    {
      title: 'Project',
      subtitle: 'Start a project and group resources',
      path: '/projects/create',
      description: `<strong>Step 1: Create a Project</strong><br>Projects help you organize and group related resources.<br><ul><li>Enter a project name and description.</li><li>Optionally, set project settings or permissions.</li><li>Click <b>Create Project</b> to continue.</li></ul>`
    },
    {
      title: 'Bot',
      subtitle: 'Add bots to interact or automate',
      path: '/bots/builder',
      description: `<strong>Step 2: Add a Bot</strong><br>Bots allow you to interact with users or automate tasks within your project.<br><ul><li>Click <b>Add Bot</b> to create a new bot.</li><li>Configure the bot’s name, type, and settings.</li><li>Bots can be connected to models and pipelines for advanced automation.</li></ul>`
    },
    {
      title: 'Model',
      subtitle: 'Add models to enable AI',
      path: '/models/create',
      description: `<strong>Step 3: Add a Model</strong><br>Models provide AI capabilities for your bots and pipelines.<br><ul><li>Click <b>Add Model</b> to create or import a model.</li><li>Choose the model type and configure its parameters.</li><li>Models can be trained and linked to bots or pipelines.</li></ul>`
    },
    {
      title: 'Pipeline',
      subtitle: 'Build pipelines to automate flows',
      path: '/pipelines/create',
      description: `<strong>Step 4: Build a Pipeline</strong><br>Pipelines automate workflows by connecting bots, models, and other resources.<br><ul><li>Click <b>Create Pipeline</b> to start a new automation flow.</li><li>Define the steps and logic for your pipeline.</li><li>Pipelines can trigger bots, models, or external actions.</li></ul>`
    },
    {
      title: 'Train',
      subtitle: 'Train your models or LLMs',
      path: '/models/train',
      description: `<strong>Step 5: Train Models</strong><br>Training improves your models’ performance and accuracy.<br><ul><li>Click <b>Train Model</b> to start a training session.</li><li>Upload data and configure training parameters.</li><li>Monitor progress and review results after training completes.</li></ul>`
    },
    {
      title: 'Deploy',
      subtitle: 'Deploy models as APIs or endpoints',
      path: '/models/deploy',
      description: `<strong>Step 6: Deploy Models</strong><br>Deploy your trained models as APIs or endpoints for use in production.<br><ul><li>Click <b>Deploy Model</b> to publish your model.</li><li>Configure endpoint settings and access controls.</li><li>Deployed models can be integrated with bots, pipelines, or external apps.</li></ul>`
    },
    {
      title: 'Analytics & Debug',
      subtitle: 'Monitor, analyze, and debug your project',
      path: '/dashboard',
      description: `<strong>Step 7: Analytics & Debug</strong><br>Monitor your project’s performance, analyze usage, and debug issues.<br><ul><li>View analytics dashboards for insights.</li><li>Access logs and debug tools to troubleshoot problems.</li><li>Continuously improve your project based on analytics and feedback.</li></ul>`
    },
    {
      title: 'Bot',
      subtitle: 'Add bots to interact or automate',
      path: '/bots/builder',
      description: `<strong>Step: Add a Bot</strong><br>Bots allow you to interact with users or automate tasks within your project.<br><ul><li>Click <b>Add Bot</b> to create a new bot.</li><li>Configure the bot’s name, type, and settings.</li><li>Bots can be connected to models and pipelines for advanced automation.</li></ul>`
    },
    {
      title: 'Model',
      subtitle: 'Add models to enable AI',
      path: '/models/create',
      description: `<strong>Step: Add a Model</strong><br>Models provide AI capabilities for your bots and pipelines.<br><ul><li>Click <b>Add Model</b> to create or import a model.</li><li>Choose the model type and configure its parameters.</li><li>Models can be trained and linked to bots or pipelines.</li></ul>`
    },
    {
      title: 'Pipeline',
      subtitle: 'Build pipelines to automate flows',
      path: '/pipelines/create',
      description: `<strong>Step: Build a Pipeline</strong><br>Pipelines automate workflows by connecting bots, models, and other resources.<br><ul><li>Click <b>Create Pipeline</b> to start a new automation flow.</li><li>Define the steps and logic for your pipeline.</li><li>Pipelines can trigger bots, models, or external actions.</li></ul>`
    },
    {
      title: 'Train',
      subtitle: 'Train your models or LLMs',
      path: '/models/train'
    },
    {
      title: 'Deploy',
      subtitle: 'Deploy models as APIs or endpoints',
      path: '/models/deploy'
    },
    {
      title: 'Analytics & Debug',
      subtitle: 'Monitor, analyze, and debug your project',
      path: '/dashboard'
    }
  ]

  return {
    steps
  }
}
