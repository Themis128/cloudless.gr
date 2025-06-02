export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  message: string;
  status: 'New' | 'In Progress' | 'Completed' | 'Archived';
  createdAt: string;
  updatedAt: string;
  notes?: string;
  phone?: string;
  company?: string;
  projectDetails?: string;
}
