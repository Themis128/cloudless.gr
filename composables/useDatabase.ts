// Simple database composable to replace Supabase functionality
export const useDatabase = () => {
  // Mock data store
  const mockData = {
    bots: [
      { id: '1', name: 'Customer Support Bot', status: 'active', type: 'support' },
      { id: '2', name: 'Sales Assistant', status: 'active', type: 'sales' },
      { id: '3', name: 'Content Creator', status: 'inactive', type: 'content' }
    ],
    pipelines: [
      { id: '1', name: 'Data Processing Pipeline', status: 'active' },
      { id: '2', name: 'ML Training Pipeline', status: 'completed' }
    ],
    models: [
      { id: '1', name: 'GPT-4 Fine-tune', status: 'trained' },
      { id: '2', name: 'Custom Model', status: 'training' }
    ]
  }

  return {
    from: (table: string) => ({
      select: (columns = '*') => ({
        eq: (column: string, value: any) => ({
          single: () => Promise.resolve({
            data: mockData[table as keyof typeof mockData]?.[0] || null,
            error: null
          }),
          limit: (count: number) => Promise.resolve({
            data: mockData[table as keyof typeof mockData]?.slice(0, count) || [],
            error: null,
            count: mockData[table as keyof typeof mockData]?.length || 0
          })
        }),
        single: () => Promise.resolve({
          data: mockData[table as keyof typeof mockData]?.[0] || null,
          error: null
        }),
        then: (callback: Function) => callback({
          data: mockData[table as keyof typeof mockData] || [],
          error: null,
          count: mockData[table as keyof typeof mockData]?.length || 0
        })
      }),
      insert: (data: any) => ({
        select: () => ({
          single: () => Promise.resolve({
            data: { id: Date.now().toString(), ...data },
            error: null
          })
        })
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => Promise.resolve({
          data: { id: value, ...data },
          error: null
        })
      }),
      delete: () => ({
        eq: (column: string, value: any) => Promise.resolve({
          data: null,
          error: null
        })
      })
    }),
    auth: {
      getUser: () => Promise.resolve({
        data: { user: null },
        error: null
      }),
      getSession: () => Promise.resolve({
        data: { session: null },
        error: null
      }),
      signInWithPassword: (credentials: any) => Promise.resolve({
        data: { user: { id: '1', email: credentials.email } },
        error: null
      })
    }
  }
}