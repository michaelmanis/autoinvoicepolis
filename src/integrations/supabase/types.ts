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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      business_cards: {
        Row: {
          company: string | null
          contact_name: string | null
          contact_surname: string | null
          created_at: string
          email: string | null
          file_name: string | null
          file_url: string | null
          id: string
          mobile_phone: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          contact_name?: string | null
          contact_surname?: string | null
          created_at?: string
          email?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          mobile_phone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          contact_name?: string | null
          contact_surname?: string | null
          created_at?: string
          email?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          mobile_phone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          permissions: Database["public"]["Enums"]["company_permission"][]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          permissions?: Database["public"]["Enums"]["company_permission"][]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          permissions?: Database["public"]["Enums"]["company_permission"][]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_settings: {
        Row: {
          api_key: string
          branch_id: string
          company_id: string
          endpoint_url: string
          erp_type: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          api_key?: string
          branch_id?: string
          company_id?: string
          endpoint_url?: string
          erp_type?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          api_key?: string
          branch_id?: string
          company_id?: string
          endpoint_url?: string
          erp_type?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      expense_actions: {
        Row: {
          action: string
          created_at: string
          expense_id: string
          id: string
          metadata: Json
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          expense_id: string
          id?: string
          metadata?: Json
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          expense_id?: string
          id?: string
          metadata?: Json
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_actions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          due_date: string | null
          expense_date: string | null
          expense_number: string | null
          file_name: string | null
          file_url: string | null
          id: string
          notes: string | null
          project_id: string | null
          raw_ocr_text: string | null
          status: string
          supplier: string | null
          supplier_vat: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          expense_date?: string | null
          expense_number?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          raw_ocr_text?: string | null
          status?: string
          supplier?: string | null
          supplier_vat?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          expense_date?: string | null
          expense_number?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          raw_ocr_text?: string | null
          status?: string
          supplier?: string | null
          supplier_vat?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          invoice_id: string
          metadata: Json
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          invoice_id: string
          metadata?: Json
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          invoice_id?: string
          metadata?: Json
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_actions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          currency: string | null
          document_type: string | null
          due_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          items: Json | null
          notes: string | null
          project_id: string | null
          raw_ocr_text: string | null
          status: string
          supplier: string | null
          supplier_vat: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          document_type?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          items?: Json | null
          notes?: string | null
          project_id?: string | null
          raw_ocr_text?: string | null
          status?: string
          supplier?: string | null
          supplier_vat?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          document_type?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          items?: Json | null
          notes?: string | null
          project_id?: string | null
          raw_ocr_text?: string | null
          status?: string
          supplier?: string | null
          supplier_vat?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
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
      has_company_permission: {
        Args: {
          _company_id: string
          _permission: Database["public"]["Enums"]["company_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "accountant" | "user"
      company_permission:
        | "view_invoices"
        | "upload_edit"
        | "approve_erp"
        | "manage_projects"
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
      app_role: ["admin", "accountant", "user"],
      company_permission: [
        "view_invoices",
        "upload_edit",
        "approve_erp",
        "manage_projects",
      ],
    },
  },
} as const
