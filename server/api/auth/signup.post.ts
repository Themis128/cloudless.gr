import { defineEventHandler, readBody } from 'h3';
import { generateToken } from '../../utils/auth-server';
import { getSupabaseServerClient } from '../../../utils/supabase';

export default defineEventHandler(async (event) => {
  const supabase = getSupabaseServerClient();
  try {
    const body = await readBody(event);
    const { email, password, fullName } = body;

    // Validate input
    if (!email || !password) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return {
        success: false,
        message: 'User already exists',
      };
    }

    // Create user
    const { data: newUser, error: createError } = await supabase
      .rpc('create_user', {
        email,
        password,
        full_name: fullName,
      });

    if (createError) {
      return {
        success: false,
        message: createError.message,
      };
    }

    // Generate token (if needed)
    let token = '';
    if (newUser?.id && newUser?.email) {
      token = generateToken(newUser.id, newUser.email);
    }

    return {
      success: true,
      user: newUser,
      token,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Unknown error',
    };
  }
});
