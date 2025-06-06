// This file is temporarily disabled due to Supabase module issues
// Will be re-enabled when Supabase is properly configured

export default defineEventHandler(async (event) => {
  // Log the request for debugging
  console.error('Supabase auth handler accessed but disabled:', event.node.req.url);
  
  // Return a 404 for now to prevent module loading errors
  throw createError({
    statusCode: 404,
    statusMessage: 'Supabase auth handler temporarily disabled',
  });
});
