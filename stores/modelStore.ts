import { defineStore } from 'pinia'

export const useModelStore = defineStore('model', {
  state: () => ({
    models: [] as string[],
    activeModel: '' as string,
    status: '' as 'idle' | 'training' | 'deployed'
  }),
  actions: {
    setActive(model: string) {
      this.activeModel = model
    },
    updateStatus(newStatus: 'idle' | 'training' | 'deployed') {
      this.status = newStatus
    }
  }
})
