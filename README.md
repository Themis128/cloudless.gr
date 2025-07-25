<<<<<<< HEAD
# Cloudless Wizard 🧙‍♂️

A low-code platform for building AI-powered data pipelines, analytics, and intelligent applications.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop
- PowerShell 7+ (Windows) or Bash (Linux/Mac)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Themis128/cloudless.gr.git
cd cloudless.gr

# Start development environment
npm run docker:dev:start

# Access the application
open http://localhost:3000
```

## 📁 Project Structure

```
cloudless.gr/
├── 📚 docs/                    # Documentation
├── 🐳 docker/                  # Docker configuration
├── 🔧 scripts/                 # Automation scripts
├── 🧪 tests/                   # Testing files
├── 🎨 assets/                  # Static assets
├── 🌐 public/                  # Public files
├── 📄 pages/                   # Nuxt pages
├── 🧩 components/              # Vue components
├── 🔌 composables/             # Nuxt composables
├── 🗄️ stores/                  # Pinia stores
├── 📝 types/                   # TypeScript types
├── 🎨 layouts/                 # Nuxt layouts
├── 🔌 plugins/                 # Nuxt plugins
├── 🖥️ server/                  # Server-side code
└── 📋 Configuration files
```

📖 **See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for detailed structure**

## 🛠️ Development

### Docker Development Environment

```bash
# Start development
npm run docker:dev:start

# View logs
npm run docker:dev:logs

# Access container shell
npm run docker:dev:shell

# Stop development
npm run docker:dev:stop
```

📚 **See [docs/DOCKER-DEV.md](./docs/DOCKER-DEV.md) for detailed guide**

### Testing

```bash
# Run E2E tests
npm test

# Run integration tests
chmod +x tests/test-integration.sh
./tests/test-integration.sh

# Run tests with UI
npx playwright test --headed
```

📚 **See [docs/TESTING.md](./docs/TESTING.md) for testing guide**

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🐳 Deployment

### Docker Deployment

```bash
# Deploy using PowerShell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1

# Deploy using Bash
bash scripts/deploy.sh
```

📚 **See [docs/DOCKER.md](./docs/DOCKER.md) for deployment guide**

## 🧪 Testing & CI/CD

The project includes comprehensive testing and CI/CD:

- ✅ **Linting & Type Checking** - ESLint, Prettier, TypeScript
- ✅ **Security Scanning** - npm audit, audit-ci, vulnerability detection
- ✅ **E2E Testing** - Playwright browser automation
- ✅ **Accessibility Testing** - WCAG compliance checks
- ✅ **Performance Testing** - Bundle size analysis
- ✅ **Integration Testing** - Server startup and connectivity
- ✅ **PR Preview** - Automated preview deployments

📚 **See [docs/TESTING.md](./docs/TESTING.md) for detailed testing documentation**

## 🏗️ Architecture

### Frontend

- **Nuxt 3** - Vue.js framework
- **Vuetify 3** - Material Design components
- **Pinia** - State management
- **TypeScript** - Type safety

### Backend

- **Nuxt Server Routes** - API endpoints
- **Supabase** - Database and authentication
- **Nitro** - Server engine

### DevOps

- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipeline
- **Playwright** - E2E testing

## 📚 Documentation

- 📖 **[Project Structure](./PROJECT_STRUCTURE.md)** - Detailed file organization
- 🐳 **[Docker Development](./docs/DOCKER-DEV.md)** - Development environment guide
- 🐳 **[Docker Deployment](./docs/DOCKER.md)** - Production deployment guide
- 🧪 **[Testing Guide](./docs/TESTING.md)** - Testing and CI/CD documentation
- 🔧 **[Scripts Documentation](./scripts/README.md)** - Automation scripts guide
- 🧪 **[Tests Documentation](./tests/README.md)** - Testing structure guide

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📚 **[Documentation](./docs/support.md)** - Comprehensive support guide
- 🐛 **[Issues](https://github.com/Themis128/cloudless.gr/issues)** - Report bugs
- 💬 **[Discussions](https://github.com/Themis128/cloudless.gr/discussions)** - Ask questions

---

**Built with ❤️ by the Cloudless team**
=======
# LLM Integration (Portable)

This project demonstrates a portable integration for a local LLM (Large Language Model) API in a Nuxt 3 app.

## How it works

- All LLM API logic is encapsulated in `utils/codeLlama.ts`.
- The API endpoint and model are configurable via environment variables.
- The UI is componentized (see `components/MyGeneratedComponent.vue`).
- The backend API is proxied via Nuxt server routes (see `server/api/generate.ts`).

## Usage in Your Project

1. **Copy the utility**

   - Copy `utils/codeLlama.ts` to your project.

2. **Copy the server API route**

   - Copy `server/api/generate.ts` to your Nuxt project's `server/api/` directory.

3. **Set environment variables**

   - Copy `.env.example` to `.env` and set your LLM API URL and model.

4. **Use the utility in your components**

   - Import and call `generateLLMResponse(prompt, onData?)` in your Vue components or composables.

5. **Componentize your UI**
   - Use or adapt `components/MyGeneratedComponent.vue` for your LLM chat/editor UI.

## Environment Variables

See `.env.example` for required variables:

```
LLM_API_URL=http://localhost:11434/api/generate
LLM_MODEL=phind-codellama:34b
```

## Making it Even More Portable

- Accept endpoint/model as props in your UI component.
- Use slots for custom UI.
- Document all props/events in your component.

## Example

```ts
import { generateLLMResponse } from '@/utils/codeLlama';

