/**
 * Appointment Webhook Processor
 * Handles appointment-related webhook events from GHL
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface AppointmentWebhookPayload {
  id: string
  locationId: string
  contactId?: string
  calendarId?: string
  title: string
  status?: 'confirmed' | 'cancelled' | 'showed' | 'noshow' | 'invalid'
  startTime: string
  endTime: string
  timezone?: string
  assignedUserId?: string
  appointmentType?: string
  notes?: string
  address?: string
  googleEventId?: string
  appointmentStatus?: string
}

export class AppointmentProcessor {
  constructor(private supabase: SupabaseClient<any>) {}

  /**
   * Process AppointmentCreate event
   */
  async handleCreate(payload: AppointmentWebhookPayload): Promise<void> {
    const appointment = this.mapToDatabase(payload)

    const { error } = await this.supabase
      .from('ghl_appointments')
      .upsert(appointment, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to create appointment: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'create', payload)
  }

  /**
   * Process AppointmentUpdate event
   */
  async handleUpdate(payload: AppointmentWebhookPayload): Promise<void> {
    const appointment = this.mapToDatabase(payload)

    const { error } = await this.supabase
      .from('ghl_appointments')
      .update(appointment)
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update appointment: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', payload)
  }

  /**
   * Process AppointmentDelete event
   */
  async handleDelete(payload: { id: string; locationId: string }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_appointments')
      .delete()
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to delete appointment: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'delete', payload)
  }

  /**
   * Process AppointmentStatusUpdate event
   */
  async handleStatusUpdate(payload: {
    id: string
    locationId: string
    status: 'confirmed' | 'cancelled' | 'showed' | 'noshow' | 'invalid'
    appointmentStatus?: string
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_appointments')
      .update({
        status: payload.status,
        appointment_status: payload.appointmentStatus || payload.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update appointment status: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'status',
      ...payload,
    })
  }

  /**
   * Map webhook payload to database schema
   */
  private mapToDatabase(payload: AppointmentWebhookPayload): Record<string, unknown> {
    return {
      id: payload.id,
      location_id: payload.locationId,
      contact_id: payload.contactId || null,
      calendar_id: payload.calendarId || null,
      title: payload.title,
      status: payload.status || 'confirmed',
      start_time: payload.startTime,
      end_time: payload.endTime,
      timezone: payload.timezone || 'UTC',
      assigned_user_id: payload.assignedUserId || null,
      appointment_type: payload.appointmentType || null,
      notes: payload.notes || null,
      address: payload.address || null,
      google_event_id: payload.googleEventId || null,
      appointment_status: payload.appointmentStatus || payload.status || 'confirmed',
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
      entity_type: 'appointment',
      entity_id: entityId,
      action,
      payload: payload as Record<string, unknown>,
      source: 'webhook',
    })
  }
}

export function createAppointmentProcessor(supabase: SupabaseClient<any>): AppointmentProcessor {
  return new AppointmentProcessor(supabase)
}
