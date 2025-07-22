# Complete Testing Guide

Comprehensive testing documentation covering unit testing, integration testing, end-to-end testing, and testing strategies for the Nuxt.js application.

## Overview

The application includes multiple testing layers:

- **Unit Testing**: Component and utility function testing with Vitest
- **Integration Testing**: API endpoint and service integration tests
- **E2E Testing**: End-to-end user workflows with Cypress
- **Component Testing**: Vue component testing with Vue Test Utils
- **API Testing**: Backend API endpoint testing

## Testing Stack

### Core Testing Tools

- **Vitest**: Fast unit testing framework
- **Vue Test Utils**: Vue component testing utilities
- **Cypress**: End-to-end testing framework
- **Happy DOM**: Fast DOM implementation for testing
- **MSW**: Mock Service Worker for API mocking
- **Testing Library**: Additional testing utilities

### Testing Configuration

#### Vitest Configuration

**Location**: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: [
      'test/**/*.{test,spec}.{js,ts}',
      'components/**/*.{test,spec}.{js,ts}',
      'composables/**/*.{test,spec}.{js,ts}',
      'utils/**/*.{test,spec}.{js,ts}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/', '.nuxt/', '.output/', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './'),
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

#### Test Setup File

**Location**: `test/setup.ts`

```typescript
import { vi } from 'vitest';
import { config } from '@vue/test-utils';

// Global test configuration
config.global.stubs = {
  NuxtLink: true,
  ClientOnly: true,
};

// Mock Nuxt composables
vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $fetch: vi.fn(),
    ssrContext: {},
  }),
  navigateTo: vi.fn(),
  useRuntimeConfig: () => ({
    public: {
      apiBase: 'http://localhost:3000',
    },
  }),
  useRoute: () => ({
    params: {},
    query: {},
    path: '/',
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock browser APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Global test helpers
global.createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  isAdmin: false,
  createdAt: new Date(),
  ...overrides,
});

global.createMockProject = (overrides = {}) => ({
  id: 'project-123',
  title: 'Test Project',
  slug: 'test-project',
  description: 'A test project',
  status: 'active',
  category: 'web-development',
  featured: false,
  technologies: ['Vue.js', 'Nuxt.js'],
  createdAt: new Date(),
  ...overrides,
});
```

## Unit Testing

### Component Testing

#### Basic Component Test

```typescript
// test/components/UserCard.test.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import UserCard from '~/components/UserCard.vue';

describe('UserCard', () => {
  const mockUser = createMockUser({
    name: 'John Doe',
    email: 'john@example.com',
  });

  it('renders user information correctly', () => {
    const wrapper = mount(UserCard, {
      props: { user: mockUser },
    });

    expect(wrapper.text()).toContain('John Doe');
    expect(wrapper.text()).toContain('john@example.com');
  });

  it('emits edit event when edit button is clicked', async () => {
    const wrapper = mount(UserCard, {
      props: { user: mockUser },
    });

    await wrapper.find('[data-testid="edit-button"]').trigger('click');

    expect(wrapper.emitted().edit).toBeTruthy();
    expect(wrapper.emitted().edit[0]).toEqual([mockUser]);
  });

  it('shows admin badge for admin users', () => {
    const adminUser = createMockUser({ isAdmin: true });
    const wrapper = mount(UserCard, {
      props: { user: adminUser },
    });

    expect(wrapper.find('[data-testid="admin-badge"]').exists()).toBe(true);
  });
});
```

#### Component with Props and Events