const response = await generateLLMResponse('Your prompt here');
```

---

**You can now reuse this LLM integration in any Nuxt or JavaScript project!**

---

# Contact Form System

The project includes a comprehensive contact form system with both email notification and database storage capabilities.

## Features

- Reusable contact form composable
- Form validation
- Email notifications
- Database storage (SQLite with Prisma ORM)
- Admin interface for managing submissions

## Contact Form Composable

The `useContactUs` composable provides a reusable approach to manage contact form functionality:

```ts
import { useContactUs } from '~/composables/useContactUs';

const {
  formData, // Reactive form data object
  errors, // Validation errors
  isSubmitting, // Loading state
  isSubmitted, // Success state
  submitError, // Error message
  validateForm, // Validation function
  submitContactForm, // Submit function
  resetForm, // Reset function
} = useContactUs();
```

## Email Notifications

When a user submits the contact form, you can receive the submission via email:

1. Configure SMTP settings in `server/config/email.ts` or use environment variables
2. Emails include sender information, subject, and message content
3. Emails are formatted with HTML for better readability

Example email configuration:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EMAIL_SENDER=contact@cloudless.gr
EMAIL_RECIPIENT=your-email@example.com
```

## Database Storage

All form submissions are stored in a SQLite database for easy management:

1. Submissions are saved in the `ContactSubmission` model
2. Includes status tracking (new, read, replied, archived)
3. Support for admin notes on each submission

Database schema:

```prisma
model ContactSubmission {
  id        Int      @id @default(autoincrement())
  name      String
  email     String
  subject   String
  message   String
  createdAt DateTime @default(now())
  status    String   @default("new")
  notes     String?
}
```

## Admin Interface

Access and manage all contact form submissions through the admin interface:

1. Navigate to `/admin/login` (default credentials: admin/cloudless2025)
2. View submissions at `/admin/contact-submissions`
3. Filter by status, add notes, and update submission status
4. Delete submissions if needed

## Security

The admin section and API are protected:

1. Admin routes require authentication
2. API endpoints for submissions management require a bearer token
3. Form validation prevents common spam techniques

## Implementation Details

For detailed implementation information, see the documentation files:

- [Contact Form Composable Documentation](assets/docs/contact-us-composable.md)
- [Email Configuration Guide](assets/docs/contact-form-email-setup.md)
- [Database Storage Documentation](assets/docs/contact-form-database.md)

## Getting Started

1. Install dependencies: `npm install`
2. Configure your SMTP settings in `.env`
3. Run database migrations: `npx prisma db push`
4. Start the dev server: `npm run dev`

You'll find the contact form at `/contact` and the admin interface at `/admin`.

---

# Static Asset Handling

The project includes proper handling for static assets like images in the gallery:

## Gallery Routes

- Dynamic handling for gallery assets with:
  - `/pages/gallery/index.vue` - Gallery index page
  - `/pages/gallery/[asset].vue` - Dynamic route for assets

## Static Assets Middleware

A middleware handles requests to static assets like `/gallery/noise.png`:

1. `middleware/static-assets.global.ts` intercepts routes for static files
2. Static files are served from the `/public` directory
3. Routes like `/gallery/noise.png` correctly serve the file from `/public/gallery/noise.png`

## VantaBackground Component

The VantaBackground component uses the texture file for the 3D cloud effect:

```vue
<!-- VantaBackground.vue -->
<script>
export default {
  mounted() {
    // Properly references the static texture
    this.vantaEffect = window.VANTA.CLOUDS({
      el: this.$refs.vantaContainer,
      texturePath: '/gallery/noise.png',
    });
  },
};
</script>
```

For detailed information, see the [noise-png-usage.txt](assets/docs/noise-png-usage.txt) documentation.

---

# Project Configuration

The project includes optimized configuration for Nuxt, Tailwind CSS, ESLint, and more:

## Tailwind CSS Configuration

