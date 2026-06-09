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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_events: {
        Row: {
          agent_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["agent_event_type"]
          id: string
          metadata: Json
          model: string | null
          property_id: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["agent_event_type"]
          id?: string
          metadata?: Json
          model?: string | null
          property_id?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["agent_event_type"]
          id?: string
          metadata?: Json
          model?: string | null
          property_id?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          agent_id: string
          client_name: string
          client_phone: string
          created_at: string
          id: string
          lead_id: string | null
          notes: string
          property_id: string | null
          scheduled_at: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string
          property_id?: string | null
          scheduled_at: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string
          property_id?: string | null
          scheduled_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["availability_status"]
          id: string
          to_status: Database["public"]["Enums"]["availability_status"]
          unit_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status: Database["public"]["Enums"]["availability_status"]
          id?: string
          to_status: Database["public"]["Enums"]["availability_status"]
          unit_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["availability_status"]
          id?: string
          to_status?: Database["public"]["Enums"]["availability_status"]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "availability_units"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_units: {
        Row: {
          created_at: string
          delivery: string | null
          desarrollo: string
          id: string
          lot: string
          model: string
          notes: string
          price: number
          property_id: string | null
          status: Database["public"]["Enums"]["availability_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          delivery?: string | null
          desarrollo?: string
          id?: string
          lot: string
          model: string
          notes?: string
          price?: number
          property_id?: string | null
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          delivery?: string | null
          desarrollo?: string
          id?: string
          lot?: string
          model?: string
          notes?: string
          price?: number
          property_id?: string | null
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          agent_id: string
          commission_mxn: number
          commission_pct: number
          created_at: string
          down_pct: number
          enganche_mxn: number
          id: string
          model: string | null
          notes: string
          price: number
          property_id: string | null
        }
        Insert: {
          agent_id: string
          commission_mxn: number
          commission_pct: number
          created_at?: string
          down_pct: number
          enganche_mxn: number
          id?: string
          model?: string | null
          notes?: string
          price: number
          property_id?: string | null
        }
        Update: {
          agent_id?: string
          commission_mxn?: number
          commission_pct?: number
          created_at?: string
          down_pct?: number
          enganche_mxn?: number
          id?: string
          model?: string | null
          notes?: string
          price?: number
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          notes: string
          slot_id: string | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          notes?: string
          slot_id?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          notes?: string
          slot_id?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "event_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      event_slots: {
        Row: {
          capacity: number | null
          created_at: string
          ends_at: string | null
          event_id: string
          id: string
          label: string
          starts_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          ends_at?: string | null
          event_id: string
          id?: string
          label?: string
          starts_at: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          ends_at?: string | null
          event_id?: string
          id?: string
          label?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          agenda: Json
          author_id: string | null
          capacity: number | null
          created_at: string
          description: string
          ends_at: string | null
          highlighted: boolean
          id: string
          image_url: string | null
          location: string
          materials: Json
          related_property_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          agenda?: Json
          author_id?: string | null
          capacity?: number | null
          created_at?: string
          description?: string
          ends_at?: string | null
          highlighted?: boolean
          id?: string
          image_url?: string | null
          location?: string
          materials?: Json
          related_property_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          agenda?: Json
          author_id?: string | null
          capacity?: number | null
          created_at?: string
          description?: string
          ends_at?: string | null
          highlighted?: boolean
          id?: string
          image_url?: string | null
          location?: string
          materials?: Json
          related_property_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_related_property_id_fkey"
            columns: ["related_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agent_id: string
          budget: number
          created_at: string
          email: string
          id: string
          interest: string
          name: string
          notes: string
          phone: string
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          agent_id: string
          budget?: number
          created_at?: string
          email?: string
          id?: string
          interest?: string
          name: string
          notes?: string
          phone?: string
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          budget?: number
          created_at?: string
          email?: string
          id?: string
          interest?: string
          name?: string
          notes?: string
          phone?: string
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          author_id: string | null
          category: Database["public"]["Enums"]["news_category"]
          created_at: string
          description: string
          event_date: string | null
          highlighted: boolean
          id: string
          image_url: string | null
          related_property_id: string | null
          status: Database["public"]["Enums"]["news_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category?: Database["public"]["Enums"]["news_category"]
          created_at?: string
          description?: string
          event_date?: string | null
          highlighted?: boolean
          id?: string
          image_url?: string | null
          related_property_id?: string | null
          status?: Database["public"]["Enums"]["news_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: Database["public"]["Enums"]["news_category"]
          created_at?: string
          description?: string
          event_date?: string | null
          highlighted?: boolean
          id?: string
          image_url?: string | null
          related_property_id?: string | null
          status?: Database["public"]["Enums"]["news_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_related_property_id_fkey"
            columns: ["related_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          facebook: string | null
          full_name: string | null
          id: string
          instagram: string | null
          linkedin: string | null
          office_address: string | null
          phone: string | null
          phone_mobile: string | null
          phone_office: string | null
          slug: string | null
          tiktok: string | null
          twitter_x: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          facebook?: string | null
          full_name?: string | null
          id: string
          instagram?: string | null
          linkedin?: string | null
          office_address?: string | null
          phone?: string | null
          phone_mobile?: string | null
          phone_office?: string | null
          slug?: string | null
          tiktok?: string | null
          twitter_x?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          facebook?: string | null
          full_name?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          office_address?: string | null
          phone?: string | null
          phone_mobile?: string | null
          phone_office?: string | null
          slug?: string | null
          tiktok?: string | null
          twitter_x?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          agent_id: string | null
          area: number
          bathrooms: number
          bedrooms: number
          code: string
          created_at: string
          deleted_at: string | null
          delivery_date: string | null
          id: string
          image_url: string | null
          location: string
          lot: string | null
          model: string | null
          notes: string | null
          price: number
          status: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          agent_id?: string | null
          area?: number
          bathrooms?: number
          bedrooms?: number
          code: string
          created_at?: string
          deleted_at?: string | null
          delivery_date?: string | null
          id?: string
          image_url?: string | null
          location: string
          lot?: string | null
          model?: string | null
          notes?: string | null
          price: number
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          agent_id?: string | null
          area?: number
          bathrooms?: number
          bedrooms?: number
          code?: string
          created_at?: string
          deleted_at?: string | null
          delivery_date?: string | null
          id?: string
          image_url?: string | null
          location?: string
          lot?: string | null
          model?: string | null
          notes?: string | null
          price?: number
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_files: {
        Row: {
          created_at: string
          id: string
          label: string
          mime_type: string | null
          property_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          mime_type?: string | null
          property_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          mime_type?: string | null
          property_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_files_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          property_id: string
          sort_order: number
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          property_id: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          property_id?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      whatsapp_templates: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agent_event_type:
        | "session_start"
        | "property_share"
        | "property_pdf"
        | "availability_pdf_general"
        | "availability_pdf_model"
        | "appointment_created"
      app_role: "admin" | "agent"
      availability_status: "Available" | "Reserved" | "Sold"
      event_status: "Published" | "Draft"
      event_type:
        | "Open House"
        | "PASS Anual"
        | "Capacitación"
        | "Reunión Comercial"
      lead_source: "Website" | "WhatsApp" | "Referral" | "Walk-in" | "Facebook"
      lead_status: "New" | "Contacted" | "Visit" | "Negotiation" | "Closed"
      media_kind: "photo" | "render" | "video"
      news_category:
        | "Nuevos Lanzamientos"
        | "Promociones"
        | "Bonos"
        | "Avisos Internos"
      news_status: "Published" | "Draft"
      property_status: "Available" | "Reserved" | "Sold"
      registration_status: "Confirmed" | "Cancelled" | "Attended"
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
      agent_event_type: [
        "session_start",
        "property_share",
        "property_pdf",
        "availability_pdf_general",
        "availability_pdf_model",
        "appointment_created",
      ],
      app_role: ["admin", "agent"],
      availability_status: ["Available", "Reserved", "Sold"],
      event_status: ["Published", "Draft"],
      event_type: [
        "Open House",
        "PASS Anual",
        "Capacitación",
        "Reunión Comercial",
      ],
      lead_source: ["Website", "WhatsApp", "Referral", "Walk-in", "Facebook"],
      lead_status: ["New", "Contacted", "Visit", "Negotiation", "Closed"],
      media_kind: ["photo", "render", "video"],
      news_category: [
        "Nuevos Lanzamientos",
        "Promociones",
        "Bonos",
        "Avisos Internos",
      ],
      news_status: ["Published", "Draft"],
      property_status: ["Available", "Reserved", "Sold"],
      registration_status: ["Confirmed", "Cancelled", "Attended"],
    },
  },
} as const
