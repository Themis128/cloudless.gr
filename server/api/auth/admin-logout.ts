export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed',
    });
  }

  try {
    // Clear the admin token cookie
    deleteCookie(event, 'admin-token');

    return {
      success: true,
      message: 'Logged out successfully',
    };
  } catch (error) {
    console.error('Admin logout error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    });
  }
});
