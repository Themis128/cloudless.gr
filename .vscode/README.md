# VS Code Configuration for Cloudless.gr

This directory contains VS Code settings and configuration files to enhance development experience.

## Included Configuration

### settings.json

- Code formatting settings using Prettier
- ESLint integration
- TypeScript configuration
- File associations
- Editor preferences for consistent code style
- Tailwind CSS integration
- Search exclusion patterns

### launch.json

- Debugging configurations for Nuxt application
- Chrome debugging for client-side code
- Node.js debugging for server-side code
- Test debugging support
- Fullstack (client+server) debugging compound

### tasks.json

- Common development tasks as VS Code tasks
- Build, dev, and preview tasks for Nuxt
- Testing tasks
- Prisma database tasks
- Utility tasks (cleaning cache, updating dependencies)

### extensions.json

- Recommended VS Code extensions for this project
- Includes extensions for Vue, TypeScript, Prettier, ESLint, Tailwind, etc.

### vue.code-snippets

- Custom code snippets for Vue/Nuxt development
- Includes templates for Vue 3 components, pages, composables, etc.

### debug-settings.json

- Additional debugging configurations and editor customizations
- Color customizations for errors, warnings, and infos
- TODO highlights configuration

### jsconfig.json

- JavaScript/TypeScript path aliases
- Enables proper intellisense and navigation

## Usage

These configurations will be automatically applied when opening the project in VS Code. Extensions will be recommended but need to be installed manually.

- To run a task: `Ctrl+Shift+P` > "Tasks: Run Task"
- To start debugging: `F5` or use the Debug panel
- To use a snippet: Type the prefix (e.g., `vue3ts`) in a file and select from suggestions

## Customization

Feel free to modify these settings according to your preferences. To revert to defaults, simply delete the corresponding file.
