export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          company_id: string | null
          created_at: string
          id: string
          row_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string
          id?: string
          row_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string
          id?: string
          row_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          currency: string
          fiscal_year_start: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          fiscal_year_start?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          fiscal_year_start?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_groups: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          company_id: string
          created_at: string
          efficiency: number
          group_id: string
          hours_per_period: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          efficiency?: number
          group_id: string
          hours_per_period?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          efficiency?: number
          group_id?: string
          hours_per_period?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "machine_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          fx: number
          id: string
          inflation: number
          name: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          currency?: string
          fx?: number
          id?: string
          inflation?: number
          name: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          fx?: number
          id?: string
          inflation?: number
          name?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_materials: {
        Row: {
          company_id: string
          created_at: string
          id: string
          material_id: string
          product_id: string
          qty: number
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          material_id: string
          product_id: string
          qty?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          material_id?: string
          product_id?: string
          qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          company_id: string
          created_at: string
          id: string
          material_cost: number
          max_demand: number | null
          name: string
          other_throughput_cost: number
          other_variable_cost: number
          price: number
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          material_cost?: number
          max_demand?: number | null
          name: string
          other_throughput_cost?: number
          other_variable_cost?: number
          price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          material_cost?: number
          max_demand?: number | null
          name?: string
          other_throughput_cost?: number
          other_variable_cost?: number
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      routings: {
        Row: {
          company_id: string
          created_at: string
          group_id: string
          id: string
          minutes_per_unit: number
          product_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          group_id: string
          id?: string
          minutes_per_unit?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          group_id?: string
          id?: string
          minutes_per_unit?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "machine_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_inputs: {
        Row: {
          adjustments: Json
          company_id: string
          created_at: string
          id: string
          operating_expense: number
          pinned_group_id: string | null
          scenario_id: string
          updated_at: string
          volumes: Json
        }
        Insert: {
          adjustments?: Json
          company_id?: string
          created_at?: string
          id?: string
          operating_expense?: number
          pinned_group_id?: string | null
          scenario_id: string
          updated_at?: string
          volumes?: Json
        }
        Update: {
          adjustments?: Json
          company_id?: string
          created_at?: string
          id?: string
          operating_expense?: number
          pinned_group_id?: string | null
          scenario_id?: string
          updated_at?: string
          volumes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scenario_inputs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_inputs_pinned_group_id_fkey"
            columns: ["pinned_group_id"]
            isOneToOne: false
            referencedRelation: "machine_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_inputs_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: true
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          base_scenario_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_locked: boolean
          name: string
          updated_at: string
          version_label: Database["public"]["Enums"]["version_label"]
        }
        Insert: {
          base_scenario_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_locked?: boolean
          name: string
          updated_at?: string
          version_label?: Database["public"]["Enums"]["version_label"]
        }
        Update: {
          base_scenario_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_locked?: boolean
          name?: string
          updated_at?: string
          version_label?: Database["public"]["Enums"]["version_label"]
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_base_scenario_id_fkey"
            columns: ["base_scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit: { Args: never; Returns: boolean }
      current_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      log_event: {
        Args: { _action: string; _details?: Json }
        Returns: undefined
      }
      seed_demo: {
        Args: { _company: string; _user: string }
        Returns: undefined
      }
      user_company_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "analyst" | "viewer"
      version_label: "Actual" | "Budget" | "Forecast" | "Simulation"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "analyst", "viewer"],
      version_label: ["Actual", "Budget", "Forecast", "Simulation"],
    },
  },
} as const
