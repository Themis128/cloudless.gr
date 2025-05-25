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

export interface ContactSubmission extends ContactFormData {
  id: string;
  createdAt: Date | string;
  status: 'new' | 'read' | 'responded' | 'archived' | 'spam';
  assignedTo?: string;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ContactFormResponse {
  success: boolean;
  message: string;
  submissionId?: string;
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
