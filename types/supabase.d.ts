export {}
/**
 * Supabase Database Types
 * Auto-generated from schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          full_name: string | null
          username: string | null
          avatar_url: string | null
          website: string | null
          bio: string | null
          role: 'user' | 'admin' | 'moderator'
          is_active: boolean
          email_verified: boolean
          failed_login_attempts: number
          locked_until: string | null
          last_login: string | null
          reset_token: string | null
          reset_token_expires: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          website?: string | null
          bio?: string | null
          role?: 'user' | 'admin' | 'moderator'
          is_active?: boolean
          email_verified?: boolean
          failed_login_attempts?: number
          locked_until?: string | null
          last_login?: string | null
          reset_token?: string | null
          reset_token_expires?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          website?: string | null
          bio?: string | null
          role?: 'user' | 'admin' | 'moderator'
          is_active?: boolean
          email_verified?: boolean
          failed_login_attempts?: number
          locked_until?: string | null
          last_login?: string | null
          reset_token?: string | null
          reset_token_expires?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          role: 'admin' | 'user' | 'viewer'
          preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          role?: 'admin' | 'user' | 'viewer'
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          role?: 'admin' | 'user' | 'viewer'
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          type: 'classification' | 'regression' | 'clustering' | 'nlp' | 'cv' | 'recommendation' | 'time-series' | 'custom'
          status: 'draft' | 'active' | 'training' | 'deployed' | 'completed' | 'error' | 'archived' | 'paused'
          config: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          type: 'classification' | 'regression' | 'clustering' | 'nlp' | 'cv' | 'recommendation' | 'time-series' | 'custom'
          status?: 'draft' | 'active' | 'training' | 'deployed' | 'completed' | 'error' | 'archived' | 'paused'
          config?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          type?: 'classification' | 'regression' | 'clustering' | 'nlp' | 'cv' | 'recommendation' | 'time-series' | 'custom'
          status?: 'draft' | 'active' | 'training' | 'deployed' | 'completed' | 'error' | 'archived' | 'paused'
          config?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      pipelines: {
        Row: {
          id: string
          project_id: string
          owner_id: string
          name: string
          description: string | null
          config: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          owner_id: string
          name: string
          description?: string | null
          config: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          owner_id?: string
          name?: string
          description?: string | null
          config?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipelines_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      training_sessions: {
        Row: {
          id: string
          project_id: string
          owner_id: string
          name: string
          config: Json
          status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
          progress: number
          metrics: Json | null
          logs: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          owner_id: string
          name: string
          config: Json
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
          progress?: number
          metrics?: Json | null
          logs?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          owner_id?: string
          name?: string
          config?: Json
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
          progress?: number
          metrics?: Json | null
          logs?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      model_versions: {
        Row: {
          id: string
          project_id: string
          training_session_id: string | null
          owner_id: string
          name: string
          version_tag: string
          description: string | null
          config: Json
          metrics: Json | null
          artifact_url: string | null
          is_deployed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          training_session_id?: string | null
          owner_id: string
          name: string
          version_tag: string
          description?: string | null
          config: Json
          metrics?: Json | null
          artifact_url?: string | null
          is_deployed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          training_session_id?: string | null
          owner_id?: string
          name?: string
          version_tag?: string
          description?: string | null
          config?: Json
          metrics?: Json | null
          artifact_url?: string | null
          is_deployed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_versions_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_versions_training_session_id_fkey"
            columns: ["training_session_id"]
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_versions_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      deployments: {
        Row: {
          id: string
          project_id: string
          model_version_id: string
          owner_id: string
          name: string
          description: string | null
          config: Json
          status: 'pending' | 'deploying' | 'running' | 'stopped' | 'failed' | 'terminated'
          endpoint_url: string | null
          health_check_url: string | null
          logs: string | null
          deployed_at: string | null
          stopped_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          model_version_id: string
          owner_id: string
          name: string
          description?: string | null
          config: Json
          status?: 'pending' | 'deploying' | 'running' | 'stopped' | 'failed' | 'terminated'
          endpoint_url?: string | null
          health_check_url?: string | null
          logs?: string | null
          deployed_at?: string | null
          stopped_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          model_version_id?: string
          owner_id?: string
          name?: string
          description?: string | null
          config?: Json
          status?: 'pending' | 'deploying' | 'running' | 'stopped' | 'failed' | 'terminated'
          endpoint_url?: string | null
          health_check_url?: string | null
          logs?: string | null
          deployed_at?: string | null
          stopped_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_model_version_id_fkey"
            columns: ["model_version_id"]
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      datasets: {
        Row: {
          id: string
          project_id: string
          owner_id: string
          name: string
          description: string | null
          file_path: string
          file_size: number
          format: string
          columns_info: Json | null
          statistics: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          owner_id: string
          name: string
          description?: string | null
          file_path: string
          file_size: number
          format: string
          columns_info?: Json | null
          statistics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          owner_id?: string
          name?: string
          description?: string | null
          file_path?: string
          file_size?: number
          format?: string
          columns_info?: Json | null
          statistics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasets_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datasets_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      experiments: {
        Row: {
          id: string
          training_session_id: string
          owner_id: string
          name: string
          parameters: Json
          metrics: Json | null
          artifacts: Json | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          training_session_id: string
          owner_id: string
          name: string
          parameters: Json
          metrics?: Json | null
          artifacts?: Json | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          training_session_id?: string
          owner_id?: string
          name?: string
          parameters?: Json
          metrics?: Json | null
          artifacts?: Json | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_training_session_id_fkey"
            columns: ["training_session_id"]
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }        ]
      }
      contact_messages: {
        Row: {
          id: string
          name: string
          email: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          message?: string
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          read: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          read?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          read?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier access
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Specific table types
export type Profile = Tables<'profiles'>
export type UserProfile = Tables<'user_profiles'>
export type Project = Tables<'projects'>
export type Pipeline = Tables<'pipelines'>
export type TrainingSession = Tables<'training_sessions'>
export type ModelVersion = Tables<'model_versions'>
export type Deployment = Tables<'deployments'>
export type Dataset = Tables<'datasets'>
export type Experiment = Tables<'experiments'>
export type ContactMessage = Tables<'contact_messages'>
export type Notification = Tables<'notifications'>

// Insert types
export type ProfileInsert = TablesInsert<'profiles'>
export type UserProfileInsert = TablesInsert<'user_profiles'>
export type ProjectInsert = TablesInsert<'projects'>
export type PipelineInsert = TablesInsert<'pipelines'>
export type TrainingSessionInsert = TablesInsert<'training_sessions'>
export type ModelVersionInsert = TablesInsert<'model_versions'>
export type DeploymentInsert = TablesInsert<'deployments'>
export type DatasetInsert = TablesInsert<'datasets'>
export type ExperimentInsert = TablesInsert<'experiments'>
export type ContactMessageInsert = TablesInsert<'contact_messages'>
export type NotificationInsert = TablesInsert<'notifications'>

// Update types
export type ProfileUpdate = TablesUpdate<'profiles'>
export type UserProfileUpdate = TablesUpdate<'user_profiles'>
export type ProjectUpdate = TablesUpdate<'projects'>
export type PipelineUpdate = TablesUpdate<'pipelines'>
export type TrainingSessionUpdate = TablesUpdate<'training_sessions'>
export type ModelVersionUpdate = TablesUpdate<'model_versions'>
export type DeploymentUpdate = TablesUpdate<'deployments'>
export type DatasetUpdate = TablesUpdate<'datasets'>
export type ExperimentUpdate = TablesUpdate<'experiments'>
export type ContactMessageUpdate = TablesUpdate<'contact_messages'>
export type NotificationUpdate = TablesUpdate<'notifications'>
