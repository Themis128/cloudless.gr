import { createClient } from '@supabase/supabase-js';
import { defineEventHandler, readBody } from 'h3';
import { generateToken } from '../../../utils/auth';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default defineEventHandler(async (event) => {
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
      console.error('Error creating user:', createError);
      return {
        success: false,
        message: 'Failed to create user',
      };
    }

    // Generate session token
    const token = generateToken(newUser.id, newUser.email);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create session
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: newUser.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return {
        success: false,
        message: 'Failed to create session',
      };
    }

    return {
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
      },
      token,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('Error in signup handler:', error);
    return {
      success: false,
      message: 'Internal server error',
    };
  }
});
