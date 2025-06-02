import { computed, ref } from '#imports';
import { defineStore } from 'pinia';
import { useAgents } from '~/composables/useAgents';
import { useToast } from '~/composables/useToast';
import type { Agent } from '../types/agents';

export const useAgentStore = defineStore('agent', () => {
  const agent_list = ref<Agent[]>([]);
  const active_agent = ref<Agent | null>(null);
  const search_query = ref('');
  const { fetchAgents, getAgent } = useAgents();
  const toast = useToast();

  const loadAgents = async () => {
    try {
      agent_list.value = await fetchAgents();
    } catch {
      toast.toast({ type: 'error', description: 'Failed to load agents' });
      agent_list.value = [];
    }
  };

  const setActiveAgent = async (id: string) => {
    try {
      active_agent.value = await getAgent(id);
    } catch {
      toast.toast({ type: 'error', description: 'Failed to fetch agent' });
      active_agent.value = null;
    }
  };

  const filtered_agents = computed(() =>
    agent_list.value.filter((agent: Agent) =>
      agent.name.toLowerCase().includes(search_query.value.toLowerCase())
    )
  );

  return {
    agent_list,
    active_agent,
    loadAgents,
    setActiveAgent,
    search_query,
    filtered_agents,
  };
});
