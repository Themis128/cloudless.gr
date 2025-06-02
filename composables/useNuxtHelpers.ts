// This file contains custom helper functions (not re-exports of Nuxt built-ins)
// All Nuxt composables like useRoute, useRouter, navigateTo, etc. are auto-imported

export const customNavigateWithDelay = async (to: string, delay: number = 100) => {
  // Custom navigation with delay - using Nuxt's auto-imported navigateTo
  await new Promise((resolve) => setTimeout(resolve, delay));
  if (process.client) {
    return await navigateTo(to);
  }
};

export const getRouteQuery = (key: string, defaultValue?: string) => {
  // Custom route query helper
  const route = useRoute();
  return (route.query[key] as string) ?? defaultValue;
};

export const isCurrentRoute = (path: string) => {
  // Check if current route matches the given path
  const route = useRoute();
  return route.path === path;
};
