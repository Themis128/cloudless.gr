export default defineEventHandler(() => {
  const config = useRuntimeConfig();
  return {
    url: config.public.supabaseUrl,
    keyPresent: !!config.public.supabaseKey,
  };
});
