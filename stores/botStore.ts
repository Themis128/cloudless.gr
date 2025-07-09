import { defineStore } from 'pinia'

export const useBotStore = defineStore('bot', {
  state: () => ({
    bots: [] as string[],
    currentBot: null as string | null
  }),
  actions: {
    selectBot(name: string) {
      this.currentBot = name
    },
    addBot(name: string) {
      this.bots.push(name)
    }
  }
})
