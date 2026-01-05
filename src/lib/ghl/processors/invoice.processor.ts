/**
 * Invoice Webhook Processor
 * Handles invoice-related webhook events from GHL
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface InvoiceWebhookPayload {
  id: string
  locationId: string
  contactId?: string
  invoiceNumber?: string
  name?: string
  title?: string
  status?: 'draft' | 'sent' | 'paid' | 'void' | 'partially_paid'
  dueDate?: string
  issueDate?: string
  amountDue: number
  totalAmount: number
  discount?: number
  currency?: string
  items?: unknown[]
  businessDetails?: Record<string, unknown>
  paymentTerms?: string
  notes?: string
  sentTo?: unknown[]
  createdAt?: string
  updatedAt?: string
}

export class InvoiceProcessor {
  constructor(private supabase: SupabaseClient<any>) {}

  /**
   * Process InvoiceCreate event
   */
  async handleCreate(payload: InvoiceWebhookPayload): Promise<void> {
    const invoice = this.mapToDatabase(payload)

    const { error } = await this.supabase
      .from('ghl_invoices')
      .upsert(invoice, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to create invoice: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'create', payload)
  }

  /**
   * Process InvoiceUpdate event
   */
  async handleUpdate(payload: InvoiceWebhookPayload): Promise<void> {
    const invoice = this.mapToDatabase(payload)

    const { error } = await this.supabase
      .from('ghl_invoices')
      .update(invoice)
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update invoice: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', payload)
  }

  /**
   * Process InvoiceSent event
   */
  async handleSent(payload: {
    id: string
    locationId: string
    sentTo?: unknown[]
    sentAt?: string
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_invoices')
      .update({
        status: 'sent',
        sent_to: payload.sentTo || [],
        updated_at: payload.sentAt || new Date().toISOString(),
      })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update invoice sent status: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'sent',
      ...payload,
    })
  }

  /**
   * Process InvoicePaid event
   */
  async handlePaid(payload: {
    id: string
    locationId: string
    paidAmount?: number
    paidAt?: string
  }): Promise<void> {
    const { data: invoice } = await this.supabase
      .from('ghl_invoices')
      .select('amount_due, total_amount')
      .eq('id', payload.id)
      .single()

    const updateData: Record<string, unknown> = {
      status: 'paid',
      amount_due: 0,
      updated_at: payload.paidAt || new Date().toISOString(),
    }

    const { error } = await this.supabase
      .from('ghl_invoices')
      .update(updateData)
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update invoice paid status: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'paid',
      ...payload,
    })
  }

  /**
   * Process InvoicePartiallyPaid event
   */
  async handlePartiallyPaid(payload: {
    id: string
    locationId: string
    paidAmount: number
    remainingAmount: number
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_invoices')
      .update({
        status: 'partially_paid',
        amount_due: payload.remainingAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to update invoice partially paid status: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'partially_paid',
      ...payload,
    })
  }

  /**
   * Process InvoiceVoid event
   */
  async handleVoid(payload: {
    id: string
    locationId: string
    voidReason?: string
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ghl_invoices')
      .update({
        status: 'void',
        notes: payload.voidReason
          ? `VOIDED: ${payload.voidReason}`
          : 'VOIDED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id)

    if (error) {
      throw new Error(`Failed to void invoice: ${error.message}`)
    }

    await this.logSyncAction(payload.locationId, payload.id, 'update', {
      type: 'void',
      ...payload,
    })
  }

  /**
   * Map webhook payload to database schema
   */
  private mapToDatabase(payload: InvoiceWebhookPayload): Record<string, unknown> {
    return {
      id: payload.id,
      location_id: payload.locationId,
      contact_id: payload.contactId || null,
      invoice_number: payload.invoiceNumber || null,
      name: payload.name || null,
      title: payload.title || null,
      status: payload.status || 'draft',
      due_date: payload.dueDate || null,
      issue_date: payload.issueDate || null,
      amount_due: payload.amountDue || 0,
      total_amount: payload.totalAmount || 0,
      discount: payload.discount || 0,
      currency: payload.currency || 'USD',
      items: payload.items || [],
      business_details: payload.businessDetails || {},
      payment_terms: payload.paymentTerms || null,
      notes: payload.notes || null,
      sent_to: payload.sentTo || [],
      created_at: payload.createdAt || new Date().toISOString(),
      updated_at: payload.updatedAt || new Date().toISOString(),
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
      entity_type: 'invoice',
      entity_id: entityId,
      action,
      payload: payload as Record<string, unknown>,
      source: 'webhook',
    })
  }
}

export function createInvoiceProcessor(supabase: SupabaseClient<any>): InvoiceProcessor {
  return new InvoiceProcessor(supabase)
}
