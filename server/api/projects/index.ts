// import { serverSupabaseClient } from '#supabase/server'; // Temporarily disabled

export default defineEventHandler(async (event) => {
  try {
    // const supabase = await serverSupabaseClient(event); // Temporarily disabled

    // Mock projects data for now
    const projects = [
      {
        id: 1,
        title: 'E-commerce Platform',
        slug: 'ecommerce-platform',
        description: 'A comprehensive online shopping platform built with modern web technologies.',
        status: 'published',
        created_at: '2024-03-15T10:30:00Z',
        image_url: '/images/projects/ecommerce.jpg',
      },
      {
        id: 2,
        title: 'Mobile Fitness App',
        slug: 'mobile-fitness-app',
        description: 'Cross-platform mobile application for fitness tracking and workout planning.',
        status: 'published',
        created_at: '2024-03-12T14:15:00Z',
        image_url: '/images/projects/fitness-app.jpg',
      },
    ];    // Mock successful response - data variable kept for future use
    const data = projects;
    console.log('Fetched projects data:', data);
    const error = null;

    if (error) {
      console.error('Database error:', error);
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch projects',
      });
    }

    return {
      success: true,
      data: projects,
    };
  } catch (error) {
    console.error('Projects API error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    });
  }
});
