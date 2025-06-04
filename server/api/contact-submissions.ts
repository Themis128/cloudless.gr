import { defineEventHandler, getHeader, getMethod, H3Error, readBody } from 'h3';
import type { ContactFormData, ContactSubmissionInsert, Database } from '~/types/database';
import { getClientIP } from '../utils/helpers';
import { supabase } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  // Optional: Content-Type check
  const contentType = getHeader(event, 'content-type') || '';
  if (!contentType.includes('application/json')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid content type. Expected application/json',
    });
  }

  try {
    const body = await readBody<ContactFormData>(event);
    const supabase = await serverSupabaseClient<Database>(event);

    const name = body.name?.trim() || '';
    const email = body.email?.trim().toLowerCase() || '';
    const message = body.message?.trim() || '';
    const subject = body.subject?.trim() || null;

    if (!name || !email || !message) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name, email, and message are required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format.',
      });
    }

    if (message.length < 10 || message.length > 5000) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Message must be between 10 and 5000 characters.',
      });
    }

    const contactData: ContactSubmissionInsert = {
      name,
      email,
      subject,
      message,
      status: 'pending',
      metadata: {
        ip: getClientIP(event) || 'unknown',
        userAgent: getHeader(event, 'user-agent') || 'unknown',
        referrer: getHeader(event, 'referer') || 'direct',
        submissionTime: new Date().toISOString(), // or use useNow().toISOString()
      },
    };

    const { data, error } = await supabase
      .from('contact_submissions')
      .insert([contactData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw createError({
        statusCode: 500,
        statusMessage: 'Database insert failed.',
      });
    }

    console.log(`✅ Submission from ${email} (ID: ${data.id})`);

    return {
      success: true,
      message: 'Thanks! Your message has been received.',
      submissionId: data.id,
    };
  } catch (err: any) {
    console.error('❌ Handler error:', err);

    if (err instanceof H3Error || err.statusCode) {
      throw err;
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error.',
    });
  }
});