The Tailwind CSS configuration is properly set up:

```js
// tailwind.config.js
module.exports = {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './nuxt.config.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      // Custom theme configuration
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
```

## Nuxt Configuration

Nuxt is configured with proper modules and settings:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image-edge',
    '@nuxt/content',
    '@pinia/nuxt',
    'nuxt-llms',
    '@nuxtjs/tailwindcss',
  ],

  // Tailwind CSS configuration
  tailwindcss: {
    exposeConfig: true,
    viewer: true,
    configPath: '~/tailwind.config.js',
  },

  // PostCSS configuration
  postcss: {
    plugins: {
      'tailwindcss/nesting': {},
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  // Other configuration...
});
```

## ESLint Configuration

ESLint is set up with proper configuration for Vue 3 and TypeScript:

```js
// .eslintrc.cjs
module.exports = {
  root: true,
  env: { browser: true, node: true },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parser: '@typescript-eslint/parser',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended',
    'prettier',
  ],
  // Rules and overrides...
};
```

## Project Structure

The project follows a clean and organized structure:

- `/pages` - All route pages
- `/components` - Reusable Vue components
- `/composables` - Vue composition API functions
- `/layouts` - Page layouts
- `/server` - Server-side code and API routes
- `/assets` - Static assets and CSS
- `/public` - Publicly accessible files
- `/middleware` - Nuxt route middleware
- `/prisma` - Database schema and configuration

---

# Getting Started

## Prerequisites

- Node.js (v18+)
- npm or yarn
- Git

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/cloudless.gr.git
   cd cloudless.gr
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

## Development

Start the development server:

```bash
npm run dev
# or
yarn dev
```

The application will be available at http://localhost:3000

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run generate` - Generate static site
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Run Prettier
- `npm run stylelint` - Run Stylelint
- `npm run type-check` - Run TypeScript type checking

## Deployment

Build for production:

```bash
npm run build
# or
yarn build
```

Preview the production build:

```bash
npm run preview
# or
yarn preview
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

# User Authentication System

The project includes a comprehensive user authentication system that allows users to create accounts, log in, access protected content, and manage their profiles.

## Features

- User registration and login
- Protected routes and content
- User profile management
- Password update functionality
- Middleware for route protection
- Responsive navigation with auth status

## Auth Components

The authentication system includes several key components:

1. **Login and Signup Pages**
   - Clean, responsive auth forms 
   - Form validation
   - Error handling

2. **User Profile**
   - Display user information
   - Account management options
   - Logout functionality

3. **Dashboard**
   - User activity tracking
   - Quick access to features
   - Protected access

4. **Settings Page**
   - Profile information updates
   - Password management
   - Account deletion options

## Authentication Composable

The `useUserAuth` composable provides a unified API for authentication:

```ts
import { useUserAuth } from '~/composables/useUserAuth';

const { 
  isLoggedIn,      // Reactive ref for auth state
  currentUser,     // Current user data
  loginError,      // Error messages
  isLoading,       // Loading state
  login,           // Login function
  signup,          // Signup function
  logout           // Logout function
} = useUserAuth();
```

## Protected Routes

Routes that require authentication are protected by middleware:

1. `middleware/user-auth.global.ts` checks authentication for protected routes
2. Unauthenticated users are redirected to login
3. Already authenticated users are redirected from auth pages to dashboard

Protected paths include:
- `/profile`
- `/dashboard` 
- `/settings`
- `/account`

## Navigation Integration

The auth system is integrated into the site navigation:

1. When not logged in:
   - Login and Signup links are displayed

2. When logged in:
   - My Dashboard link 
   - My Profile link
   - Logout button

## API Integration

The authentication system includes a server API endpoint:

- `server/api/auth/user.ts` handles login and signup operations
- User data is stored and retrieved securely
- Password validation and error handling

## Implementation Details

For in-depth implementation information, see the documentation files:
- [User Authentication System Documentation](assets/docs/user-authentication-system.md)
- [Authentication Background Configuration](assets/docs/auth-background-config.md)
- [Authentication API Documentation](assets/docs/auth-api.md)
- `composables/useUserAuth.ts` - Main authentication logic
- `middleware/user-auth.global.ts` - Route protection middleware
- `pages/auth/*` - Authentication UI components

## Getting Started with Auth

1. Navigate to `/auth/login` or `/auth/signup` to create an account
2. Use email and password (min 6 characters)
3. Once logged in, access your profile at `/profile`
4. Manage settings at `/settings`
5. View your dashboard at `/dashboard`

The authentication system uses secure HTTP-only cookies with JWT tokens for session management, combined with a server-side API for user authentication and authorization. All API routes are protected, and only authenticated users can access the application content.

---
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
