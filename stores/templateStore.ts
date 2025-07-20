import { defineStore } from 'pinia'

export const useTemplateStore = defineStore('template', {
  state: () => ({
    templates: [] as Array<{ name: string; content: string }>,
    selectedTemplate: null as string | null,
  }),
  actions: {
    selectTemplate(name: string) {
      this.selectedTemplate = name
    },
    addTemplate(name: string, content: string) {
      this.templates.push({ name, content })
    },
  },
})