```typescript
// test/components/ProjectCard.test.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import ProjectCard from '~/components/ProjectCard.vue';

describe('ProjectCard', () => {
  const mockProject = createMockProject();

  it('renders project information', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject },
    });

    expect(wrapper.find('h3').text()).toBe(mockProject.title);
    expect(wrapper.text()).toContain(mockProject.description);
  });

  it('displays technology tags', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject },
    });

    const techTags = wrapper.findAll('[data-testid="tech-tag"]');
    expect(techTags).toHaveLength(mockProject.technologies.length);

    mockProject.technologies.forEach((tech, index) => {
      expect(techTags[index].text()).toBe(tech);
    });
  });

  it('handles click events', async () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject },
    });

    await wrapper.trigger('click');

    expect(wrapper.emitted().click).toBeTruthy();
    expect(wrapper.emitted().click[0]).toEqual([mockProject]);
  });
});
```

### Composable Testing

#### Testing Vue Composables

```typescript
// test/composables/useAuth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUserAuth } from '~/composables/useUserAuth';

// Mock the $fetch function
const mockFetch = vi.fn();
vi.mock('#app', () => ({
  $fetch: mockFetch,
  navigateTo: vi.fn(),
}));

describe('useUserAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { isLoggedIn, currentUser, loginError } = useUserAuth();

    expect(isLoggedIn.value).toBe(false);
    expect(currentUser.value).toBe(null);
    expect(loginError.value).toBe('');
  });

  it('should handle successful login', async () => {
    const mockUser = createMockUser();
    mockFetch.mockResolvedValueOnce({
      success: true,
      user: mockUser,
    });

    const { login, isLoggedIn, currentUser } = useUserAuth();

    await login('test@example.com', 'password');

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/user', {
      method: 'POST',
      body: {
        action: 'login',
        email: 'test@example.com',
        password: 'password',
      },
    });

    expect(isLoggedIn.value).toBe(true);
    expect(currentUser.value).toEqual(mockUser);
  });

  it('should handle login failure', async () => {
    mockFetch.mockRejectedValueOnce({
      data: { error: 'Invalid credentials' },
    });

    const { login, loginError } = useUserAuth();

    await login('test@example.com', 'wrong-password');

    expect(loginError.value).toBe('Invalid credentials');
  });

  it('should handle logout', async () => {
    mockFetch.mockResolvedValueOnce({ success: true });

    const { logout, isLoggedIn, currentUser } = useUserAuth();

    // Set initial logged in state
    const { login } = useUserAuth();
    mockFetch.mockResolvedValueOnce({
      success: true,
      user: createMockUser(),
    });
    await login('test@example.com', 'password');

    // Test logout
    await logout();

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
    });

    expect(isLoggedIn.value).toBe(false);
    expect(currentUser.value).toBe(null);
  });
});
```

### Utility Function Testing

```typescript
// test/utils/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, sanitizeInput } from '~/utils/validation';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'user+tag@example.org'];

      validEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = ['invalid-email', '@example.com', 'user@', 'user.name', ''];

      invalidEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = ['StrongPass123!', 'MySecure$Password1', 'Complex_Password_123'];

      strongPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = ['weak', '12345', 'password', 'PASSWORD', 'Pass123'];

      weakPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should remove harmful scripts', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello');
    });

    it('should preserve safe HTML', () => {
      const safeInput = '<p>Safe <strong>content</strong></p>';
      const sanitized = sanitizeInput(safeInput);

      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
    });
  });
});
```

## Integration Testing

### API Endpoint Testing

