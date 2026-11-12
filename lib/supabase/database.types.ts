export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      course_categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          category_id: string | null;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          estimated_hours: number | null;
          finished_on: string | null;
          id: string;
          obsidian_note: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          progress_pct: number;
          provider: string | null;
          started_on: string | null;
          status: Database["public"]["Enums"]["course_status"];
          title: string;
          updated_at: string;
          url: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category_id?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          estimated_hours?: number | null;
          finished_on?: string | null;
          id?: string;
          obsidian_note?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"];
          progress_pct?: number;
          provider?: string | null;
          started_on?: string | null;
          status?: Database["public"]["Enums"]["course_status"];
          title: string;
          updated_at?: string;
          url?: string | null;
          user_id?: string;
        };
        Update: {
          category_id?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          estimated_hours?: number | null;
          finished_on?: string | null;
          id?: string;
          obsidian_note?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"];
          progress_pct?: number;
          provider?: string | null;
          started_on?: string | null;
          status?: Database["public"]["Enums"]["course_status"];
          title?: string;
          updated_at?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courses_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "course_categories";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      income_sources: {
        Row: {
          active: boolean;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          default_amount_cents: number | null;
          id: string;
          kind: Database["public"]["Enums"]["income_kind"];
          name: string;
          payday: number | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          context: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          default_amount_cents?: number | null;
          id?: string;
          kind: Database["public"]["Enums"]["income_kind"];
          name: string;
          payday?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          active?: boolean;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          default_amount_cents?: number | null;
          id?: string;
          kind?: Database["public"]["Enums"]["income_kind"];
          name?: string;
          payday?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      incomes: {
        Row: {
          amount_cents: number;
          competence_month: string;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          description: string | null;
          gross_cents: number | null;
          id: string;
          kind: Database["public"]["Enums"]["income_kind"];
          received_on: string | null;
          source_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          competence_month: string;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          description?: string | null;
          gross_cents?: number | null;
          id?: string;
          kind?: Database["public"]["Enums"]["income_kind"];
          received_on?: string | null;
          source_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          amount_cents?: number;
          competence_month?: string;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          description?: string | null;
          gross_cents?: number | null;
          id?: string;
          kind?: Database["public"]["Enums"]["income_kind"];
          received_on?: string | null;
          source_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "incomes_source_id_user_id_fkey";
            columns: ["source_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "income_sources";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      user_settings: {
        Row: {
          active_context: string;
          obsidian_vault: string | null;
          safe_base_months: number;
          theme: string;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active_context?: string;
          obsidian_vault?: string | null;
          safe_base_months?: number;
          theme?: string;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          active_context?: string;
          obsidian_vault?: string | null;
          safe_base_months?: number;
          theme?: string;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      income_series: {
        Args: { p_context?: string; p_months?: number; p_today?: string };
        Returns: {
          guaranteed_cents: number;
          month: string;
          total_cents: number;
          variable_cents: number;
        }[];
      };
      safe_monthly_base: {
        Args: { p_context?: string; p_months?: number; p_today?: string };
        Returns: {
          guaranteed_cents: number;
          months_considered: number;
          months_with_income: number;
          safe_base_cents: number;
          variable_floor_cents: number;
        }[];
      };
    };
    Enums: {
      context_kind: "personal" | "work" | "freelance";
      course_status: "backlog" | "in_progress" | "paused" | "done" | "dropped";
      income_kind: "guaranteed" | "variable";
      priority_level: "low" | "medium" | "high" | "critical";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      context_kind: ["personal", "work", "freelance"],
      course_status: ["backlog", "in_progress", "paused", "done", "dropped"],
      income_kind: ["guaranteed", "variable"],
      priority_level: ["low", "medium", "high", "critical"],
    },
  },
} as const;
