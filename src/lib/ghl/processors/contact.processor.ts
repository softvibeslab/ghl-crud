/**
 * Contact Webhook Processor
 * Handles contact-related webhook events from GHL
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface ContactWebhookPayload {
  id: string
  locationId: string
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  secondaryEmail?: string
  companyName?: string
  dateOfBirth?: string
  tags?: string[]
  type?: string
  dnd?: boolean
  dndSettings?: Record<string, unknown>
  assignedTo?: string
  source?: string
  address?: {
    address1?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
  }
  customFields?: Record<string, unknown>[]
  dateAdded?: string
  dateUpdated?: string
}

export class ContactProcessor {
  constructor(private supabase: SupabaseClient<any>) {}

  /**
   * Process ContactCreate event
   */
  async handleCreate(payload: ContactWebhookPayload): Promise<void> {
    const contact = this.mapToDatabase(payload)

    const { error } = await this.supabase
      .from('ghl_contacts')
      .upsert(contact, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to create contact: ${error.message}`)
    }

    // Log sync action
    await this.logSyncAction(payload.locationId, payload.id, 'create', payload)
  }

  /**
   * Process ContactUpdate event
   */
  async handleUpdate(payload: ContactWebhookPayload): Promise<void> {
    const contact = this.mapToDatabase(payload)

    const { error } = await this.supabase
      .from('ghl_contacts')
      .update(contact)
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update contact: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', payload)
  }

  /**
   * Process ContactDelete event
   */
  async handleDelete(payload: { id: string; locationId: string }): Promise<void> {
    // Soft delete - mark as deleted instead of removing
    const { error } = await this.supabase
      .from('ghl_contacts')
      .update({ is_deleted: true, date_updated: new Date().toISOString() })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to delete contact: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'delete', payload)
  }

  /**
   * Process ContactDndUpdate event
   */
  async handleDndUpdate(payload: {
    id: string
    locationId: string
    dnd: boolean
    dndSettings?: Record<string, unknown>
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_contacts')
      .update({
        dnd: payload.dnd,
        dnd_settings: payload.dndSettings || {},
        date_updated: new Date().toISOString(),
      })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update contact DND: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', { type: 'dnd', ...payload })
  }

  /**
   * Process ContactTagUpdate event
   */
  async handleTagUpdate(payload: {
    id: string
    locationId: string
    tags: string[]
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_contacts')
      .update({
        tags: payload.tags,
        date_updated: new Date().toISOString(),
      })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update contact tags: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', { type: 'tags', ...payload })
  }

  /**
   * Map webhook payload to database schema
   */
  private mapToDatabase(payload: ContactWebhookPayload): Record<string, unknown> {
    // Convert custom fields array to object
    const customFieldsObj: Record<string, unknown> = {}
    if (payload.customFields && Array.isArray(payload.customFields)) {
      payload.customFields.forEach((field: Record<string, unknown>) => {
        if (field.id && field.value !== undefined) {
          customFieldsObj[field.id as string] = field.value
        }
      })
    }

    return {
      id: payload.id,
      location_id: payload.locationId,
      first_name: payload.firstName || null,
      last_name: payload.lastName || null,
      name: payload.name || `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || null,
      email: payload.email || null,
      phone: payload.phone || null,
      secondary_email: payload.secondaryEmail || null,
      company_name: payload.companyName || null,
      date_of_birth: payload.dateOfBirth || null,
      tags: payload.tags || [],
      type: payload.type || 'lead',
      dnd: payload.dnd || false,
      dnd_settings: payload.dndSettings || {},
      assigned_to: payload.assignedTo || null,
      source: payload.source || null,
      address_data: payload.address || {},
      custom_fields: customFieldsObj,
      date_added: payload.dateAdded || new Date().toISOString(),
      date_updated: payload.dateUpdated || new Date().toISOString(),
      is_deleted: false,
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
      entity_type: 'contact',
      entity_id: entityId,
      action,
      payload: payload as Record<string, unknown>,
      source: 'webhook',
    })
  }
}

export function createContactProcessor(supabase: SupabaseClient<any>): ContactProcessor {
  return new ContactProcessor(supabase)
}
