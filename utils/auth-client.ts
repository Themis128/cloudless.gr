/**
 * Client-side authentication utilities
 * These functions can safely run in the browser
 */

/**
 * Validate email format
 * @param email The email to validate
 * @returns True if valid, false otherwise
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param password The password to validate
 * @returns True if valid, false otherwise
 */
export const validatePassword = (password: string): boolean => {
  // Require at least 8 characters with uppercase, lowercase, and numbers
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Check if password meets minimum requirements
 * @param password The password to check
 * @returns Object with validation results
 */
export const getPasswordStrength = (password: string) => {
  return {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[@$!%*?&]/.test(password),
    isValid: validatePassword(password)
  };
};

/**
 * Format user display name
 * @param user User object with potential name fields
 * @returns Formatted display name
 */
export const formatUserDisplayName = (user: any): string => {
  if (user?.user_metadata?.full_name) {
    return user.user_metadata.full_name;
  }
  
  if (user?.user_metadata?.first_name || user?.user_metadata?.last_name) {
    return `${user.user_metadata.first_name || ''} ${user.user_metadata.last_name || ''}`.trim();
  }
  
  if (user?.email) {
    return user.email.split('@')[0];
  }
  
  return 'User';
};

/**
 * Get user initials for avatar
 * @param user User object
 * @returns User initials (2 characters max)
 */
export const getUserInitials = (user: any): string => {
  const name = formatUserDisplayName(user);
  
  if (name === 'User') {
    return user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  }
  
  const parts = name.split(' ').filter(part => part.length > 0);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  
  return parts[0]?.charAt(0).toUpperCase() || 'U';
};
