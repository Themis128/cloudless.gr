-- Migration: Add authentication fields to profiles table
-- This migration adds the missing authentication-related fields to the profiles table

-- Add missing authentication fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON public.profiles(email_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_failed_login_attempts ON public.profiles(failed_login_attempts);
CREATE INDEX IF NOT EXISTS idx_profiles_locked_until ON public.profiles(locked_until);
CREATE INDEX IF NOT EXISTS idx_profiles_reset_token ON public.profiles(reset_token);

-- Update existing records to have default values
UPDATE public.profiles
SET
    email_verified = false,
    failed_login_attempts = 0
WHERE
    email_verified IS NULL
    OR failed_login_attempts IS NULL;

-- Add constraints
ALTER TABLE public.profiles
ADD CONSTRAINT check_failed_login_attempts_positive
CHECK (failed_login_attempts >= 0);

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN public.profiles.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN public.profiles.locked_until IS 'Timestamp until which the account is locked due to failed login attempts';
COMMENT ON COLUMN public.profiles.last_login IS 'Timestamp of the last successful login';
COMMENT ON COLUMN public.profiles.reset_token IS 'Token for password reset requests';
COMMENT ON COLUMN public.profiles.reset_token_expires IS 'Expiration timestamp for the reset token';
