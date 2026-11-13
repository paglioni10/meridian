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
      category_rules: {
        Row: {
          category_id: string;
          created_at: string;
          id: string;
          pattern: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          id?: string;
          pattern: string;
          user_id?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          id?: string;
          pattern?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      clients: {
        Row: {
          company: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          company?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          company?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
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
      deals: {
        Row: {
          client_id: string;
          closed_at: string | null;
          created_at: string;
          expected_close_on: string | null;
          id: string;
          income_id: string | null;
          lost_reason: string | null;
          position: number;
          stage: Database["public"]["Enums"]["deal_stage"];
          title: string;
          updated_at: string;
          user_id: string;
          value_cents: number | null;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          closed_at?: string | null;
          created_at?: string;
          expected_close_on?: string | null;
          id?: string;
          income_id?: string | null;
          lost_reason?: string | null;
          position?: number;
          stage?: Database["public"]["Enums"]["deal_stage"];
          title: string;
          updated_at?: string;
          user_id?: string;
          value_cents?: number | null;
        };
        Update: {
          client_id?: string;
          closed_at?: string | null;
          created_at?: string;
          expected_close_on?: string | null;
          id?: string;
          income_id?: string | null;
          lost_reason?: string | null;
          position?: number;
          stage?: Database["public"]["Enums"]["deal_stage"];
          title?: string;
          updated_at?: string;
          user_id?: string;
          value_cents?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "deals_client_id_user_id_fkey";
            columns: ["client_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "deals_income_id_user_id_fkey";
            columns: ["income_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "incomes";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      expense_categories: {
        Row: {
          created_at: string;
          id: string;
          monthly_budget_cents: number | null;
          name: string;
          nature: Database["public"]["Enums"]["expense_nature"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          monthly_budget_cents?: number | null;
          name: string;
          nature?: Database["public"]["Enums"]["expense_nature"];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          monthly_budget_cents?: number | null;
          name?: string;
          nature?: Database["public"]["Enums"]["expense_nature"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount_cents: number;
          category_id: string | null;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          dedupe_hash: string | null;
          description: string;
          description_normalized: string;
          external_id: string | null;
          id: string;
          import_batch_id: string | null;
          nature: Database["public"]["Enums"]["expense_nature"];
          occurred_on: string;
          project_id: string | null;
          recurring_expense_id: string | null;
          source: Database["public"]["Enums"]["expense_source"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          category_id?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          dedupe_hash?: string | null;
          description: string;
          description_normalized: string;
          external_id?: string | null;
          id?: string;
          import_batch_id?: string | null;
          nature?: Database["public"]["Enums"]["expense_nature"];
          occurred_on: string;
          project_id?: string | null;
          recurring_expense_id?: string | null;
          source?: Database["public"]["Enums"]["expense_source"];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          amount_cents?: number;
          category_id?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          dedupe_hash?: string | null;
          description?: string;
          description_normalized?: string;
          external_id?: string | null;
          id?: string;
          import_batch_id?: string | null;
          nature?: Database["public"]["Enums"]["expense_nature"];
          occurred_on?: string;
          project_id?: string | null;
          recurring_expense_id?: string | null;
          source?: Database["public"]["Enums"]["expense_source"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "expenses_import_batch_id_user_id_fkey";
            columns: ["import_batch_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "expenses_project_fk";
            columns: ["project_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "expenses_recurring_expense_id_user_id_fkey";
            columns: ["recurring_expense_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "recurring_expenses";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      goal_contributions: {
        Row: {
          amount_cents: number;
          contributed_on: string;
          created_at: string;
          goal_id: string;
          id: string;
          note: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          contributed_on?: string;
          created_at?: string;
          goal_id: string;
          id?: string;
          note?: string | null;
          user_id?: string;
        };
        Update: {
          amount_cents?: number;
          contributed_on?: string;
          created_at?: string;
          goal_id?: string;
          id?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_user_id_fkey";
            columns: ["goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      goal_milestones: {
        Row: {
          created_at: string;
          done_at: string | null;
          goal_id: string;
          id: string;
          position: number;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          done_at?: string | null;
          goal_id: string;
          id?: string;
          position?: number;
          title: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          done_at?: string | null;
          goal_id?: string;
          id?: string;
          position?: number;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_milestones_goal_id_user_id_fkey";
            columns: ["goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      goals: {
        Row: {
          achieved_at: string | null;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          description: string | null;
          horizon: Database["public"]["Enums"]["goal_horizon"];
          id: string;
          position: number;
          status: Database["public"]["Enums"]["goal_status"];
          target_cents: number | null;
          target_date: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          achieved_at?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          description?: string | null;
          horizon: Database["public"]["Enums"]["goal_horizon"];
          id?: string;
          position?: number;
          status?: Database["public"]["Enums"]["goal_status"];
          target_cents?: number | null;
          target_date?: string | null;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          achieved_at?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          description?: string | null;
          horizon?: Database["public"]["Enums"]["goal_horizon"];
          id?: string;
          position?: number;
          status?: Database["public"]["Enums"]["goal_status"];
          target_cents?: number | null;
          target_date?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          created_at: string;
          file_sha256: string;
          filename: string;
          format: Database["public"]["Enums"]["import_format"];
          id: string;
          income_rows: number;
          inserted_rows: number;
          period_end: string | null;
          period_start: string | null;
          skipped_rows: number;
          total_rows: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          file_sha256: string;
          filename: string;
          format: Database["public"]["Enums"]["import_format"];
          id?: string;
          income_rows?: number;
          inserted_rows?: number;
          period_end?: string | null;
          period_start?: string | null;
          skipped_rows?: number;
          total_rows?: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          file_sha256?: string;
          filename?: string;
          format?: Database["public"]["Enums"]["import_format"];
          id?: string;
          income_rows?: number;
          inserted_rows?: number;
          period_end?: string | null;
          period_start?: string | null;
          skipped_rows?: number;
          total_rows?: number;
          user_id?: string;
        };
        Relationships: [];
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
          import_batch_id: string | null;
          import_hash: string | null;
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
          import_batch_id?: string | null;
          import_hash?: string | null;
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
          import_batch_id?: string | null;
          import_hash?: string | null;
          kind?: Database["public"]["Enums"]["income_kind"];
          received_on?: string | null;
          source_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "incomes_import_batch_fk";
            columns: ["import_batch_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "incomes_source_id_user_id_fkey";
            columns: ["source_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "income_sources";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      projects: {
        Row: {
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          deal_id: string | null;
          description: string | null;
          due_on: string | null;
          id: string;
          name: string;
          status: Database["public"]["Enums"]["project_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          deal_id?: string | null;
          description?: string | null;
          due_on?: string | null;
          id?: string;
          name: string;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          deal_id?: string | null;
          description?: string | null;
          due_on?: string | null;
          id?: string;
          name?: string;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_deal_id_user_id_fkey";
            columns: ["deal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      recurring_expenses: {
        Row: {
          active: boolean;
          amount_cents: number;
          category_id: string | null;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          description: string;
          due_day: number;
          ends_on: string | null;
          id: string;
          match_pattern: string | null;
          project_id: string | null;
          starts_on: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          amount_cents: number;
          category_id?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          description: string;
          due_day: number;
          ends_on?: string | null;
          id?: string;
          match_pattern?: string | null;
          project_id?: string | null;
          starts_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          active?: boolean;
          amount_cents?: number;
          category_id?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          description?: string;
          due_day?: number;
          ends_on?: string | null;
          id?: string;
          match_pattern?: string | null;
          project_id?: string | null;
          starts_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "recurring_expenses_project_fk";
            columns: ["project_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      tasks: {
        Row: {
          archived_at: string | null;
          completed_at: string | null;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          description: string | null;
          due_on: string | null;
          id: string;
          position: number;
          priority: Database["public"]["Enums"]["priority_level"];
          project_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          completed_at?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          description?: string | null;
          due_on?: string | null;
          id?: string;
          position?: number;
          priority?: Database["public"]["Enums"]["priority_level"];
          project_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          completed_at?: string | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          description?: string | null;
          due_on?: string | null;
          id?: string;
          position?: number;
          priority?: Database["public"]["Enums"]["priority_level"];
          project_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_user_id_fkey";
            columns: ["project_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "projects";
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
      expense_ranking: {
        Args: { p_context?: string; p_month: string };
        Returns: {
          budget_cents: number;
          category_id: string;
          name: string;
          nature: Database["public"]["Enums"]["expense_nature"];
          qty: number;
          total_cents: number;
        }[];
      };
      expense_series: {
        Args: { p_context?: string; p_months?: number; p_today?: string };
        Returns: {
          fixed_cents: number;
          income_cents: number;
          month: string;
          total_cents: number;
          variable_cents: number;
        }[];
      };
      goal_progress: {
        Args: { p_context?: string; p_today?: string };
        Returns: {
          achieved_at: string;
          context: Database["public"]["Enums"]["context_kind"];
          description: string;
          horizon: Database["public"]["Enums"]["goal_horizon"];
          id: string;
          is_late: boolean;
          milestones_done: number;
          milestones_total: number;
          monthly_needed_cents: number;
          months_left: number;
          pct: number;
          saved_cents: number;
          sort_order: number;
          status: Database["public"]["Enums"]["goal_status"];
          target_cents: number;
          target_date: string;
          title: string;
        }[];
      };
      import_statement: { Args: { p_batch_id: string; p_expenses: Json; p_incomes?: Json }; Returns: Json };
      income_series: {
        Args: { p_context?: string; p_months?: number; p_today?: string };
        Returns: {
          guaranteed_cents: number;
          month: string;
          total_cents: number;
          variable_cents: number;
        }[];
      };
      move_task: {
        Args: {
          p_after_id?: string;
          p_before_id?: string;
          p_status: Database["public"]["Enums"]["task_status"];
          p_task_id: string;
        };
        Returns: number;
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
      win_deal: {
        Args: { p_create_project?: boolean; p_deal_id: string; p_received_on?: string; p_source_id?: string };
        Returns: Json;
      };
    };
    Enums: {
      context_kind: "personal" | "work" | "freelance";
      course_status: "backlog" | "in_progress" | "paused" | "done" | "dropped";
      deal_stage: "lead" | "briefing" | "proposal" | "negotiation" | "won" | "lost";
      expense_nature: "fixed" | "variable";
      expense_source: "manual" | "import" | "capture" | "recurring";
      goal_horizon: "short" | "medium" | "long";
      goal_status: "active" | "paused" | "achieved" | "archived";
      import_format: "ofx" | "nubank_account_csv" | "nubank_card_csv";
      income_kind: "guaranteed" | "variable";
      priority_level: "low" | "medium" | "high" | "critical";
      project_status: "active" | "on_hold" | "done" | "archived";
      task_status: "todo" | "doing" | "done";
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
      deal_stage: ["lead", "briefing", "proposal", "negotiation", "won", "lost"],
      expense_nature: ["fixed", "variable"],
      expense_source: ["manual", "import", "capture", "recurring"],
      goal_horizon: ["short", "medium", "long"],
      goal_status: ["active", "paused", "achieved", "archived"],
      import_format: ["ofx", "nubank_account_csv", "nubank_card_csv"],
      income_kind: ["guaranteed", "variable"],
      priority_level: ["low", "medium", "high", "critical"],
      project_status: ["active", "on_hold", "done", "archived"],
      task_status: ["todo", "doing", "done"],
    },
  },
} as const;
