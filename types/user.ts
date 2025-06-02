// User-related types for the application
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  avatar?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastLogin?: Date | string;
}

export interface UserProfile extends User {
  bio?: string;
  website?: string;
  company?: string;
  position?: string;
  location?: string;
  phone?: string;
  socialLinks?: {
    github?: string;
    twitter?: string;
    linkedin?: string;
    other?: string;
  };
  preferences?: {
    newsletter: boolean;
    notifications: {
      email: boolean;
      push: boolean;
    };
    theme: 'light' | 'dark' | 'system';
  };
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
