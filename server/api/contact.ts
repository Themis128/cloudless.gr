import { defineEventHandler, getMethod, readBody, createError } from 'h3';
import type { ContactFormData, ContactSubmissionInsert, Database } from '~/types/database';
import { getClientIP } from '../utils/helpers';
import { supabase } from '../../utils/supabase';

export default defineEventHandler(async (_event) => {
  const method = getMethod(_event);

  // Only allow POST requests for contact form submissions
  if (method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  try {
    const body = await readBody<ContactFormData>(_event);

    // Validate required fields
    if (!body.name || !body.email || !body.message) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name, email, and message are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format',
      });
    }

    // Validate message length
    if (body.message.length < 10) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Message must be at least 10 characters long',
      });
    }

    if (body.message.length > 5000) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Message cannot exceed 5000 characters',
      });
    }

    // Get client IP address and other metadata
    const clientIP = getClientIP(_event) || 'unknown';
    const userAgent = getHeader(_event, 'user-agent') || 'unknown';
    const referrer = getHeader(_event, 'referer') || 'direct';

    // Create contact submission with metadata
    const contactData: ContactSubmissionInsert = {
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      subject: body.subject?.trim() || null,
      message: body.message.trim(),
      status: 'pending',
      metadata: {
        ip: clientIP,
        userAgent,
        referrer,
        submissionTime: new Date().toISOString(),
      },
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from('contact_submissions')
      .insert([contactData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to save contact submission',
      });
    }

    // Log successful submission
    console.log(`Contact submission received from ${contactData.email} (ID: ${data.id})`);

    return {
      success: true,
      message: 'Contact form submitted successfully',
      submissionId: data.id,
    };
  } catch (error: any) {
    console.error('Contact form submission error:', error);

    // Return proper error response
    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    });
  }
});
