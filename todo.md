# Dev Container Perfection Checklist

This checklist outlines the actions needed to build a perfect development container for this project. It is tailored for Nuxt 3, Prisma, PNPM, Vuetify3, Playwright, Cypress, and PowerShell support.

## 1. Base Dev Container Setup
- [ ] Create a `.devcontainer` folder at the project root.
- [ ] Add a `devcontainer.json` with:
  - Forwarded ports (e.g., 3000, 5555, 9229, 6379, 5432 as needed)
  - Workspace folder set to `/workspace`
  - Post-create commands for `pnpm install`, `prisma generate`, etc.
  - Features for Node.js (v18+), PowerShell, and Docker-in-Docker if needed
- [ ] Add a `Dockerfile` (or use `Dockerfile.dev` if compatible):
  - Node.js 18+ base image
  - Install pnpm globally
  - Install PowerShell
  - Install Playwright dependencies (see Playwright docs)
  - Install Prisma CLI
  - Install any system dependencies for Cypress (see Cypress docs)
  - Set up non-root user if required

## 2. Database & Services
- [ ] Ensure `docker-compose.dev.yml` is referenced in `devcontainer.json` for service containers (Postgres, Redis, etc.)
- [ ] Add `prisma generate` and `prisma migrate dev` to post-create or post-start hooks
- [ ] Reference `.env.example` for environment variables

## 3. Editor & Extensions
- [ ] Recommend VS Code extensions in `devcontainer.json`:
  - Prisma
  - ESLint
  - Prettier
  - Volar (Vue)
  - Playwright Test for VS Code
  - Docker
  - PowerShell
  - GitHub Codespaces (if using)

## 4. Scripts & Automation
- [ ] Reference PowerShell scripts in `/scripts` for Windows compatibility
- [ ] Reference bash scripts for Linux/Mac compatibility
- [ ] Ensure all scripts are executable (`chmod +x` for sh, correct line endings for ps1)

## 5. Testing & CI
- [ ] Ensure Playwright and Cypress can run in the container (check dependencies, xvfb, etc.)
- [ ] Expose test reports (e.g., `/playwright-report`)
- [ ] Reference `test:all` and related scripts in documentation

## 6. Documentation
- [ ] Add a `README.md` section for dev container usage
- [ ] Reference this `todo.md` and update as setup progresses

## 7. Optional/Advanced
- [ ] Add GitHub Codespaces support if desired
- [ ] Add custom VS Code settings (e.g., format on save)
- [ ] Add dotfiles for shell customization

---

**References:**
- `Dockerfile.dev`
- `docker-compose.dev.yml`
- `/scripts` (PowerShell & bash)
- `.env.example`
- [Playwright Docker guide](https://playwright.dev/docs/ci#docker)
- [Cypress Docker guide](https://docs.cypress.io/guides/continuous-integration/introduction#Docker)
- [Prisma Docker guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)

> Update this checklist as you implement each step or if project requirements change.