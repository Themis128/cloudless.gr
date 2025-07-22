// User-related types for the application
export interface User {
  id: string; // CUID from Prisma
  email: string;
  name: string;
  role: 'user' | 'admin';
  avatar?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date | null;
  // Profile fields from Prisma
  bio?: string | null;
  website?: string | null;
  company?: string | null;
  position?: string | null;
  location?: string | null;
  phone?: string | null;
  socialLinks?: string | null; // JSON string
  preferences?: string | null; // JSON string
}

// Parsed interfaces for JSON fields
export interface SocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  other?: string;
}

export interface UserPreferences {
  newsletter: boolean;
  notifications: {
    email: boolean;
    push: boolean;
  };
  theme: 'light' | 'dark' | 'system';
}

export interface UserProfile extends User {
  // Helper methods to parse JSON fields
  parsedSocialLinks?: SocialLinks;
  parsedPreferences?: UserPreferences;
}

export interface UserAuth {
  isLoggedIn: boolean;
  currentUser: User | null;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, name: string) => Promise<User>;
  logout: () => void;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials extends LoginCredentials {
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: string;
}

// Auth error types
export type AuthErrorType = 
  | 'invalid_credentials' 
  | 'user_not_found' 
  | 'email_exists' 
  | 'weak_password'
  | 'invalid_token'
  | 'expired_token'
  | 'server_error'
  | 'network_error'
  | 'unknown';

export interface AuthError {
  type: AuthErrorType;
  message: string;
}
