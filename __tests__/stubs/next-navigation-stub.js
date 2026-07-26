/**
 * ESM stub for next/navigation — Vitest alias target.
 *
 * next-intl imports `next/navigation` as a bare ESM specifier.
 * Vitest cannot resolve the CJS file in ESM context. This stub provides
 * no-op implementations sufficient for component rendering tests.
 */

export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
});

export const usePathname = () => "/";

export const useParams = () => ({});

export const useSearchParams = () => new URLSearchParams();

export const redirect = (url) => {
  throw new Error(`redirect: ${url}`);
};

export const permanentRedirect = (url) => {
  throw new Error(`permanentRedirect: ${url}`);
};

export const notFound = () => {
  throw new Error("notFound");
};
