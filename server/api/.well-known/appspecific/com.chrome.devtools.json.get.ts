import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return {
    name: 'Cloudless',
    description: 'AI-powered low-code platform',
    version: '1.0.0',
    type: 'web-application'
  }
}) 