type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]
export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Row: infer R }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never

// Refactored: Enums utility type references public schema only
// Removed broken Enums utility type. Use enum values directly from Database["public"]["Enums"] where needed.

// CompositeTypes utility type removed: not needed and not supported by schema


// Utility type to remove internal Supabase metadata
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
// Supabase type definitions for cloudless.gr

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)";
  };
  public: {
    Tables: {
      bots: {
        Row: {
          id: string;
          name: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      models: {
        Row: {
          id: string;
          name: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      pipelines: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          project_id: string;
          config: Json;
          description: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          version: number | null;
          model: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          project_id: string;
          config?: Json;
          description?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          version?: number | null;
          model?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          project_id?: string;
          config?: Json;
          description?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          version?: number | null;
          model?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pipelines_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      // ... Add other tables here as needed ...
    };
    Views: {};
    Functions: {};
    Enums: {
      deployment_status:
        | "pending"
        | "deploying"
        | "active"
        | "inactive"
        | "failed"
        | "terminated";
      project_status:
        | "draft"
        | "active"
        | "training"
        | "deployed"
        | "completed"
        | "error"
        | "archived"
        | "paused";
      project_type:
        | "classification"
        | "regression"
        | "clustering"
        | "nlp"
        | "cv"
        | "recommendation"
        | "time-series"
        | "custom";
      training_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "stopped";
    };
    CompositeTypes: {};
  };
};