```typescript
// test/api/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { $fetch } from 'ofetch';
import { setup, createPage } from '@nuxt/test-utils';

describe('Authentication API', async () => {
  await setup({
    rootDir: '.',
  });

  describe('POST /api/auth/user', () => {
    it('should register a new user', async () => {
      const userData = {
        action: 'register',
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      };

      const response = await $fetch('/api/auth/user', {
        method: 'POST',
        body: userData,
        baseURL: 'http://localhost:3000',
      });

      expect(response.success).toBe(true);
      expect(response.user).toBeDefined();
      expect(response.user.email).toBe(userData.email);
      expect(response.user.name).toBe(userData.name);
    });

    it('should login existing user', async () => {
      const loginData = {
        action: 'login',
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await $fetch('/api/auth/user', {
        method: 'POST',
        body: loginData,
        baseURL: 'http://localhost:3000',
      });

      expect(response.success).toBe(true);
      expect(response.user).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const invalidData = {
        action: 'login',
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      try {
        await $fetch('/api/auth/user', {
          method: 'POST',
          body: invalidData,
          baseURL: 'http://localhost:3000',
        });
      } catch (error) {
        expect(error.status).toBe(401);
        expect(error.data.error).toBe('Invalid credentials');
      }
    });
  });

  describe('GET /api/projects', () => {
    it('should return list of projects', async () => {
      const response = await $fetch('/api/projects', {
        baseURL: 'http://localhost:3000',
      });

      expect(Array.isArray(response.projects)).toBe(true);
      expect(response.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter projects by category', async () => {
      const response = await $fetch('/api/projects', {
        query: { category: 'web-development' },
        baseURL: 'http://localhost:3000',
      });

      response.projects.forEach((project) => {
        expect(project.category).toBe('web-development');
      });
    });
  });
});
```

### Database Integration Testing

```typescript
// test/integration/database.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Integration', () => {
  beforeEach(async () => {
    // Clean database before each test
    await prisma.contactSubmission.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.contactSubmission.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('User Model', () => {
    it('should create a user', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedpassword',
      };

      const user = await prisma.user.create({
        data: userData,
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should enforce unique email constraint', async () => {
      const userData = {
        email: 'duplicate@example.com',
        name: 'User 1',
        password: 'password1',
      };

      await prisma.user.create({ data: userData });

      // Try to create another user with same email
      await expect(
        prisma.user.create({
          data: {
            email: 'duplicate@example.com',
            name: 'User 2',
            password: 'password2',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Project Model', () => {
    it('should create a project', async () => {
      const projectData = {
        title: 'Test Project',
        slug: 'test-project',
        description: 'A test project',
        status: 'active',
        category: 'web-development',
        technologies: ['Vue.js', 'Nuxt.js'],
      };

      const project = await prisma.project.create({
        data: projectData,
      });

      expect(project.id).toBeDefined();
      expect(project.slug).toBe(projectData.slug);
      expect(project.technologies).toEqual(projectData.technologies);
    });

    it('should enforce unique slug constraint', async () => {
      const projectData = {
        title: 'Project 1',
        slug: 'duplicate-slug',
        description: 'First project',
        status: 'active',
        category: 'web-development',
        technologies: [],
      };

      await prisma.project.create({ data: projectData });

      await expect(
        prisma.project.create({
          data: {
            ...projectData,
            title: 'Project 2',
          },
        })
      ).rejects.toThrow();
    });
  });
});
```

## End-to-End Testing

### Cypress Configuration

**Location**: `cypress.config.ts`

```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    video: false,
    screenshot: true,
    setupNodeEvents(on, config) {
      // Node event listeners
    },
  },
  component: {
    devServer: {
      framework: 'nuxt',
      bundler: 'vite',
    },
  },
  env: {
    admin_username: 'admin',
    admin_password: 'cloudless2025',
  },
});
```

### E2E Test Examples

#### User Authentication Flow

```typescript
// cypress/e2e/auth.cy.ts
describe('User Authentication', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should allow user registration', () => {
    cy.get('[data-testid="signup-link"]').click();

    cy.get('[data-testid="name-input"]').type('Test User');
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('SecurePass123!');

    cy.get('[data-testid="signup-button"]').click();

    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-menu"]').should('contain', 'Test User');
  });

  it('should handle login and logout', () => {
    // Login
    cy.get('[data-testid="login-link"]').click();
    cy.get('[data-testid="email-input"]').type('existing@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();

    // Verify login
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-menu"]').should('be.visible');

    // Logout
    cy.get('[data-testid="user-menu"]').click();
    cy.get('[data-testid="logout-button"]').click();

    // Verify logout
    cy.url().should('not.include', '/dashboard');
    cy.get('[data-testid="login-link"]').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.get('[data-testid="login-link"]').click();
    cy.get('[data-testid="email-input"]').type('invalid@example.com');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-button"]').click();

    cy.get('[data-testid="error-message"]')
      .should('be.visible')
      .and('contain', 'Invalid credentials');
  });
});
```

