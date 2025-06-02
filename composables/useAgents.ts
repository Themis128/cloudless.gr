// composables/useAgents.ts

export const useAgents = () => {
  const fetchAgents = async () => await $fetch('/api/agents')
  const getAgent = async (id: string) => await $fetch(`/api/agents/${id}`)
  const saveAgent = async (agent: any) => await $fetch('/api/agents', { method: 'POST', body: agent })
  const updateAgent = async (id: string, agent: any) => await $fetch(`/api/agents/${id}`, { method: 'PUT', body: agent })

  return { fetchAgents, getAgent, saveAgent, updateAgent }
}
