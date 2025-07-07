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
          query?: string
          operationName?: string
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
      audit_log: {
        Row: {
          changed_at: string
          changed_data: Json | null
          id: number
          operation: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_data?: Json | null
          id?: number
          operation: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_data?: Json | null
          id?: number
          operation?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      datasets: {
        Row: {
          columns_info: Json | null
          created_at: string
          description: string | null
          file_path: string
          file_size: number
          format: string
          id: string
          name: string
          owner_id: string
          project_id: string
          statistics: Json | null
          updated_at: string
        }
        Insert: {
          columns_info?: Json | null
          created_at?: string
          description?: string | null
          file_path: string
          file_size: number
          format: string
          id?: string
          name: string
          owner_id: string
          project_id: string
          statistics?: Json | null
          updated_at?: string
        }
        Update: {
          columns_info?: Json | null
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number
          format?: string
          id?: string
          name?: string
          owner_id?: string
          project_id?: string
          statistics?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_datasets_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_datasets_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments: {
        Row: {
          config: Json
          created_at: string
          deployed_at: string | null
          description: string | null
          endpoint_url: string | null
          health_check_url: string | null
          id: string
          logs: string | null
          model_version_id: string
          name: string
          owner_id: string
          project_id: string
          status: string
          stopped_at: string | null
          updated_at: string
        }
        Insert: {
          config: Json
          created_at?: string
          deployed_at?: string | null
          description?: string | null
          endpoint_url?: string | null
          health_check_url?: string | null
          id?: string
          logs?: string | null
          model_version_id: string
          name: string
          owner_id: string
          project_id: string
          status?: string
          stopped_at?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          deployed_at?: string | null
          description?: string | null
          endpoint_url?: string | null
          health_check_url?: string | null
          id?: string
          logs?: string | null
          model_version_id?: string
          name?: string
          owner_id?: string
          project_id?: string
          status?: string
          stopped_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_deployments_model_version"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_deployments_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_deployments_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          artifacts: Json | null
          completed_at: string | null
          created_at: string
          id: string
          metrics: Json | null
          name: string
          owner_id: string
          parameters: Json
          started_at: string | null
          training_session_id: string
          updated_at: string
        }
        Insert: {
          artifacts?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          metrics?: Json | null
          name: string
          owner_id: string
          parameters: Json
          started_at?: string | null
          training_session_id: string
          updated_at?: string
        }
        Update: {
          artifacts?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          metrics?: Json | null
          name?: string
          owner_id?: string
          parameters?: Json
          started_at?: string | null
          training_session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_experiments_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_experiments_training_session"
            columns: ["training_session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          artifact_url: string | null
          config: Json
          created_at: string
          description: string | null
          id: string
          is_deployed: boolean
          metrics: Json | null
          name: string
          owner_id: string
          project_id: string
          training_session_id: string | null
          updated_at: string
          version_tag: string
        }
        Insert: {
          artifact_url?: string | null
          config: Json
          created_at?: string
          description?: string | null
          id?: string
          is_deployed?: boolean
          metrics?: Json | null
          name: string
          owner_id: string
          project_id: string
          training_session_id?: string | null
          updated_at?: string
          version_tag: string
        }
        Update: {
          artifact_url?: string | null
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_deployed?: boolean
          metrics?: Json | null
          name?: string
          owner_id?: string
          project_id?: string
          training_session_id?: string | null
          updated_at?: string
          version_tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_model_versions_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_model_versions_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_model_versions_training_session"
            columns: ["training_session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          config: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pipelines_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pipelines_project"
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
          email: string
          email_verified: boolean
          failed_login_attempts: number
          first_name: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_login: string | null
          last_name: string | null
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
          email?: string
          email_verified?: boolean
          failed_login_attempts?: number
          first_name?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login?: string | null
          last_name?: string | null
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
          email?: string
          email_verified?: boolean
          failed_login_attempts?: number
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login?: string | null
          last_name?: string | null
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
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          completed: boolean
          created_at: string | null
          id: string
          title: string
        }
        Insert: {
          completed?: boolean
          created_at?: string | null
          id?: string
          title: string
        }
        Update: {
          completed?: boolean
          created_at?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      training_logs: {
        Row: {
          details: Json | null
          event_type: string
          id: string
          timestamp: string | null
          user_id: string
        }
        Insert: {
          details?: Json | null
          event_type: string
          id?: string
          timestamp?: string | null
          user_id: string
        }
        Update: {
          details?: Json | null
          event_type?: string
          id?: string
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          completed_at: string | null
          config: Json
          created_at: string
          id: string
          logs: string | null
          metrics: Json | null
          name: string
          owner_id: string
          progress: number
          project_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          config: Json
          created_at?: string
          id?: string
          logs?: string | null
          metrics?: Json | null
          name: string
          owner_id: string
          progress?: number
          project_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          id?: string
          logs?: string | null
          metrics?: Json | null
          name?: string
          owner_id?: string
          progress?: number
          project_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_training_sessions_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_training_sessions_project"
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
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          preferences: Json | null
          role: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          preferences?: Json | null
          role?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferences?: Json | null
          role?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      "user-info": {
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      execute_sql: {
        Args: { query: string; read_only?: boolean }
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
} as const