#### Project Management Flow

```typescript
// cypress/e2e/projects.cy.ts
describe('Project Management', () => {
  beforeEach(() => {
    // Login as admin
    cy.login('admin', 'cloudless2025');
  });

  it('should create a new project', () => {
    cy.visit('/admin/projects');

    cy.get('[data-testid="create-project-button"]').click();

    cy.get('[data-testid="title-input"]').type('New Test Project');
    cy.get('[data-testid="description-input"]').type('This is a test project created by Cypress');
    cy.get('[data-testid="category-select"]').select('web-development');
    cy.get('[data-testid="status-select"]').select('active');

    cy.get('[data-testid="tech-input"]').type('Vue.js{enter}');
    cy.get('[data-testid="tech-input"]').type('Cypress{enter}');

    cy.get('[data-testid="save-project-button"]').click();

    // Verify project was created
    cy.get('[data-testid="success-message"]').should('contain', 'Project created successfully');

    cy.get('[data-testid="project-list"]').should('contain', 'New Test Project');
  });

  it('should edit existing project', () => {
    cy.visit('/admin/projects');

    // Find and edit the first project
    cy.get('[data-testid="project-row"]').first().find('[data-testid="edit-button"]').click();

    cy.get('[data-testid="title-input"]').clear().type('Updated Project Title');
    cy.get('[data-testid="featured-checkbox"]').check();

    cy.get('[data-testid="save-project-button"]').click();

    cy.get('[data-testid="success-message"]').should('contain', 'Project updated successfully');
  });

  it('should delete project', () => {
    cy.visit('/admin/projects');

    cy.get('[data-testid="project-row"]').first().find('[data-testid="delete-button"]').click();

    // Confirm deletion in modal
    cy.get('[data-testid="confirm-delete-button"]').click();

    cy.get('[data-testid="success-message"]').should('contain', 'Project deleted successfully');
  });
});
```

#### Contact Form Testing

```typescript
// cypress/e2e/contact.cy.ts
describe('Contact Form', () => {
  beforeEach(() => {
    cy.visit('/contact');
  });

  it('should submit contact form successfully', () => {
    cy.get('[data-testid="name-input"]').type('John Doe');
    cy.get('[data-testid="email-input"]').type('john@example.com');
    cy.get('[data-testid="subject-input"]').type('Test Inquiry');
    cy.get('[data-testid="message-textarea"]').type(
      'This is a test message from the contact form.'
    );

    cy.get('[data-testid="submit-button"]').click();

    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'Message sent successfully');
  });

  it('should validate required fields', () => {
    cy.get('[data-testid="submit-button"]').click();

    cy.get('[data-testid="name-error"]').should('be.visible').and('contain', 'Name is required');

    cy.get('[data-testid="email-error"]').should('be.visible').and('contain', 'Email is required');
  });

  it('should validate email format', () => {
    cy.get('[data-testid="email-input"]').type('invalid-email');
    cy.get('[data-testid="submit-button"]').click();

    cy.get('[data-testid="email-error"]')
      .should('be.visible')
      .and('contain', 'Please enter a valid email');
  });
});
```

### Cypress Support Commands

**Location**: `cypress/support/commands.ts`

