// Test endpoint for admin login functionality
export default defineEventHandler(async (event) => {
  // Log test endpoint access
  console.log('Admin login test endpoint accessed at:', new Date().toISOString());
  console.log('Request URL:', getRequestURL(event));
  
  if (process.env.NODE_ENV === 'production') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not found',
    });
  }

  try {
    return {
      success: true,
      message: 'Admin login test endpoint is working',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Admin login test error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Test failed',
    });
  }
});
