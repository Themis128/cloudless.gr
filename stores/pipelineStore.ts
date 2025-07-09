import { defineStore } from 'pinia'

export const usePipelineStore = defineStore('pipeline', {
  state: () => ({
    steps: [] as string[],
    currentStep: 0,
    errors: [] as string[]
  }),
  actions: {
    nextStep() {
      if (this.currentStep < this.steps.length - 1) this.currentStep++
    },
    logError(error: string) {
      this.errors.push(error)
    },
    initPipeline(steps: string[]) {
      this.steps = steps
      this.currentStep = 0
      this.errors = []
    }
  }
})
