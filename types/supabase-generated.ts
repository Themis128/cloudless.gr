export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          message: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          message: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          message?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      deployments: {
        Row: {
          id: string;
          project_id: string | null;
          model_version_id: string | null;
          owner_id: string;
          name: string;
          description: string | null;
          status:
            | 'deployments'
            | 'running'
            | 'stopped'
            | 'failed'
            | 'pending'
            | 'terminated'
            | null;
          environment: 'development' | 'staging' | 'production';
          endpoint_url: string | null;
          config: Json;
          resources: Json | null;
          logs: string | null;
          started_at: string | null;
          stopped_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          model_version_id?: string | null;
          owner_id: string;
          name: string;
          description?: string | null;
          status?:
            | 'deployments'
            | 'running'
            | 'stopped'
            | 'failed'
            | 'pending'
            | 'terminated'
            | null;
          environment: 'development' | 'staging' | 'production';
          endpoint_url?: string | null;
          config?: Json;
          resources?: Json | null;
          logs?: string | null;
          started_at?: string | null;
          stopped_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          model_version_id?: string | null;
          owner_id?: string;
          name?: string;
          description?: string | null;
          status?:
            | 'deployments'
            | 'running'
            | 'stopped'
            | 'failed'
            | 'pending'
            | 'terminated'
            | null;
          environment?: 'development' | 'staging' | 'production';
          endpoint_url?: string | null;
          config?: Json;
          resources?: Json | null;
          logs?: string | null;
          started_at?: string | null;
          stopped_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'deployments_model_version_id_fkey';
            columns: ['model_version_id'];
            isOneToOne: false;
            referencedRelation: 'model_versions';
            referencedColumns: ['id'];
          },
        ];
      };
      model_versions: {
        Row: {
          id: string;
          project_id: string | null;
          training_session_id: string | null;
          version: string;
          model_path: string | null;
          metrics: Json;
          is_deployed: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          training_session_id?: string | null;
          version: string;
          model_path?: string | null;
          metrics?: Json;
          is_deployed?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          training_session_id?: string | null;
          version?: string;
          model_path?: string | null;
          metrics?: Json;
          is_deployed?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'model_versions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'model_versions_training_session_id_fkey';
            columns: ['training_session_id'];
            isOneToOne: false;
            referencedRelation: 'training_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          role: string;
          created_at: string | null;
          updated_at: string | null;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          email_verified: boolean | null;
          last_login: string | null;
          failed_login_attempts: number | null;
          locked_until: string | null;
          reset_token: string | null;
          reset_token_expires: string | null;
          email_verification_token: string | null;
          is_active: boolean | null;
          is_admin: boolean | null;
        };
        Insert: {
          id: string;
          role?: string;
          created_at?: string | null;
          updated_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          email_verified?: boolean | null;
          last_login?: string | null;
          failed_login_attempts?: number | null;
          locked_until?: string | null;
          reset_token?: string | null;
          reset_token_expires?: string | null;
          email_verification_token?: string | null;
          is_active?: boolean | null;
          is_admin?: boolean | null;
        };
        Update: {
          id?: string;
          role?: string;
          created_at?: string | null;
          updated_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          email_verified?: boolean | null;
          last_login?: string | null;
          failed_login_attempts?: number | null;
          locked_until?: string | null;
          reset_token?: string | null;
          reset_token_expires?: string | null;
          email_verification_token?: string | null;
          is_active?: boolean | null;
          is_admin?: boolean | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          type: 'cv' | 'nlp' | 'regression' | 'recommendation' | 'time-series' | 'custom' | null;
          framework: string | null;
          config: Json;
          owner_id: string | null;
          status:
            | 'active'
            | 'training'
            | 'deployed'
            | 'paused'
            | 'draft'
            | 'archived'
            | 'error'
            | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          type?: 'cv' | 'nlp' | 'regression' | 'recommendation' | 'time-series' | 'custom' | null;
          framework?: string | null;
          config?: Json;
          owner_id?: string | null;
          status?:
            | 'active'
            | 'training'
            | 'deployed'
            | 'paused'
            | 'draft'
            | 'archived'
            | 'error'
            | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          type?: 'cv' | 'nlp' | 'regression' | 'recommendation' | 'time-series' | 'custom' | null;
          framework?: string | null;
          config?: Json;
          owner_id?: string | null;
          status?:
            | 'active'
            | 'training'
            | 'deployed'
            | 'paused'
            | 'draft'
            | 'archived'
            | 'error'
            | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      training_sessions: {
        Row: {
          id: string;
          project_id: string | null;
          owner_id: string;
          name: string;
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'stopped' | null;
          config: Json;
          progress: number;
          metrics: Json;
          logs: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          owner_id: string;
          name: string;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'stopped' | null;
          config?: Json;
          progress?: number;
          metrics?: Json;
          logs?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          owner_id?: string;
          name?: string;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'stopped' | null;
          config?: Json;
          progress?: number;
          metrics?: Json;
          logs?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'training_sessions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      userinfo: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
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
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[keyof Database];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never;
