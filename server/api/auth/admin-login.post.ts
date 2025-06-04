import { defineEventHandler, readBody, createError } from 'h3';
import { supabase } from '../../../utils/supabase';

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.warn('Admin credentials not configured in environment variables');
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password } = body;

  // For development, check against env vars
  if (process.env.NODE_ENV === 'development') {
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      return {
        success: true,
        message: 'Admin login successful',
        user: {
          id: 'dev-admin',
          email: process.env.ADMIN_EMAIL,
          role: 'admin',
        },
      };
    }
  }

  // For production, check against admin_users table
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id, email, password_hash')
    .eq('email', email)
    .single();

  if (!adminUser) {
    return {
      success: false,
      message: 'Invalid credentials',
    };
  }

  // Verify password
  const { data: validPass } = await supabase.rpc('check_password', {
    input_password: password,
    stored_hash: adminUser.password_hash,
  });

  if (!validPass) {
    return {
      success: false,
      message: 'Invalid credentials',
    };
  }

  // Update last login
  await supabase
    .from('admin_users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', adminUser.id);

  return {
    success: true,
    message: 'Admin login successful',
    user: {
      id: adminUser.id,
      email: adminUser.email,
      role: 'admin',
    },
  };
});
