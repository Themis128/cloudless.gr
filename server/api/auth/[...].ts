// This file is temporarily disabled due to Supabase module issues
// Will be re-enabled when Supabase is properly configured

export default defineEventHandler(async (_event) => {
  // Return a 404 for now to prevent module loading errors
  throw createError({
    statusCode: 404,
    statusMessage: 'Supabase auth handler temporarily disabled',
  });
});
