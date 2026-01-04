// GHL CRUD Database Types
// Auto-generated from schema - Update with: pnpm supabase gen types typescript --local

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      ghl_locations: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          website: string | null
          address_data: Json
          timezone: string
          settings: Json
          logo_url: string | null
          created_at: string
          updated_at: string
          last_sync: string | null
          is_active: boolean
        }
        Insert: {
          id: string
          name: string
          email?: string | null
          phone?: string | null
          website?: string | null
          address_data?: Json
          timezone?: string
          settings?: Json
          logo_url?: string | null
          created_at?: string
          updated_at?: string
          last_sync?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string | null
          website?: string | null
          address_data?: Json
          timezone?: string
          settings?: Json
          logo_url?: string | null
          created_at?: string
          updated_at?: string
          last_sync?: string | null
          is_active?: boolean
        }
      }
      ghl_pipelines: {
        Row: {
          id: string
          location_id: string
          name: string
          show_in_funnel: boolean
          show_in_pie_chart: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          location_id: string
          name: string
          show_in_funnel?: boolean
          show_in_pie_chart?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          name?: string
          show_in_funnel?: boolean
          show_in_pie_chart?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      ghl_pipeline_stages: {
        Row: {
          id: string
          pipeline_id: string
          location_id: string
          name: string
          position: number
          probability: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          pipeline_id: string
          location_id: string
          name: string
          position?: number
          probability?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pipeline_id?: string
          location_id?: string
          name?: string
          position?: number
          probability?: number
          created_at?: string
          updated_at?: string
        }
      }
      ghl_contacts: {
        Row: {
          id: string
          location_id: string
          first_name: string | null
          last_name: string | null
          name: string | null
          email: string | null
          phone: string | null
          secondary_email: string | null
          company_name: string | null
          date_of_birth: string | null
          tags: string[]
          type: string
          dnd: boolean
          dnd_settings: Json
          assigned_to: string | null
          source: string | null
          address_data: Json
          custom_fields: Json
          custom_attributes: Json
          attribution_data: Json
          date_added: string
          date_updated: string
          last_activity: string | null
          raw_data: Json | null
          is_deleted: boolean
        }
        Insert: {
          id: string
          location_id: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          secondary_email?: string | null
          company_name?: string | null
          date_of_birth?: string | null
          tags?: string[]
          type?: string
          dnd?: boolean
          dnd_settings?: Json
          assigned_to?: string | null
          source?: string | null
          address_data?: Json
          custom_fields?: Json
          custom_attributes?: Json
          attribution_data?: Json
          date_added?: string
          date_updated?: string
          last_activity?: string | null
          raw_data?: Json | null
          is_deleted?: boolean
        }
        Update: {
          id?: string
          location_id?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          secondary_email?: string | null
          company_name?: string | null
          date_of_birth?: string | null
          tags?: string[]
          type?: string
          dnd?: boolean
          dnd_settings?: Json
          assigned_to?: string | null
          source?: string | null
          address_data?: Json
          custom_fields?: Json
          custom_attributes?: Json
          attribution_data?: Json
          date_added?: string
          date_updated?: string
          last_activity?: string | null
          raw_data?: Json | null
          is_deleted?: boolean
        }
      }
      ghl_opportunities: {
        Row: {
          id: string
          location_id: string
          contact_id: string | null
          name: string
          status: 'open' | 'won' | 'lost' | 'abandoned'
          pipeline_id: string
          pipeline_stage_id: string
          monetary_value: number
          currency: string
          assigned_to: string | null
          source: string | null
          loss_reason: string | null
          custom_fields: Json
          notes: string | null
          created_at: string
          updated_at: string
          closed_at: string | null
        }
        Insert: {
          id: string
          location_id: string
          contact_id?: string | null
          name: string
          status?: 'open' | 'won' | 'lost' | 'abandoned'
          pipeline_id: string
          pipeline_stage_id: string
          monetary_value?: number
          currency?: string
          assigned_to?: string | null
          source?: string | null
          loss_reason?: string | null
          custom_fields?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          location_id?: string
          contact_id?: string | null
          name?: string
          status?: 'open' | 'won' | 'lost' | 'abandoned'
          pipeline_id?: string
          pipeline_stage_id?: string
          monetary_value?: number
          currency?: string
          assigned_to?: string | null
          source?: string | null
          loss_reason?: string | null
          custom_fields?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
      }
      ghl_workflows: {
        Row: {
          id: string
          location_id: string
          name: string
          status: 'draft' | 'published'
          version: number
          trigger_types: string[]
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          location_id: string
          name: string
          status?: 'draft' | 'published'
          version?: number
          trigger_types?: string[]
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          name?: string
          status?: 'draft' | 'published'
          version?: number
          trigger_types?: string[]
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ghl_conversations: {
        Row: {
          id: string
          location_id: string
          contact_id: string | null
          type: string
          channel: string | null
          unread_count: number
          last_message_body: string | null
          last_message_type: string | null
          last_message_date: string | null
          assigned_to: string | null
          starred: boolean
          is_archived: boolean
          inbox_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          location_id: string
          contact_id?: string | null
          type?: string
          channel?: string | null
          unread_count?: number
          last_message_body?: string | null
          last_message_type?: string | null
          last_message_date?: string | null
          assigned_to?: string | null
          starred?: boolean
          is_archived?: boolean
          inbox_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          contact_id?: string | null
          type?: string
          channel?: string | null
          unread_count?: number
          last_message_body?: string | null
          last_message_type?: string | null
          last_message_date?: string | null
          assigned_to?: string | null
          starred?: boolean
          is_archived?: boolean
          inbox_status?: string
          created_at?: string
          updated_at?: string
        }
      }
      ghl_messages: {
        Row: {
          id: string
          conversation_id: string
          location_id: string
          contact_id: string | null
          body: string | null
          message_type: string
          direction: 'inbound' | 'outbound'
          status: string
          content_type: string
          attachments: Json
          meta_data: Json
          source: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          conversation_id: string
          location_id: string
          contact_id?: string | null
          body?: string | null
          message_type: string
          direction: 'inbound' | 'outbound'
          status?: string
          content_type?: string
          attachments?: Json
          meta_data?: Json
          source?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          location_id?: string
          contact_id?: string | null
          body?: string | null
          message_type?: string
          direction?: 'inbound' | 'outbound'
          status?: string
          content_type?: string
          attachments?: Json
          meta_data?: Json
          source?: string | null
          user_id?: string | null
          created_at?: string
        }
      }
      ghl_calendars: {
        Row: {
          id: string
          location_id: string
          name: string
          description: string | null
          slug: string | null
          widget_slug: string | null
          calendar_type: string
          team_members: Json
          event_type: string | null
          slot_duration: number
          slot_buffer: number
          availability: Json
          notifications: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          location_id: string
          name: string
          description?: string | null
          slug?: string | null
          widget_slug?: string | null
          calendar_type?: string
          team_members?: Json
          event_type?: string | null
          slot_duration?: number
          slot_buffer?: number
          availability?: Json
          notifications?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          name?: string
          description?: string | null
          slug?: string | null
          widget_slug?: string | null
          calendar_type?: string
          team_members?: Json
          event_type?: string | null
          slot_duration?: number
          slot_buffer?: number
          availability?: Json
          notifications?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      ghl_appointments: {
        Row: {
          id: string
          location_id: string
          contact_id: string | null
          calendar_id: string | null
          title: string
          status: 'confirmed' | 'cancelled' | 'showed' | 'noshow' | 'invalid'
          start_time: string
          end_time: string
          timezone: string
          assigned_user_id: string | null
          appointment_type: string | null
          notes: string | null
          address: string | null
          google_event_id: string | null
          appointment_status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          location_id: string
          contact_id?: string | null
          calendar_id?: string | null
          title: string
          status?: 'confirmed' | 'cancelled' | 'showed' | 'noshow' | 'invalid'
          start_time: string
          end_time: string
          timezone?: string
          assigned_user_id?: string | null
          appointment_type?: string | null
          notes?: string | null
          address?: string | null
          google_event_id?: string | null
          appointment_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          contact_id?: string | null
          calendar_id?: string | null
          title?: string
          status?: 'confirmed' | 'cancelled' | 'showed' | 'noshow' | 'invalid'
          start_time?: string
          end_time?: string
          timezone?: string
          assigned_user_id?: string | null
          appointment_type?: string | null
          notes?: string | null
          address?: string | null
          google_event_id?: string | null
          appointment_status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ghl_invoices: {
        Row: {
          id: string
          location_id: string
          contact_id: string | null
          invoice_number: string | null
          name: string | null
          title: string | null
          status: 'draft' | 'sent' | 'paid' | 'void' | 'partially_paid'
          due_date: string | null
          issue_date: string | null
          amount_due: number
          total_amount: number
          discount: number
          currency: string
          items: Json
          business_details: Json
          payment_terms: string | null
          notes: string | null
          sent_to: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          location_id: string
          contact_id?: string | null
          invoice_number?: string | null
          name?: string | null
          title?: string | null
          status?: 'draft' | 'sent' | 'paid' | 'void' | 'partially_paid'
          due_date?: string | null
          issue_date?: string | null
          amount_due?: number
          total_amount?: number
          discount?: number
          currency?: string
          items?: Json
          business_details?: Json
          payment_terms?: string | null
          notes?: string | null
          sent_to?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          contact_id?: string | null
          invoice_number?: string | null
          name?: string | null
          title?: string | null
          status?: 'draft' | 'sent' | 'paid' | 'void' | 'partially_paid'
          due_date?: string | null
          issue_date?: string | null
          amount_due?: number
          total_amount?: number
          discount?: number
          currency?: string
          items?: Json
          business_details?: Json
          payment_terms?: string | null
          notes?: string | null
          sent_to?: Json
          created_at?: string
          updated_at?: string
        }
      }
      ghl_products: {
        Row: {
          id: string
          location_id: string
          name: string
          description: string | null
          product_type: string
          price: number
          currency: string
          image_url: string | null
          available_in_store: boolean
          statement_descriptor: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          location_id: string
          name: string
          description?: string | null
          product_type?: string
          price?: number
          currency?: string
          image_url?: string | null
          available_in_store?: boolean
          statement_descriptor?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          name?: string
          description?: string | null
          product_type?: string
          price?: number
          currency?: string
          image_url?: string | null
          available_in_store?: boolean
          statement_descriptor?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ghl_users: {
        Row: {
          id: string
          location_id: string | null
          name: string
          email: string
          phone: string | null
          role: string
          permissions: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          location_id?: string | null
          name: string
          email: string
          phone?: string | null
          role?: string
          permissions?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string | null
          name?: string
          email?: string
          phone?: string | null
          role?: string
          permissions?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      ghl_sync_log: {
        Row: {
          id: string
          location_id: string | null
          entity_type: string
          entity_id: string
          action: 'create' | 'update' | 'delete' | 'sync'
          payload: Json | null
          source: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          location_id?: string | null
          entity_type: string
          entity_id: string
          action: 'create' | 'update' | 'delete' | 'sync'
          payload?: Json | null
          source?: string
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          location_id?: string | null
          entity_type?: string
          entity_id?: string
          action?: 'create' | 'update' | 'delete' | 'sync'
          payload?: Json | null
          source?: string
          error_message?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      opportunity_status: 'open' | 'won' | 'lost' | 'abandoned'
      workflow_status: 'draft' | 'published'
      appointment_status: 'confirmed' | 'cancelled' | 'showed' | 'noshow' | 'invalid'
      invoice_status: 'draft' | 'sent' | 'paid' | 'void' | 'partially_paid'
      message_direction: 'inbound' | 'outbound'
      sync_action: 'create' | 'update' | 'delete' | 'sync'
    }
  }
}

// Convenience type aliases
export type GHLLocation = Database['public']['Tables']['ghl_locations']['Row']
export type GHLLocationInsert = Database['public']['Tables']['ghl_locations']['Insert']
export type GHLLocationUpdate = Database['public']['Tables']['ghl_locations']['Update']

export type GHLPipeline = Database['public']['Tables']['ghl_pipelines']['Row']
export type GHLPipelineInsert = Database['public']['Tables']['ghl_pipelines']['Insert']
export type GHLPipelineUpdate = Database['public']['Tables']['ghl_pipelines']['Update']

export type GHLPipelineStage = Database['public']['Tables']['ghl_pipeline_stages']['Row']
export type GHLPipelineStageInsert = Database['public']['Tables']['ghl_pipeline_stages']['Insert']
export type GHLPipelineStageUpdate = Database['public']['Tables']['ghl_pipeline_stages']['Update']

export type GHLContact = Database['public']['Tables']['ghl_contacts']['Row']
export type GHLContactInsert = Database['public']['Tables']['ghl_contacts']['Insert']
export type GHLContactUpdate = Database['public']['Tables']['ghl_contacts']['Update']

export type GHLOpportunity = Database['public']['Tables']['ghl_opportunities']['Row']
export type GHLOpportunityInsert = Database['public']['Tables']['ghl_opportunities']['Insert']
export type GHLOpportunityUpdate = Database['public']['Tables']['ghl_opportunities']['Update']

export type GHLWorkflow = Database['public']['Tables']['ghl_workflows']['Row']
export type GHLWorkflowInsert = Database['public']['Tables']['ghl_workflows']['Insert']
export type GHLWorkflowUpdate = Database['public']['Tables']['ghl_workflows']['Update']

export type GHLConversation = Database['public']['Tables']['ghl_conversations']['Row']
export type GHLConversationInsert = Database['public']['Tables']['ghl_conversations']['Insert']
export type GHLConversationUpdate = Database['public']['Tables']['ghl_conversations']['Update']

export type GHLMessage = Database['public']['Tables']['ghl_messages']['Row']
export type GHLMessageInsert = Database['public']['Tables']['ghl_messages']['Insert']
export type GHLMessageUpdate = Database['public']['Tables']['ghl_messages']['Update']

export type GHLCalendar = Database['public']['Tables']['ghl_calendars']['Row']
export type GHLCalendarInsert = Database['public']['Tables']['ghl_calendars']['Insert']
export type GHLCalendarUpdate = Database['public']['Tables']['ghl_calendars']['Update']

export type GHLAppointment = Database['public']['Tables']['ghl_appointments']['Row']
export type GHLAppointmentInsert = Database['public']['Tables']['ghl_appointments']['Insert']
export type GHLAppointmentUpdate = Database['public']['Tables']['ghl_appointments']['Update']

export type GHLInvoice = Database['public']['Tables']['ghl_invoices']['Row']
export type GHLInvoiceInsert = Database['public']['Tables']['ghl_invoices']['Insert']
export type GHLInvoiceUpdate = Database['public']['Tables']['ghl_invoices']['Update']

export type GHLProduct = Database['public']['Tables']['ghl_products']['Row']
export type GHLProductInsert = Database['public']['Tables']['ghl_products']['Insert']
export type GHLProductUpdate = Database['public']['Tables']['ghl_products']['Update']

export type GHLUser = Database['public']['Tables']['ghl_users']['Row']
export type GHLUserInsert = Database['public']['Tables']['ghl_users']['Insert']
export type GHLUserUpdate = Database['public']['Tables']['ghl_users']['Update']

export type GHLSyncLog = Database['public']['Tables']['ghl_sync_log']['Row']
export type GHLSyncLogInsert = Database['public']['Tables']['ghl_sync_log']['Insert']
export type GHLSyncLogUpdate = Database['public']['Tables']['ghl_sync_log']['Update']
