export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
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
          reset_token?: string | null
          reset_token_expires?: string | null
          role?: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
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
            referencedRelation: "profiles"
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
      [_ in never]: never
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
          p_user_id: string
          p_action: string
          p_resource_type?: string
          p_resource_id?: string
          p_old_values?: Json
          p_new_values?: Json
        }
        Returns: string
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_object: {
        Args: { bucketid: string; name: string; owner: string; metadata: Json }
        Returns: undefined
      }
      extension: {
        Args: { name: string }
        Returns: string
      }
      filename: {
        Args: { name: string }
        Returns: string
      }
      foldername: {
        Args: { name: string }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
        }
        Returns: {
          key: string
          id: string
          created_at: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          start_after?: string
          next_token?: string
        }
        Returns: {
          name: string
          id: string
          metadata: Json
          updated_at: string
        }[]
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {},
  },
} as const
