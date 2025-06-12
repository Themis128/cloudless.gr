export const copilotFunctions = [
  {
    name: 'getUserData',
    description: 'Fetches user data by ID',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
      },
      required: ['userId'],
    },
  },
  // Add more functions...
]
