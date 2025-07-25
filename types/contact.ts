// Contact form related types
export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
  newsletter?: boolean;
  projectType?: 'web' | 'mobile' | 'design' | 'consulting' | 'other';
  budget?: string;
  timeline?: string;
  heardFrom?: string;
}

export interface ContactSubmission {
  id: number; // Changed from string to number to match Prisma auto-increment
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  subject: string;
  message: string;
  newsletter?: boolean | null;
  projectType?: string | null; // 'web' | 'mobile' | 'design' | 'consulting' | 'other'
  budget?: string | null;
  timeline?: string | null;
  heardFrom?: string | null;
  createdAt: Date;
  status: 'new' | 'read' | 'responded' | 'archived' | 'spam';
  notes?: string | null;
  assignedTo?: string | null; // User ID of admin assigned to handle this submission
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: string | null;
}

export interface ContactFormResponse {
  success: boolean;
  message: string;
  submissionId?: number; // Changed from string to number
  error?: ContactFormError;
}

export type ContactFormErrorType =
  | 'invalid_data'
  | 'missing_fields'
  | 'server_error'
  | 'rate_limit'
  | 'spam_detected'
  | 'network_error'
  | 'unknown';

export interface ContactFormError {
  type: ContactFormErrorType;
  message: string;
  fields?: string[];
}

// UseContactUs composable return type
export interface UseContactUsReturn {
  formData: ContactFormData;
  isSubmitting: boolean;
  hasSubmitted: boolean;
  errors: Record<string, string>;
  submitForm: () => Promise<ContactFormResponse>;
  resetForm: () => void;
  validateField: (field: keyof ContactFormData) => boolean;
  validateForm: () => boolean;
}
