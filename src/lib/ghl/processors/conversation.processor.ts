/**
 * Conversation Webhook Processor
 * Handles conversation and message-related webhook events from GHL
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface ConversationWebhookPayload {
  id: string
  locationId: string
  contactId?: string
  type?: string
  channel?: string
  unreadCount?: number
  lastMessageBody?: string
  lastMessageType?: string
  lastMessageDate?: string
  assignedTo?: string
  starred?: boolean
  isArchived?: boolean
  inboxStatus?: string
}

export interface MessageWebhookPayload {
  id: string
  conversationId: string
  locationId: string
  contactId?: string
  body?: string
  messageType: string
  direction: 'inbound' | 'outbound'
  status?: string
  contentType?: string
  attachments?: unknown[]
  metaData?: Record<string, unknown>
  source?: string
  userId?: string
  dateAdded?: string
}

export class ConversationProcessor {
  constructor(private supabase: SupabaseClient<any>) {}

  /**
   * Process ConversationUnreadUpdate event
   */
  async handleUnreadUpdate(payload: {
    id: string
    locationId: string
    unreadCount: number
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_conversations')
      .update({
        unread_count: payload.unreadCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update conversation unread count: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'unread',
      ...payload,
    })
  }

  /**
   * Process InboundMessage event
   */
  async handleInboundMessage(payload: MessageWebhookPayload): Promise<void> {
    // Upsert message
    const message = this.mapMessageToDatabase(payload)
    const { error: messageError } = await this.supabase
      .from('ghl_messages')
      .upsert(message, { onConflict: 'id' })

    if (messageError) {
      throw new Error(`Failed to save inbound message: ${messageError.message}`)
    }

    // Update conversation with latest message
    await this.updateConversationLastMessage(payload)

    await this.logSyncAction(payload.locationId, payload.id, 'create', {
      type: 'inbound_message',
      ...payload,
    })
  }

  /**
   * Process OutboundMessage event
   */
  async handleOutboundMessage(payload: MessageWebhookPayload): Promise<void> {
    // Upsert message
    const message = this.mapMessageToDatabase(payload)
    const { error: messageError } = await this.supabase
      .from('ghl_messages')
      .upsert(message, { onConflict: 'id' })

    if (messageError) {
      throw new Error(`Failed to save outbound message: ${messageError.message}`)
    }

    // Update conversation with latest message
    await this.updateConversationLastMessage(payload)

    await this.logSyncAction(payload.locationId, payload.id, 'create', {
      type: 'outbound_message',
      ...payload,
    })
  }

  /**
   * Process MessageStatusUpdate event
   */
  async handleMessageStatusUpdate(payload: {
    id: string
    locationId: string
    conversationId: string
    status: string
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_messages')
      .update({ status: payload.status })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update message status: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'message_status',
      ...payload,
    })
  }

  /**
   * Create or update conversation record
   */
  async upsertConversation(payload: ConversationWebhookPayload): Promise<void> {
    const conversation = this.mapConversationToDatabase(payload)

    const { error } = await this.supabase
      .from('ghl_conversations')
      .upsert(conversation, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to upsert conversation: ${error.message}`)
    }
  }

  /**
   * Update conversation with latest message info
   */
  private async updateConversationLastMessage(message: MessageWebhookPayload): Promise<void> {
    const updateData: Record<string, unknown> = {
      last_message_body: message.body || null,
      last_message_type: message.messageType,
      last_message_date: message.dateAdded || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Increment unread count for inbound messages
    if (message.direction === 'inbound') {
      const { data: existing } = await this.supabase
        .from('ghl_conversations')
        .select('unread_count')
        .eq('id', message.conversationId)
        .single()

      updateData.unread_count = ((existing?.unread_count as number) || 0) + 1
    }

    // Create conversation if it doesn't exist
    const { error: checkError, count } = await this.supabase
      .from('ghl_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('id', message.conversationId)

    if (count === 0) {
      // Create new conversation
      await this.supabase.from('ghl_conversations').insert({
        id: message.conversationId,
        location_id: message.locationId,
        contact_id: message.contactId || null,
        type: 'sms',
        last_message_body: message.body || null,
        last_message_type: message.messageType,
        last_message_date: message.dateAdded || new Date().toISOString(),
        unread_count: message.direction === 'inbound' ? 1 : 0,
      })
    } else {
      // Update existing conversation
      await this.supabase
        .from('ghl_conversations')
        .update(updateData)
        .eq('id', message.conversationId)
    }
  }

  /**
   * Map message payload to database schema
   */
  private mapMessageToDatabase(payload: MessageWebhookPayload): Record<string, unknown> {
    return {
      id: payload.id,
      conversation_id: payload.conversationId,
      location_id: payload.locationId,
      contact_id: payload.contactId || null,
      body: payload.body || null,
      message_type: payload.messageType,
      direction: payload.direction,
      status: payload.status || 'delivered',
      content_type: payload.contentType || 'text/plain',
      attachments: payload.attachments || [],
      meta_data: payload.metaData || {},
      source: payload.source || null,
      user_id: payload.userId || null,
      created_at: payload.dateAdded || new Date().toISOString(),
    }
  }

  /**
   * Map conversation payload to database schema
   */
  private mapConversationToDatabase(payload: ConversationWebhookPayload): Record<string, unknown> {
    return {
      id: payload.id,
      location_id: payload.locationId,
      contact_id: payload.contactId || null,
      type: payload.type || 'sms',
      channel: payload.channel || null,
      unread_count: payload.unreadCount || 0,
      last_message_body: payload.lastMessageBody || null,
      last_message_type: payload.lastMessageType || null,
      last_message_date: payload.lastMessageDate || null,
      assigned_to: payload.assignedTo || null,
      starred: payload.starred || false,
      is_archived: payload.isArchived || false,
      inbox_status: payload.inboxStatus || 'open',
      updated_at: new Date().toISOString(),
    }
  }

  /**
   * Log sync action for audit trail
   */
  private async logSyncAction(
    locationId: string,
    entityId: string,
    action: 'create' | 'update' | 'delete',
    payload: unknown
  ): Promise<void> {
    await this.supabase.from('ghl_sync_log').insert({
      location_id: locationId,
      entity_type: 'conversation',
      entity_id: entityId,
      action,
      payload: payload as Record<string, unknown>,
      source: 'webhook',
    })
  }
}

export function createConversationProcessor(supabase: SupabaseClient<any>): ConversationProcessor {
  return new ConversationProcessor(supabase)
}
