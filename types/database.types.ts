export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      analytics_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          pipeline_id: string
          results: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          pipeline_id: string
          results?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          pipeline_id?: string
          results?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_executions_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_pipelines: {
        Row: {
          config: Json
          created_at: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
          project_id: string | null
          status: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          project_id?: string | null
          status?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          project_id?: string | null
          status?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_pipelines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_steps: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          order_index: number
          pipeline_id: string
          step_type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          order_index: number
          pipeline_id: string
          step_type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          order_index?: number
          pipeline_id?: string
          step_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_steps_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bots: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          connection_config: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_id: string
          project_id: string | null
          sample_data: Json | null
          schema_info: Json | null
          source_type: string
          updated_at: string | null
        }
        Insert: {
          connection_config?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_id: string
          project_id?: string | null
          sample_data?: Json | null
          schema_info?: Json | null
          source_type: string
          updated_at?: string | null
        }
        Update: {
          connection_config?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string
          project_id?: string | null
          sample_data?: Json | null
          schema_info?: Json | null
          source_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deployment_metrics: {
        Row: {
          collected_at: string | null
          deployment_id: string
          id: string
          metrics: Json
        }
        Insert: {
          collected_at?: string | null
          deployment_id: string
          id?: string
          metrics?: Json
        }
        Update: {
          collected_at?: string | null
          deployment_id?: string
          id?: string
          metrics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "deployment_metrics_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments: {
        Row: {
          config: Json | null
          created_at: string | null
          endpoint_url: string | null
          id: string
          model_version_id: string | null
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          endpoint_url?: string | null
          id?: string
          model_version_id?: string | null
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          endpoint_url?: string | null
          id?: string
          model_version_id?: string | null
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_deployments_model_version_id"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          new_email: string | null
          token: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          new_email?: string | null
          token: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          new_email?: string | null
          token?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      model_versions: {
        Row: {
          created_at: string | null
          id: string
          is_deployed: boolean | null
          metrics: Json | null
          model_path: string | null
          project_id: string | null
          training_session_id: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_deployed?: boolean | null
          metrics?: Json | null
          model_path?: string | null
          project_id?: string | null
          training_session_id?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_deployed?: boolean | null
          metrics?: Json | null
          model_path?: string | null
          project_id?: string | null
          training_session_id?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_model_versions_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_model_versions_training_session_id"
            columns: ["training_session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pipeline_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          executed_by: string
          id: string
          logs: string | null
          pipeline_id: string | null
          results: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          executed_by: string
          id?: string
          logs?: string | null
          pipeline_id?: string | null
          results?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          executed_by?: string
          id?: string
          logs?: string | null
          pipeline_id?: string | null
          results?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_executions_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_step_executions: {
        Row: {
          completed_at: string | null
          duration_seconds: number | null
          error_message: string | null
          execution_id: string | null
          id: string
          input_data: Json | null
          logs: string | null
          output_data: Json | null
          started_at: string | null
          status: string | null
          step_id: string | null
        }
        Insert: {
          completed_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          input_data?: Json | null
          logs?: string | null
          output_data?: Json | null
          started_at?: string | null
          status?: string | null
          step_id?: string | null
        }
        Update: {
          completed_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          input_data?: Json | null
          logs?: string | null
          output_data?: Json | null
          started_at?: string | null
          status?: string | null
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_step_executions_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "pipeline_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_step_executions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "pipeline_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_steps: {
        Row: {
          config: Json
          created_at: string | null
          description: string | null
          id: string
          is_configured: boolean | null
          name: string
          pipeline_id: string | null
          position: number
          step_type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_configured?: boolean | null
          name: string
          pipeline_id?: string | null
          position: number
          step_type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_configured?: boolean | null
          name?: string
          pipeline_id?: string | null
          position?: number
          step_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_steps_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          config: Json
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_id: string
          project_id: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_id: string
          project_id: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string
          project_id?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          email_confirmed: boolean | null
          email_verification_token: string | null
          email_verified: boolean | null
          failed_login_attempts: number | null
          first_name: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          last_name: string | null
          last_sign_in_at: string | null
          location: string | null
          locked_until: string | null
          preferences: Json | null
          reset_token: string | null
          reset_token_expires: string | null
          role: string
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          failed_login_attempts?: number | null
          first_name?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          last_login?: string | null
          last_name?: string | null
          last_sign_in_at?: string | null
          location?: string | null
          locked_until?: string | null
          preferences?: Json | null
          reset_token?: string | null
          reset_token_expires?: string | null
          role?: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          failed_login_attempts?: number | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          last_name?: string | null
          last_sign_in_at?: string | null
          location?: string | null
          locked_until?: string | null
          preferences?: Json | null
          reset_token?: string | null
          reset_token_expires?: string | null
          role?: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      project_collaborators: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          config: Json | null
          created_at: string | null
          description: string | null
          framework: string | null
          id: string
          name: string
          owner_id: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          framework?: string | null
          id?: string
          name: string
          owner_id?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          framework?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_owner_id"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "migrated_users_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_owner_id"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_metrics: {
        Row: {
          epoch: number
          id: string
          metrics: Json
          step: number | null
          timestamp: string | null
          training_session_id: string
        }
        Insert: {
          epoch: number
          id?: string
          metrics?: Json
          step?: number | null
          timestamp?: string | null
          training_session_id: string
        }
        Update: {
          epoch?: number
          id?: string
          metrics?: Json
          step?: number | null
          timestamp?: string | null
          training_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_metrics_training_session_id_fkey"
            columns: ["training_session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          completed_at: string | null
          config: Json | null
          created_at: string | null
          id: string
          logs: string | null
          metrics: Json | null
          name: string
          project_id: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          logs?: string | null
          metrics?: Json | null
          name: string
          project_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          logs?: string | null
          metrics?: Json | null
          name?: string
          project_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_training_sessions_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          preferences: Json | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          expires_at: string | null
          id: string
          ip_address: unknown | null
          is_active: boolean | null
          last_activity: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      userinfo: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_userinfo_profiles_id"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "migrated_users_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_userinfo_profiles_id"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_rules: {
        Row: {
          created_at: string | null
          field_name: string | null
          id: string
          is_active: boolean | null
          rule_config: Json
          rule_type: string
          step_id: string | null
        }
        Insert: {
          created_at?: string | null
          field_name?: string | null
          id?: string
          is_active?: boolean | null
          rule_config?: Json
          rule_type: string
          step_id?: string | null
        }
        Update: {
          created_at?: string | null
          field_name?: string | null
          id?: string
          is_active?: boolean | null
          rule_config?: Json
          rule_type?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validation_rules_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "pipeline_steps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      migrated_users_summary: {
        Row: {
          auth_created_at: string | null
          auth_status: string | null
          email: string | null
          email_verified: boolean | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          last_sign_in_at: string | null
          role: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      clear_reset_token: {
        Args: { user_email: string }
        Returns: undefined
      }
      generate_reset_token: {
        Args: { user_email: string }
        Returns: string
      }
      greek_now: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      greek_time_text: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      increment_failed_login: {
        Args: { user_email: string }
        Returns: undefined
      }
      is_user_locked: {
        Args: { user_email: string }
        Returns: boolean
      }
      log_user_activity: {
        Args: {
          user_id: string
          action: string
          resource_type?: string
          resource_id?: string
          old_values?: Json
          new_values?: Json
          details?: Json
        }
        Returns: undefined
      }
      now_greek: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      reset_failed_login: {
        Args: { user_email: string }
        Returns: undefined
      }
      to_greek_time: {
        Args: { input_timestamp: string }
        Returns: string
      }
      verify_reset_token: {
        Args: { token: string }
        Returns: {
          user_id: string
          email: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      deployment_status:
        | "pending"
        | "deploying"
        | "active"
        | "inactive"
        | "failed"
        | "terminated"
      project_status:
        | "draft"
        | "active"
        | "training"
        | "deployed"
        | "completed"
        | "error"
        | "archived"
        | "paused"
      project_type:
        | "classification"
        | "regression"
        | "clustering"
        | "nlp"
        | "cv"
        | "recommendation"
        | "time-series"
        | "custom"
      training_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "stopped"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      deployment_status: [
        "pending",
        "deploying",
        "active",
        "inactive",
        "failed",
        "terminated",
      ],
      project_status: [
        "draft",
        "active",
        "training",
        "deployed",
        "completed",
        "error",
        "archived",
        "paused",
      ],
      project_type: [
        "classification",
        "regression",
        "clustering",
        "nlp",
        "cv",
        "recommendation",
        "time-series",
        "custom",
      ],
      training_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
        "stopped",
      ],
    },
  },
} as const
