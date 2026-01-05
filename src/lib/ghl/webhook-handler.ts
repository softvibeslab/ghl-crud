/**
 * GHL Webhook Handler
 * Processes incoming webhook events from GoHighLevel
 */

import { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Note: Using 'any' for Supabase client until migrations are applied and types regenerated

// Webhook Event Types
export type GHLWebhookEventType =
  | 'ContactCreate'
  | 'ContactUpdate'
  | 'ContactDelete'
  | 'ContactDndUpdate'
  | 'ContactTagUpdate'
  | 'OpportunityCreate'
  | 'OpportunityStatusUpdate'
  | 'OpportunityStageUpdate'
  | 'OpportunityMonetaryValueUpdate'
  | 'OpportunityDelete'
  | 'OpportunityAssignedToUpdate'
  | 'AppointmentCreate'
  | 'AppointmentUpdate'
  | 'AppointmentDelete'
  | 'AppointmentStatusUpdate'
  | 'ConversationUnreadUpdate'
  | 'InboundMessage'
  | 'OutboundMessage'
  | 'MessageStatusUpdate'
  | 'InvoiceCreate'
  | 'InvoiceUpdate'
  | 'InvoiceSent'
  | 'InvoicePaid'
  | 'InvoicePartiallyPaid'
  | 'InvoiceVoid'
  | 'TaskCreate'
  | 'TaskComplete'
  | 'TaskDelete'
  | 'NoteCreate'
  | 'LocationUpdate'
  | 'UserCreate'
  | 'UserUpdate'

// Webhook Event interface
export interface GHLWebhookEvent {
  type: GHLWebhookEventType
  locationId: string
  id?: string
  [key: string]: unknown
}

// Handler result
export interface WebhookHandlerResult {
  success: boolean
  eventType: string
  entityId?: string
  action?: string
  error?: string
}

// Webhook Handler class
export class GHLWebhookHandler {
  private supabase: SupabaseClient<any>
  private webhookSecret: string

  constructor(supabase: SupabaseClient<any>) {
    this.supabase = supabase
    this.webhookSecret = process.env.GHL_WEBHOOK_SECRET || ''
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('Webhook secret not configured, skipping verification')
      return true
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  /**
   * Check for duplicate events (idempotency)
   */
  private async isDuplicate(
    eventId: string,
    locationId: string
  ): Promise<boolean> {
    const { count } = await this.supabase
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('location_id', locationId)

    return (count ?? 0) > 0
  }

  /**
   * Log webhook event
   */
  private async logEvent(
    event: GHLWebhookEvent,
    processed: boolean,
    error?: string
  ): Promise<void> {
    // Get tenant_id from location
    const { data: location } = await this.supabase
      .from('ghl_locations')
      .select('tenant_id')
      .eq('id', event.locationId)
      .single()

    await this.supabase.from('webhook_events').insert({
      tenant_id: location?.tenant_id,
      location_id: event.locationId,
      event_type: event.type,
      event_id: event.id || crypto.randomUUID(),
      payload: event as unknown as Record<string, unknown>,
      processed,
      processed_at: processed ? new Date().toISOString() : null,
      error_message: error,
    })
  }

  /**
   * Process incoming webhook event
   */
  async processEvent(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    // Check for duplicates
    if (event.id) {
      const isDupe = await this.isDuplicate(event.id, event.locationId)
      if (isDupe) {
        return {
          success: true,
          eventType: event.type,
          entityId: event.id,
          action: 'skipped_duplicate',
        }
      }
    }

    try {
      // Route to appropriate handler
      const result = await this.routeEvent(event)

      // Log successful processing
      await this.logEvent(event, true)

      // Also log to sync_log for audit
      await this.logToSyncLog(event, result.action || 'webhook')

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Log failed processing
      await this.logEvent(event, false, errorMessage)

      return {
        success: false,
        eventType: event.type,
        entityId: event.id,
        error: errorMessage,
      }
    }
  }

  /**
   * Route event to appropriate handler
   */
  private async routeEvent(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const handlers: Record<string, (e: GHLWebhookEvent) => Promise<WebhookHandlerResult>> = {
      // Contact events
      ContactCreate: this.handleContactCreate.bind(this),
      ContactUpdate: this.handleContactUpdate.bind(this),
      ContactDelete: this.handleContactDelete.bind(this),
      ContactDndUpdate: this.handleContactUpdate.bind(this),
      ContactTagUpdate: this.handleContactUpdate.bind(this),

      // Opportunity events
      OpportunityCreate: this.handleOpportunityCreate.bind(this),
      OpportunityStatusUpdate: this.handleOpportunityUpdate.bind(this),
      OpportunityStageUpdate: this.handleOpportunityUpdate.bind(this),
      OpportunityMonetaryValueUpdate: this.handleOpportunityUpdate.bind(this),
      OpportunityDelete: this.handleOpportunityDelete.bind(this),
      OpportunityAssignedToUpdate: this.handleOpportunityUpdate.bind(this),

      // Appointment events
      AppointmentCreate: this.handleAppointmentCreate.bind(this),
      AppointmentUpdate: this.handleAppointmentUpdate.bind(this),
      AppointmentDelete: this.handleAppointmentDelete.bind(this),
      AppointmentStatusUpdate: this.handleAppointmentUpdate.bind(this),

      // Conversation events
      ConversationUnreadUpdate: this.handleConversationUpdate.bind(this),
      InboundMessage: this.handleMessageCreate.bind(this),
      OutboundMessage: this.handleMessageCreate.bind(this),
      MessageStatusUpdate: this.handleMessageUpdate.bind(this),

      // Invoice events
      InvoiceCreate: this.handleInvoiceCreate.bind(this),
      InvoiceUpdate: this.handleInvoiceUpdate.bind(this),
      InvoiceSent: this.handleInvoiceUpdate.bind(this),
      InvoicePaid: this.handleInvoiceUpdate.bind(this),
      InvoicePartiallyPaid: this.handleInvoiceUpdate.bind(this),
      InvoiceVoid: this.handleInvoiceUpdate.bind(this),
    }

    const handler = handlers[event.type]
    if (!handler) {
      return {
        success: true,
        eventType: event.type,
        action: 'unhandled_event_type',
      }
    }

    return handler(event)
  }

  // ============================================
  // CONTACT HANDLERS
  // ============================================

  private async handleContactCreate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const contact = this.mapContactFromWebhook(event)

    const { error } = await this.supabase
      .from('ghl_contacts')
      .upsert(contact, { onConflict: 'id' })

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'create',
    }
  }

  private async handleContactUpdate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const updates = this.mapContactFromWebhook(event)

    const { error } = await this.supabase
      .from('ghl_contacts')
      .update(updates)
      .eq('id', event.id)

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'update',
    }
  }

  private async handleContactDelete(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    // Soft delete
    const { error } = await this.supabase
      .from('ghl_contacts')
      .update({ is_deleted: true })
      .eq('id', event.id)

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'delete',
    }
  }

  // ============================================
  // OPPORTUNITY HANDLERS
  // ============================================

  private async handleOpportunityCreate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const opportunity = this.mapOpportunityFromWebhook(event)

    const { error } = await this.supabase
      .from('ghl_opportunities')
      .upsert(opportunity, { onConflict: 'id' })

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'create',
    }
  }

  private async handleOpportunityUpdate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const updates = this.mapOpportunityFromWebhook(event)

    const { error } = await this.supabase
      .from('ghl_opportunities')
      .update(updates)
      .eq('id', event.id)

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'update',
    }
  }

  private async handleOpportunityDelete(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const { error } = await this.supabase
      .from('ghl_opportunities')
      .delete()
      .eq('id', event.id)

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'delete',
    }
  }

  // ============================================
  // APPOINTMENT HANDLERS
  // ============================================

  private async handleAppointmentCreate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const appointment = this.mapAppointmentFromWebhook(event)

    const { error } = await this.supabase
      .from('ghl_appointments')
      .upsert(appointment, { onConflict: 'id' })

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: (event.appointment as Record<string, unknown>)?.id as string || event.id,
      action: 'create',
    }
  }

  private async handleAppointmentUpdate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const updates = this.mapAppointmentFromWebhook(event)
    const appointmentId = (event.appointment as Record<string, unknown>)?.id as string || event.id

    const { error } = await this.supabase
      .from('ghl_appointments')
      .update(updates)
      .eq('id', appointmentId)

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: appointmentId,
      action: 'update',
    }
  }

  private async handleAppointmentDelete(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const appointmentId = (event.appointment as Record<string, unknown>)?.id as string || event.id

    const { error } = await this.supabase
      .from('ghl_appointments')
      .delete()
      .eq('id', appointmentId)

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: appointmentId,
      action: 'delete',
    }
  }

  // ============================================
  // CONVERSATION & MESSAGE HANDLERS
  // ============================================

  private async handleConversationUpdate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const { error } = await this.supabase
      .from('ghl_conversations')
      .update({
        unread_count: event.unreadCount as number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id)

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'update',
    }
  }

  private async handleMessageCreate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const message = this.mapMessageFromWebhook(event)

    const { error } = await this.supabase
      .from('ghl_messages')
      .upsert(message, { onConflict: 'id' })

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'create',
    }
  }

  private async handleMessageUpdate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const { error } = await this.supabase
      .from('ghl_messages')
      .update({
        status: event.status as string,
      })
      .eq('id', event.id)

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'update',
    }
  }

  // ============================================
  // INVOICE HANDLERS
  // ============================================

  private async handleInvoiceCreate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const invoice = this.mapInvoiceFromWebhook(event)

    const { error } = await this.supabase
      .from('ghl_invoices')
      .upsert(invoice, { onConflict: 'id' })

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'create',
    }
  }

  private async handleInvoiceUpdate(event: GHLWebhookEvent): Promise<WebhookHandlerResult> {
    const updates = this.mapInvoiceFromWebhook(event)

    const { error } = await this.supabase
      .from('ghl_invoices')
      .update(updates)
      .eq('id', event.id)

    if (error) throw new Error(error.message)

    return {
      success: true,
      eventType: event.type,
      entityId: event.id,
      action: 'update',
    }
  }

  // ============================================
  // DATA MAPPERS
  // ============================================

  private mapContactFromWebhook(event: GHLWebhookEvent): Record<string, unknown> {
    return {
      id: event.id,
      location_id: event.locationId,
      first_name: event.firstName,
      last_name: event.lastName,
      email: event.email,
      phone: event.phone,
      company_name: event.companyName,
      tags: event.tags || [],
      dnd: event.dnd || false,
      assigned_to: event.assignedTo,
      source: event.source,
      address_data: {
        address1: event.address1,
        city: event.city,
        state: event.state,
        country: event.country,
        postalCode: event.postalCode,
      },
      custom_fields: event.customFields || [],
      date_updated: new Date().toISOString(),
    }
  }

  private mapOpportunityFromWebhook(event: GHLWebhookEvent): Record<string, unknown> {
    return {
      id: event.id,
      location_id: event.locationId,
      contact_id: event.contactId,
      name: event.name,
      status: event.status,
      pipeline_id: event.pipelineId,
      pipeline_stage_id: event.pipelineStageId,
      monetary_value: event.monetaryValue || 0,
      assigned_to: event.assignedTo,
      source: event.source,
      updated_at: new Date().toISOString(),
    }
  }

  private mapAppointmentFromWebhook(event: GHLWebhookEvent): Record<string, unknown> {
    const apt = event.appointment as Record<string, unknown> || event
    return {
      id: apt.id || event.id,
      location_id: event.locationId,
      contact_id: apt.contactId,
      calendar_id: apt.calendarId,
      title: apt.title,
      status: apt.appointmentStatus || 'confirmed',
      start_time: apt.startTime,
      end_time: apt.endTime,
      assigned_user_id: apt.assignedUserId,
      notes: apt.notes,
      address: apt.address,
      updated_at: new Date().toISOString(),
    }
  }

  private mapMessageFromWebhook(event: GHLWebhookEvent): Record<string, unknown> {
    return {
      id: event.id || event.messageId,
      conversation_id: event.conversationId,
      location_id: event.locationId,
      contact_id: event.contactId,
      body: event.body || event.message,
      message_type: event.messageType || 'SMS',
      direction: event.type === 'InboundMessage' ? 'inbound' : 'outbound',
      status: event.status || 'delivered',
      attachments: event.attachments || [],
      created_at: event.dateAdded || new Date().toISOString(),
    }
  }

  private mapInvoiceFromWebhook(event: GHLWebhookEvent): Record<string, unknown> {
    return {
      id: event.id,
      location_id: event.locationId,
      contact_id: event.contactId,
      invoice_number: event.invoiceNumber,
      name: event.name,
      status: event.status,
      due_date: event.dueDate,
      amount_due: event.amountDue,
      total_amount: event.totalAmount,
      updated_at: new Date().toISOString(),
    }
  }

  // ============================================
  // SYNC LOG
  // ============================================

  private async logToSyncLog(
    event: GHLWebhookEvent,
    action: string
  ): Promise<void> {
    const entityTypeMap: Record<string, string> = {
      Contact: 'contacts',
      Opportunity: 'opportunities',
      Appointment: 'appointments',
      Conversation: 'conversations',
      Message: 'messages',
      Invoice: 'invoices',
    }

    // Extract entity type from event type
    let entityType = 'unknown'
    for (const [key, value] of Object.entries(entityTypeMap)) {
      if (event.type.includes(key)) {
        entityType = value
        break
      }
    }

    await this.supabase.from('ghl_sync_log').insert({
      location_id: event.locationId,
      entity_type: entityType,
      entity_id: event.id || 'unknown',
      action: action as 'create' | 'update' | 'delete' | 'sync',
      payload: event as unknown as Record<string, unknown>,
      source: 'webhook',
    })
  }
}

// Factory function
export function createWebhookHandler(supabase: SupabaseClient<any>): GHLWebhookHandler {
  return new GHLWebhookHandler(supabase)
}
