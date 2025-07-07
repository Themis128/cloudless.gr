#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
// Removed unused imports
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

class NuxtDevMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'nuxt-dev-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'scaffold-nuxt-component',
            description: 'Create a new Vue component in the components directory',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Component name (e.g., "UserProfile" or "ui/Button")',
                },
                template: {
                  type: 'string',
                  enum: ['basic', 'composable', 'typescript'],
                  description: 'Component template type',
                  default: 'basic',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'scaffold-nuxt-page',
            description: 'Create a new page in the pages directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Page path (e.g., "about", "admin/users", "blog/[slug]")',
                },
                template: {
                  type: 'string',
                  enum: ['basic', 'dynamic', 'layout'],
                  description: 'Page template type',
                  default: 'basic',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'scaffold-nuxt-composable',
            description: 'Create a new composable in the composables directory',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Composable name (e.g., "useAuth", "useProjectApi")',
                },
                template: {
                  type: 'string',
                  enum: ['basic', 'reactive', 'async'],
                  description: 'Composable template type',
                  default: 'basic',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'list-nuxt-components',
            description: 'List all components in the project',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list-nuxt-pages',
            description: 'List all pages in the project',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list-nuxt-composables',
            description: 'List all composables in the project',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get-nuxt-config',
            description: 'Get current Nuxt configuration',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'analyze-project-structure',
            description: 'Analyze the current project structure and provide insights',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'scaffold-nuxt-component':
            return await this.scaffoldComponent(args.name, args.template || 'basic');
          case 'scaffold-nuxt-page':
            return await this.scaffoldPage(args.path, args.template || 'basic');
          case 'scaffold-nuxt-composable':
            return await this.scaffoldComposable(args.name, args.template || 'basic');
          case 'list-nuxt-components':
            return await this.listComponents();
          case 'list-nuxt-pages':
            return await this.listPages();
          case 'list-nuxt-composables':
            return await this.listComposables();
          case 'get-nuxt-config':
            return await this.getNuxtConfig();
          case 'analyze-project-structure':
            return await this.analyzeProjectStructure();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async scaffoldComponent(name, template) {
    const componentPath = path.join(PROJECT_ROOT, 'components', `${name}.vue`);
    const dir = path.dirname(componentPath);
    
    await fs.mkdir(dir, { recursive: true });

    const templates = {
      basic: `<template>
  <div class="${name.toLowerCase()}-component">
    <h2>{{ title }}</h2>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '${name}'
  }
})
</script>

<style scoped>
.${name.toLowerCase()}-component {
  /* Add your styles here */
}
</style>
`,
      composable: `<template>
  <div class="${name.toLowerCase()}-component">
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <slot />
  </div>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: '${name}'
  }
})

const { message } = useCustomLogic()

function useCustomLogic() {
  const message = ref('Component with composable logic')
  
  return {
    message
  }
}
</script>

<style scoped>
.${name.toLowerCase()}-component {
  /* Add your styles here */
}
</style>
`,
      typescript: `<template>
  <div class="${name.toLowerCase()}-component">
    <h2>{{ title }}</h2>
    <slot />
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '${name}'
})
</script>

<style scoped>
.${name.toLowerCase()}-component {
  /* Add your styles here */
}
</style>
`,
    };

    await fs.writeFile(componentPath, templates[template]);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created component: ${componentPath}\n\nTemplate: ${template}\n\nComponent ready to use!`,
        },
      ],
    };
  }

  async scaffoldPage(pagePath, template) {
    const fullPath = path.join(PROJECT_ROOT, 'pages', `${pagePath}.vue`);
    const dir = path.dirname(fullPath);
    
    await fs.mkdir(dir, { recursive: true });

    // Create safe CSS class name
    const cssClassName = `page-${pagePath.replace(/[/[\]]/g, '-')}`;

    const templates = {
      basic: `<template>
  <div class="${cssClassName}">
    <h1>{{ title }}</h1>
    <p>Welcome to the ${pagePath} page!</p>
  </div>
</template>

<script setup>
const title = '${pagePath.charAt(0).toUpperCase() + pagePath.slice(1)} Page'

useSeoMeta({
  title,
  description: 'Page description here'
})
</script>

<style scoped>
.${cssClassName} {
  padding: 2rem;
}
</style>
`,
      dynamic: `<template>
  <div class="${cssClassName}">
    <h1>{{ title }}</h1>
    <p v-if="pending">Loading...</p>
    <div v-else-if="error">
      <p>Error: {{ error }}</p>
    </div>
    <div v-else>
      <p>{{ data }}</p>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const title = '${pagePath.charAt(0).toUpperCase() + pagePath.slice(1)} Page'

// Example of dynamic data fetching
const { data, pending, error } = await useFetch(\`/api/\${route.params.id || 'data'}\`)

useSeoMeta({
  title,
  description: 'Dynamic page description'
})
</script>

<style scoped>
.${cssClassName} {
  padding: 2rem;
}
</style>
`,
      layout: `<template>
  <div class="${cssClassName}">
    <h1>{{ title }}</h1>
    <p>Page with custom layout</p>
  </div>
</template>

<script setup>
const title = '${pagePath.charAt(0).toUpperCase() + pagePath.slice(1)} Page'

definePageMeta({
  layout: 'custom'
})

useSeoMeta({
  title,
  description: 'Page with custom layout'
})
</script>

<style scoped>
.${cssClassName} {
  padding: 2rem;
}
</style>
`,
    };

    await fs.writeFile(fullPath, templates[template]);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created page: ${fullPath}\n\nTemplate: ${template}\n\nPage is now accessible at /${pagePath}`,
        },
      ],
    };
  }

  async scaffoldComposable(name, template) {
    const composablePath = path.join(PROJECT_ROOT, 'composables', `${name}.ts`);
    const dir = path.dirname(composablePath);
    
    await fs.mkdir(dir, { recursive: true });

    const templates = {
      basic: `export const ${name} = () => {
  const state = ref(null)
  
  const setState = (newState: any) => {
    state.value = newState
  }
  
  return {
    state: readonly(state),
    setState
  }
}
`,
      reactive: `export const ${name} = () => {
  const state = reactive({
    data: null,
    loading: false,
    error: null
  })
  
  const updateData = (newData: any) => {
    state.data = newData
    state.error = null
  }
  
  const setLoading = (loading: boolean) => {
    state.loading = loading
  }
  
  const setError = (error: any) => {
    state.error = error
    state.loading = false
  }
  
  return {
    ...toRefs(state),
    updateData,
    setLoading,
    setError
  }
}
`,
      async: `export const ${name} = () => {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)
  
  const fetchData = async (params?: any) => {
    loading.value = true
    error.value = null
    
    try {
      // Replace with your actual API call
      const response = await $fetch('/api/data', { 
        method: 'GET',
        query: params 
      })
      data.value = response
      return response
    } catch (err) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const resetData = () => {
    data.value = null
    error.value = null
    loading.value = false
  }
  
  return {
    data: readonly(data),
    loading: readonly(loading),
    error: readonly(error),
    fetchData,
    resetData
  }
}
`,
    };

    await fs.writeFile(composablePath, templates[template]);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created composable: ${composablePath}\n\nTemplate: ${template}\n\nComposable ready to use with auto-import!`,
        },
      ],
    };
  }

  async listComponents() {
    const componentsDir = path.join(PROJECT_ROOT, 'components');
    const components = await this.scanDirectory(componentsDir, '.vue');
    
    return {
      content: [
        {
          type: 'text',
          text: `📦 Components found:\n\n${components.map(c => `- ${c}`).join('\n')}`,
        },
      ],
    };
  }

  async listPages() {
    const pagesDir = path.join(PROJECT_ROOT, 'pages');
    const pages = await this.scanDirectory(pagesDir, '.vue');
    
    return {
      content: [
        {
          type: 'text',
          text: `📄 Pages found:\n\n${pages.map(p => `- ${p} → /${p.replace('.vue', '')}`).join('\n')}`,
        },
      ],
    };
  }

  async listComposables() {
    const composablesDir = path.join(PROJECT_ROOT, 'composables');
    const composables = await this.scanDirectory(composablesDir, '.ts');
    
    return {
      content: [
        {
          type: 'text',
          text: `🎯 Composables found:\n\n${composables.map(c => `- ${c}`).join('\n')}`,
        },
      ],
    };
  }

  async getNuxtConfig() {
    try {
      const configPath = path.join(PROJECT_ROOT, 'nuxt.config.ts');
      const configContent = await fs.readFile(configPath, 'utf-8');
      
      return {
        content: [
          {
            type: 'text',
            text: `🔧 Nuxt Configuration:\n\n\`\`\`typescript\n${configContent}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Could not read Nuxt config: ${error.message}`,
          },
        ],
      };
    }
  }

  async analyzeProjectStructure() {
    const analysis = await this.getProjectAnalysis();
    
    return {
      content: [
        {
          type: 'text',
          text: `🔍 Project Structure Analysis:\n\n${analysis}`,
        },
      ],
    };
  }

  async scanDirectory(dir, extension) {
    try {
      const files = [];
      const scan = async (currentDir, relativePath = '') => {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            await scan(
              path.join(currentDir, entry.name),
              relativePath ? `${relativePath}/${entry.name}` : entry.name
            );
          } else if (entry.name.endsWith(extension)) {
            files.push(relativePath ? `${relativePath}/${entry.name}` : entry.name);
          }
        }
      };
      
      await scan(dir);
      return files.sort();
    } catch {
      return [];
    }
  }

  async getProjectAnalysis() {
    const components = await this.scanDirectory(path.join(PROJECT_ROOT, 'components'), '.vue');
    const pages = await this.scanDirectory(path.join(PROJECT_ROOT, 'pages'), '.vue');
    const composables = await this.scanDirectory(path.join(PROJECT_ROOT, 'composables'), '.ts');
    
    return `
📊 **Project Statistics:**
- Components: ${components.length}
- Pages: ${pages.length}
- Composables: ${composables.length}

🏗️ **Structure Insights:**
- Components organized in: ${new Set(components.map(c => c.split('/')[0])).size} top-level directories
- Page routes available: ${pages.length}
- Auto-imported composables: ${composables.length}

💡 **Recommendations:**
${components.length > 20 ? '- Consider organizing components into more subdirectories' : ''}
${composables.length < 3 ? '- Consider creating more reusable composables' : ''}
${pages.length > 10 ? '- Consider using layouts for common page structures' : ''}
`;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Nuxt Development MCP Server running on stdio');
  }
}

const server = new NuxtDevMcpServer();
server.run().catch(console.error);
