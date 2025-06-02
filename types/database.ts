// Database type definitions for Supabase
export interface Database {
  public: {
    Tables: {
      contact_submissions: {
        Row: {
          id: string;
          name: string;
          email: string;
          subject: string | null;
          message: string;
          status: 'pending' | 'in_progress' | 'resolved' | 'spam';
          metadata: {
            ip: string;
            userAgent: string;
            referrer: string;
            submissionTime: string;
          } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          subject?: string | null;
          message: string;
          status?: 'pending' | 'in_progress' | 'resolved' | 'spam';
          metadata?: {
            ip: string;
            userAgent: string;
            referrer: string;
            submissionTime: string;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          subject?: string | null;
          message?: string;
          status?: 'pending' | 'in_progress' | 'resolved' | 'spam';
          metadata?: {
            ip: string;
            userAgent: string;
            referrer: string;
            submissionTime: string;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      submission_status: 'pending' | 'in_progress' | 'resolved' | 'spam';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Helper types for contact submissions
export type ContactSubmission = Database['public']['Tables']['contact_submissions']['Row'];
export type ContactSubmissionInsert = Database['public']['Tables']['contact_submissions']['Insert'];
export type ContactSubmissionUpdate = Database['public']['Tables']['contact_submissions']['Update'];

// Event handler types for Nuxt server
export interface ContactFormData {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export interface ContactSubmissionMetadata {
  ip: string;
  userAgent: string;
  referrer: string;
  submissionTime: string;
}
