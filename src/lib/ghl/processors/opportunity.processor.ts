/**
 * Opportunity Webhook Processor
 * Handles opportunity-related webhook events from GHL
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface OpportunityWebhookPayload {
  id: string
  locationId: string
  contactId?: string
  name: string
  status?: 'open' | 'won' | 'lost' | 'abandoned'
  pipelineId: string
  pipelineStageId: string
  monetaryValue?: number
  currency?: string
  assignedTo?: string
  source?: string
  lossReason?: string
  customFields?: Record<string, unknown>[]
  notes?: string
  createdAt?: string
  updatedAt?: string
  closedAt?: string
}

export class OpportunityProcessor {
  constructor(private supabase: SupabaseClient<any>) {}

  /**
   * Process OpportunityCreate event
   */
  async handleCreate(payload: OpportunityWebhookPayload): Promise<void> {
    const opportunity = this.mapToDatabase(payload)

    const { error } = await this.supabase
      .from('ghl_opportunities')
      .upsert(opportunity, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to create opportunity: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'create', payload)
  }

  /**
   * Process OpportunityStatusUpdate event
   */
  async handleStatusUpdate(payload: {
    id: string
    locationId: string
    status: 'open' | 'won' | 'lost' | 'abandoned'
    lossReason?: string
  }): Promise<void> {
    const updateData: Record<string, unknown> = {
      status: payload.status,
      updated_at: new Date().toISOString(),
    }

    if (payload.status === 'won' || payload.status === 'lost') {
      updateData.closed_at = new Date().toISOString()
    }

    if (payload.lossReason) {
      updateData.loss_reason = payload.lossReason
    }

    const { error } = await this.supabase
      .from('ghl_opportunities')
      .update(updateData)
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update opportunity status: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'status',
      ...payload,
    })
  }

  /**
   * Process OpportunityStageUpdate event
   */
  async handleStageUpdate(payload: {
    id: string
    locationId: string
    pipelineStageId: string
    pipelineId?: string
  }): Promise<void> {
    const updateData: Record<string, unknown> = {
      pipeline_stage_id: payload.pipelineStageId,
      updated_at: new Date().toISOString(),
    }

    if (payload.pipelineId) {
      updateData.pipeline_id = payload.pipelineId
    }

    const { error } = await this.supabase
      .from('ghl_opportunities')
      .update(updateData)
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update opportunity stage: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'stage',
      ...payload,
    })
  }

  /**
   * Process OpportunityMonetaryValueUpdate event
   */
  async handleValueUpdate(payload: {
    id: string
    locationId: string
    monetaryValue: number
    currency?: string
  }): Promise<void> {
    const updateData: Record<string, unknown> = {
      monetary_value: payload.monetaryValue,
      updated_at: new Date().toISOString(),
    }

    if (payload.currency) {
      updateData.currency = payload.currency
    }

    const { error } = await this.supabase
      .from('ghl_opportunities')
      .update(updateData)
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update opportunity value: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'value',
      ...payload,
    })
  }

  /**
   * Process OpportunityAssignedToUpdate event
   */
  async handleAssignmentUpdate(payload: {
    id: string
    locationId: string
    assignedTo: string | null
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_opportunities')
      .update({
        assigned_to: payload.assignedTo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update opportunity assignment: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'assignment',
      ...payload,
    })
  }

  /**
   * Process OpportunityDelete event
   */
  async handleDelete(payload: { id: string; locationId: string }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_opportunities')
      .delete()
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to delete opportunity: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'delete', payload)
  }

  /**
   * Map webhook payload to database schema
   */
  private mapToDatabase(payload: OpportunityWebhookPayload): Record<string, unknown> {
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
      contact_id: payload.contactId || null,
      name: payload.name,
      status: payload.status || 'open',
      pipeline_id: payload.pipelineId,
      pipeline_stage_id: payload.pipelineStageId,
      monetary_value: payload.monetaryValue || 0,
      currency: payload.currency || 'USD',
      assigned_to: payload.assignedTo || null,
      source: payload.source || null,
      loss_reason: payload.lossReason || null,
      custom_fields: customFieldsObj,
      notes: payload.notes || null,
      created_at: payload.createdAt || new Date().toISOString(),
      updated_at: payload.updatedAt || new Date().toISOString(),
      closed_at: payload.closedAt || null,
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
      entity_type: 'opportunity',
      entity_id: entityId,
      action,
      payload: payload as Record<string, unknown>,
      source: 'webhook',
    })
  }
}

export function createOpportunityProcessor(supabase: SupabaseClient<any>): OpportunityProcessor {
  return new OpportunityProcessor(supabase)
}