```typescript
declare global {
  namespace Cypress {
    interface Chainable {
      login(username: string, password: string): Chainable<void>;
      loginAsAdmin(): Chainable<void>;
      createTestUser(userData?: Partial<User>): Chainable<void>;
      createTestProject(projectData?: Partial<Project>): Chainable<void>;
      clearDatabase(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (username: string, password: string) => {
  cy.session([username, password], () => {
    cy.visit('/auth/login');
    cy.get('[data-testid="email-input"]').type(username);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('not.include', '/auth/login');
  });
});

Cypress.Commands.add('loginAsAdmin', () => {
  cy.login(Cypress.env('admin_username'), Cypress.env('admin_password'));
});

Cypress.Commands.add('createTestUser', (userData = {}) => {
  const defaultUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  };

  const user = { ...defaultUser, ...userData };

  cy.request('POST', '/api/auth/user', {
    action: 'register',
    ...user,
  });
});

Cypress.Commands.add('createTestProject', (projectData = {}) => {
  const defaultProject = {
    title: 'Test Project',
    slug: 'test-project',
    description: 'A test project',
    status: 'active',
    category: 'web-development',
    technologies: ['Vue.js'],
  };

  const project = { ...defaultProject, ...projectData };

  cy.request('POST', '/api/projects', project);
});

Cypress.Commands.add('clearDatabase', () => {
  cy.request('POST', '/api/test/clear-database');
});
```

## Testing Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "e2e": "cypress open",
    "e2e:headless": "cypress run",
    "e2e:ci": "start-server-and-test dev 3000 'cypress run'",
    "test:all": "npm run test:run && npm run e2e:headless"
  }
}
```

### CI/CD Testing Pipeline

**Location**: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:run

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          npx prisma generate
          npx prisma db push

      - name: Run E2E tests
        run: npm run e2e:ci

      - name: Upload E2E screenshots
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots
          path: cypress/screenshots
```

## Testing Best Practices

### 1. Test Organization

```
test/
├── components/          # Component tests
├── composables/         # Composable tests
├── utils/              # Utility function tests
├── api/                # API integration tests
├── fixtures/           # Test data fixtures
├── mocks/              # Mock implementations
└── setup.ts            # Test setup file
```

### 2. Test Data Management

```typescript
// test/fixtures/users.ts
export const testUsers = {
  regularUser: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Regular User',
    isAdmin: false,
  },
  adminUser: {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin User',
    isAdmin: true,
  },
};

// test/fixtures/projects.ts
export const testProjects = [
  {
    id: 'project-1',
    title: 'Web Application',
    slug: 'web-app',
    category: 'web-development',
    status: 'active',
    featured: true,
  },
];
```

### 3. Mock Strategies

```typescript
// test/mocks/api.ts
import { vi } from 'vitest';

export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock successful responses by default
mockApiClient.get.mockImplementation((url) => {
  if (url.includes('/users')) {
    return Promise.resolve({ data: testUsers });
  }
  if (url.includes('/projects')) {
    return Promise.resolve({ data: testProjects });
  }
  return Promise.resolve({ data: {} });
});
```

## Performance Testing

### Load Testing with Artillery

```yaml
# artillery.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: 'Warm up'
    - duration: 120
      arrivalRate: 50
      name: 'Load test'
    - duration: 60
      arrivalRate: 100
      name: 'Stress test'

scenarios:
  - name: 'Browse projects'
    weight: 40
    flow:
      - get:
          url: '/'
      - get:
          url: '/projects'
      - think: 5
      - get:
          url: '/projects/{{ $randomString() }}'

  - name: 'User authentication'
    weight: 30
    flow:
      - post:
          url: '/api/auth/user'
          json:
            action: 'login'
            email: 'test@example.com'
            password: 'password123'

  - name: 'API endpoints'
    weight: 30
    flow:
      - get:
          url: '/api/projects'
      - get:
          url: '/api/health'
```

## Related Documentation

- [Cypress Testing Guide](cypress-testing-guide.md) - Detailed Cypress setup
- [Contact Form Testing](contact-form-testing.md) - Form-specific testing
- [Development Setup](development-setup.md) - Development environment
- [API Reference](api-reference.md) - API endpoint testing

---

**Last Updated**: December 2024
