export default defineNuxtRouteMiddleware(async (to, from) => {
  const { getUser } = useSupabaseAuth();
  const user = await getUser();

  if (!user) {
    return navigateTo('/auth/login');
  }
});
