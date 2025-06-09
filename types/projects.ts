// Project-related types for the application
import type { Ref } from 'vue';

export interface Project {
  id: number;
  project_name: string;
  slug: string;
  overview: string;
  description: string;
  isFavorite: boolean;
  live_url?: string;
  github_url?: string;
  tech_tags: ProjectTag[];
  images: ProjectImage[];
  status: ProjectStatus;
  category: ProjectCategory;
  client?: string;
  clientLogo?: string;
  featured: boolean;
  completionDate?: string;
  duration?: string;
  teamSize?: number;
  testimonial?: Testimonial;
  relatedProjects?: number[]; // IDs of related projects
  createdAt: string;
  updatedAt: string;
}

export type ProjectImage = {
  img_name: string;
  img_url: string;
  is_thumbnail: boolean;
  alt?: string;
  caption?: string;
  order?: number;
};

export type ProjectTag = {
  tag_name: string;
  is_primary: boolean;
  color?: string;
};

export type ProjectStatus = 'draft' | 'published' | 'archived' | 'featured';

export type ProjectCategory =
  | 'web-development'
  | 'mobile-app'
  | 'design'
  | 'cloud-infrastructure'
  | 'machine-learning'
  | 'devops'
  | 'consulting'
  | 'other';

export interface Testimonial {
  quote: string;
  author: string;
  position?: string;
  company?: string;
  avatar?: string;
  rating?: number; // 1-5
}

export interface ProjectFilter {
  category?: ProjectCategory;
  tags?: string[];
  status?: ProjectStatus;
  featured?: boolean;
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'name' | 'popular';
}

export interface ProjectsState {
  projects: Project[];
  featuredProjects: Project[];
  loading: boolean;
  error: string | null;
  filters: ProjectFilter;
  currentProject: Project | null;
}

export interface UseProjectsComposable {
  projects: Ref<Project[]>;
  featuredProjects: Ref<Project[]>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  fetchProjects: (filter?: ProjectFilter) => Promise<void>;
  fetchProjectBySlug: (slug: string) => Promise<Project | null>;
  toggleFavorite: (id: number) => Promise<void>;
  getRelatedProjects: (project: Project) => Project[];
}
