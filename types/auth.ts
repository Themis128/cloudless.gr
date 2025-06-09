import type { Provider, User } from '@supabase/supabase-js';
import type { UserProfile } from './user';

export interface AuthError {
  message: string;
  type: 'validation' | 'network' | 'auth' | 'rate_limit' | 'unknown';
  provider?: string;
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: any;
  loading: boolean;
  error: AuthError | null;
  success: string | null;
  socialLoading: Provider | null;
}
