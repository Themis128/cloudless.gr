# Coding Standards

## TypeScript & React

- **TypeScript:** Strict mode enabled. Prefer `interface` over `type` for object shapes. Use `type` for unions, intersections, and utility types.
- **React:** Use functional components with hooks. Server Components by default; add `'use client'` only when interactivity is needed.
- **Imports:** Use path aliases (`@/` maps to `src/`). Group imports: React/external → internal → styles/types.
- **Async:** Use `async/await` over raw promises. Use `Promise.allSettled()` for fire-and-forget operations.
- **Error handling:** Use try/catch with specific error types. Log via `console.error` in dev, Sentry in prod.
- **Null safety:** Use `??` (nullish coalescing) over `||` for default values. Use optional chaining (`?.`).

## Next.js 16 Conventions

- **Routing:** App Router with `[locale]/` segment for i18n. API routes under `src/app/api/`.
- **Data fetching:** Server Components fetch directly. Client components use `fetch()` or SWR.
- **Metadata:** Use `generateMetadata()` for dynamic SEO. Static metadata via `export const metadata`.
- **Edge runtime:** Use `export const runtime = 'edge'` for API routes that need low latency.
- **Dynamic imports:** Use `next/dynamic` for heavy components (3D, charts) with `ssr: false`.

## Tailwind CSS 4

- Use `@theme inline` for custom tokens in CSS files.
- Never use dynamic class name construction (e.g., `bg-${color}`). Use static class mapping objects.
- Prefer Tailwind utility classes over custom CSS. Use `@apply` only in rare cases.
- Responsive: Mobile-first with `sm:`, `md:`, `lg:`, `xl:` breakpoints.

## File Organization

- One component per file, exported as default.
- Test files co-located in `__tests__/` directory with `.test.ts` or `.test.tsx` extension.
- Lib files are pure functions with no React dependencies unless explicitly needed.
- API route files export named functions: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.

## Naming Conventions

- **Components:** PascalCase (e.g., `Navbar.tsx`, `StoreGrid.tsx`)
- **Lib files:** kebab-case (e.g., `ssm-config.ts`, `slack-notify.ts`)
- **API routes:** kebab-case directory names (e.g., `api/webhooks/stripe/route.ts`)
- **Types/Interfaces:** PascalCase prefixed with `I` for interfaces (e.g., `IUser`, `IProduct`)
- **Functions:** camelCase (e.g., `getUserSession()`, `sendOrderConfirmation()`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `DEFAULT_LOCALE`, `SESSION_COOKIE_NAME`)