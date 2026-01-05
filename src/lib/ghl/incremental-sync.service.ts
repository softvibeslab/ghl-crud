/**
 * Incremental Sync Service
 * Handles scheduled polling-based synchronization with GHL API
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { GHLApiClient, createGHLApiClient } from './api-client'

// Sync intervals
const SYNC_INTERVALS = {
  contacts: 15 * 60 * 1000, // 15 minutes
  opportunities: 10 * 60 * 1000, // 10 minutes
  appointments: 5 * 60 * 1000, // 5 minutes
  invoices: 30 * 60 * 1000, // 30 minutes
  calendars: 60 * 60 * 1000, // 1 hour
  pipelines: 24 * 60 * 60 * 1000, // 24 hours
  users: 60 * 60 * 1000, // 1 hour
}

export interface SyncTask {
  tenantId: string
  locationId: string
  entityType: string
  lastSyncAt: Date | null
  nextSyncAt: Date
}

export interface SyncBatchResult {
  success: boolean
  entityType: string
  locationId: string
  recordsSynced: number
  errors: string[]
  duration: number
}

export class IncrementalSyncService {
  constructor(private supabase: SupabaseClient<any>) {}

  /**
   * Get pending sync tasks
   */
  async getPendingSyncTasks(limit = 10): Promise<SyncTask[]> {
    const now = new Date()

    const { data, error } = await this.supabase
      .from('sync_status')
      .select('tenant_id, location_id, entity_type, last_sync_at, next_sync_at')
      .lte('next_sync_at', now.toISOString())
      .eq('status', 'idle')
      .order('next_sync_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Failed to get pending sync tasks:', error)
      return []
    }

    return (data || []).map(row => ({
      tenantId: row.tenant_id,
      locationId: row.location_id,
      entityType: row.entity_type,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
      nextSyncAt: new Date(row.next_sync_at),
    }))
  }

  /**
   * Execute sync for a specific entity type and location
   */
  async syncEntity(
    tenantId: string,
    locationId: string,
    entityType: string,
    lastSyncAt: Date | null
  ): Promise<SyncBatchResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let recordsSynced = 0

    try {
      // Mark as syncing
      await this.updateSyncStatus(tenantId, locationId, entityType, 'syncing')

      // Get API client
      const client = await this.getApiClient(tenantId, locationId)

      // Fetch and sync based on entity type
      switch (entityType) {
        case 'contacts':
          recordsSynced = await this.syncContacts(client, locationId, lastSyncAt)
          break
        case 'opportunities':
          recordsSynced = await this.syncOpportunities(client, locationId, lastSyncAt)
          break
        case 'appointments':
          recordsSynced = await this.syncAppointments(client, locationId, lastSyncAt)
          break
        case 'calendars':
          recordsSynced = await this.syncCalendars(client, locationId)
          break
        case 'pipelines':
          recordsSynced = await this.syncPipelines(client, locationId)
          break
        case 'users':
          recordsSynced = await this.syncUsers(client, locationId)
          break
        case 'invoices':
          recordsSynced = await this.syncInvoices(client, locationId, lastSyncAt)
          break
        default:
          throw new Error(`Unknown entity type: ${entityType}`)
      }

      // Calculate next sync time
      const interval = SYNC_INTERVALS[entityType as keyof typeof SYNC_INTERVALS] || 60 * 60 * 1000
      const nextSyncAt = new Date(Date.now() + interval)

      // Mark as completed
      await this.updateSyncStatus(
        tenantId,
        locationId,
        entityType,
        'idle',
        recordsSynced,
        null,
        nextSyncAt
      )

      return {
        success: true,
        entityType,
        locationId,
        recordsSynced,
        errors,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      errors.push(errorMessage)

      // Mark as error
      await this.updateSyncStatus(
        tenantId,
        locationId,
        entityType,
        'error',
        recordsSynced,
        errorMessage
      )

      return {
        success: false,
        entityType,
        locationId,
        recordsSynced,
        errors,
        duration: Date.now() - startTime,
      }
    }
  }

  /**
   * Sync contacts incrementally
   */
  private async syncContacts(
    client: GHLApiClient,
    locationId: string,
    lastSyncAt: Date | null
  ): Promise<number> {
    let synced = 0
    let hasMore = true
    let startAfter: string | undefined

    while (hasMore) {
      const response = await client.getContacts({
        locationId,
        limit: 100,
        startAfter,
        // Note: GHL API may not support filtering by updated date
      })

      if (!response.data || response.error) {
        throw new Error(response.error || 'Failed to fetch contacts')
      }

      const contacts = (response.data as unknown as Record<string, unknown>).contacts as unknown[]

      if (!contacts || contacts.length === 0) {
        hasMore = false
        break
      }

      // Upsert contacts
      for (const contact of contacts) {
        const mapped = this.mapContact(contact as Record<string, unknown>, locationId)
        await this.supabase.from('ghl_contacts').upsert(mapped, { onConflict: 'id' })
        synced++
      }

      // Check for more pages
      const meta = (response.data as unknown as Record<string, unknown>).meta as Record<string, unknown>
      startAfter = meta?.startAfterId as string | undefined
      hasMore = !!startAfter && contacts.length === 100
    }

    return synced
  }

  /**
   * Sync opportunities incrementally
   */
  private async syncOpportunities(
    client: GHLApiClient,
    locationId: string,
    lastSyncAt: Date | null
  ): Promise<number> {
    let synced = 0
    let hasMore = true
    let startAfter: string | undefined

    while (hasMore) {
      const response = await client.getOpportunities({
        locationId,
        limit: 100,
        startAfter,
      })

      if (!response.data || response.error) {
        throw new Error(response.error || 'Failed to fetch opportunities')
      }

      const opportunities = (response.data as unknown as Record<string, unknown>).opportunities as unknown[]

      if (!opportunities || opportunities.length === 0) {
        hasMore = false
        break
      }

      // Upsert opportunities
      for (const opp of opportunities) {
        const mapped = this.mapOpportunity(opp as Record<string, unknown>, locationId)
        await this.supabase.from('ghl_opportunities').upsert(mapped, { onConflict: 'id' })
        synced++
      }

      // Check for more pages
      const meta = (response.data as unknown as Record<string, unknown>).meta as Record<string, unknown>
      startAfter = meta?.startAfterId as string | undefined
      hasMore = !!startAfter && opportunities.length === 100
    }

    return synced
  }

  /**
   * Sync appointments
   */
  private async syncAppointments(
    client: GHLApiClient,
    locationId: string,
    lastSyncAt: Date | null
  ): Promise<number> {
    // Fetch appointments for the next 30 days
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 30)

    const response = await client.getCalendarEvents({
      locationId,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    })

    if (!response.data || response.error) {
      throw new Error(response.error || 'Failed to fetch appointments')
    }

    const events = (response.data as unknown as Record<string, unknown>).events as unknown[]

    if (!events || events.length === 0) {
      return 0
    }

    // Upsert appointments
    let synced = 0
    for (const event of events) {
      const mapped = this.mapAppointment(event as Record<string, unknown>, locationId)
      await this.supabase.from('ghl_appointments').upsert(mapped, { onConflict: 'id' })
      synced++
    }

    return synced
  }

  /**
   * Sync calendars
   */
  private async syncCalendars(client: GHLApiClient, locationId: string): Promise<number> {
    const response = await client.getCalendars(locationId)

    if (!response.data || response.error) {
      throw new Error(response.error || 'Failed to fetch calendars')
    }

    const calendars = (response.data as unknown as Record<string, unknown>).calendars as unknown[]

    if (!calendars || calendars.length === 0) {
      return 0
    }

    // Upsert calendars
    let synced = 0
    for (const calendar of calendars) {
      const mapped = this.mapCalendar(calendar as Record<string, unknown>, locationId)
      await this.supabase.from('ghl_calendars').upsert(mapped, { onConflict: 'id' })
      synced++
    }

    return synced
  }

  /**
   * Sync pipelines
   */
  private async syncPipelines(client: GHLApiClient, locationId: string): Promise<number> {
    const response = await client.getPipelines(locationId)

    if (!response.data || response.error) {
      throw new Error(response.error || 'Failed to fetch pipelines')
    }

    const pipelines = (response.data as unknown as Record<string, unknown>).pipelines as unknown[]

    if (!pipelines || pipelines.length === 0) {
      return 0
    }

    // Upsert pipelines and stages
    let synced = 0
    for (const pipeline of pipelines) {
      const pipelineData = pipeline as Record<string, unknown>
      const mappedPipeline = this.mapPipeline(pipelineData, locationId)
      await this.supabase.from('ghl_pipelines').upsert(mappedPipeline, { onConflict: 'id' })
      synced++

      // Sync stages
      const stages = pipelineData.stages as unknown[]
      if (stages) {
        for (const stage of stages) {
          const mappedStage = this.mapPipelineStage(
            stage as Record<string, unknown>,
            pipelineData.id as string,
            locationId
          )
          await this.supabase.from('ghl_pipeline_stages').upsert(mappedStage, { onConflict: 'id' })
        }
      }
    }

    return synced
  }

  /**
   * Sync users
   */
  private async syncUsers(client: GHLApiClient, locationId: string): Promise<number> {
    const response = await client.getUsers(locationId)

    if (!response.data || response.error) {
      throw new Error(response.error || 'Failed to fetch users')
    }

    const users = (response.data as unknown as Record<string, unknown>).users as unknown[]

    if (!users || users.length === 0) {
      return 0
    }

    // Upsert users
    let synced = 0
    for (const user of users) {
      const mapped = this.mapUser(user as Record<string, unknown>, locationId)
      await this.supabase.from('ghl_users').upsert(mapped, { onConflict: 'id' })
      synced++
    }

    return synced
  }

  /**
   * Sync invoices
   */
  private async syncInvoices(
    client: GHLApiClient,
    locationId: string,
    lastSyncAt: Date | null
  ): Promise<number> {
    const response = await client.getInvoices({ locationId, limit: 100 })

    if (!response.data || response.error) {
      throw new Error(response.error || 'Failed to fetch invoices')
    }

    const invoices = (response.data as unknown as Record<string, unknown>).invoices as unknown[]

    if (!invoices || invoices.length === 0) {
      return 0
    }

    // Upsert invoices
    let synced = 0
    for (const invoice of invoices) {
      const mapped = this.mapInvoice(invoice as Record<string, unknown>, locationId)
      await this.supabase.from('ghl_invoices').upsert(mapped, { onConflict: 'id' })
      synced++
    }

    return synced
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private async getApiClient(tenantId: string, locationId: string): Promise<GHLApiClient> {
    return createGHLApiClient(this.supabase, tenantId, { locationId })
  }

  private async updateSyncStatus(
    tenantId: string,
    locationId: string,
    entityType: string,
    status: 'idle' | 'syncing' | 'error',
    recordsSynced?: number,
    errorMessage?: string | null,
    nextSyncAt?: Date
  ): Promise<void> {
    const now = new Date()

    await this.supabase.from('sync_status').upsert(
      {
        tenant_id: tenantId,
        location_id: locationId,
        entity_type: entityType,
        status,
        last_sync_at: status === 'idle' ? now.toISOString() : undefined,
        next_sync_at: nextSyncAt?.toISOString(),
        records_synced: recordsSynced,
        error_message: errorMessage,
        updated_at: now.toISOString(),
      },
      { onConflict: 'tenant_id,location_id,entity_type' }
    )
  }

  // ========================================
  // MAPPING METHODS
  // ========================================

  private mapContact(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      first_name: record.firstName || null,
      last_name: record.lastName || null,
      name: record.name || null,
      email: record.email || null,
      phone: record.phone || null,
      company_name: record.companyName || null,
      tags: record.tags || [],
      type: record.type || 'lead',
      dnd: record.dnd || false,
      assigned_to: record.assignedTo || null,
      source: record.source || null,
      date_added: record.dateAdded || new Date().toISOString(),
      date_updated: record.dateUpdated || new Date().toISOString(),
      is_deleted: false,
    }
  }

  private mapOpportunity(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      contact_id: record.contactId || null,
      name: record.name,
      status: record.status || 'open',
      pipeline_id: record.pipelineId,
      pipeline_stage_id: record.pipelineStageId || record.stageId,
      monetary_value: record.monetaryValue || 0,
      currency: record.currency || 'USD',
      assigned_to: record.assignedTo || null,
      created_at: record.createdAt || new Date().toISOString(),
      updated_at: record.updatedAt || new Date().toISOString(),
    }
  }

  private mapAppointment(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      contact_id: record.contactId || null,
      calendar_id: record.calendarId || null,
      title: record.title || record.name || 'Appointment',
      status: record.status || 'confirmed',
      start_time: record.startTime,
      end_time: record.endTime,
      timezone: record.timezone || 'UTC',
      assigned_user_id: record.assignedUserId || null,
      updated_at: new Date().toISOString(),
    }
  }

  private mapCalendar(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      name: record.name,
      description: record.description || null,
      calendar_type: record.calendarType || 'round_robin',
      is_active: record.isActive !== false,
      updated_at: new Date().toISOString(),
    }
  }

  private mapPipeline(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      name: record.name,
      show_in_funnel: record.showInFunnel || true,
      show_in_pie_chart: record.showInPieChart || true,
      updated_at: new Date().toISOString(),
    }
  }

  private mapPipelineStage(
    record: Record<string, unknown>,
    pipelineId: string,
    locationId: string
  ): Record<string, unknown> {
    return {
      id: record.id,
      pipeline_id: pipelineId,
      location_id: locationId,
      name: record.name,
      position: record.position || 0,
      probability: record.probability || 0,
      updated_at: new Date().toISOString(),
    }
  }

  private mapUser(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      name: record.name || record.firstName || '',
      email: record.email,
      phone: record.phone || null,
      role: record.role || 'user',
      is_active: record.isActive !== false,
      updated_at: new Date().toISOString(),
    }
  }

  private mapInvoice(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      contact_id: record.contactId || null,
      invoice_number: record.invoiceNumber || null,
      name: record.name || null,
      status: record.status || 'draft',
      due_date: record.dueDate || null,
      amount_due: record.amountDue || 0,
      total_amount: record.totalAmount || 0,
      currency: record.currency || 'USD',
      updated_at: new Date().toISOString(),
    }
  }
}

/**
 * Create incremental sync service
 */
export function createIncrementalSyncService(supabase: SupabaseClient<any>): IncrementalSyncService {
  return new IncrementalSyncService(supabase)
}
