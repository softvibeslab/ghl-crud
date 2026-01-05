/**
 * Initial Sync Service
 * Handles the first-time synchronization when a new location is connected
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { GHLApiClient, createGHLApiClient } from './api-client'

export interface InitialSyncProgress {
  locationId: string
  tenantId: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  currentStep: string
  progress: number // 0-100
  steps: StepProgress[]
  startedAt: Date
  completedAt?: Date
  error?: string
}

export interface StepProgress {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  recordsSynced: number
  error?: string
}

const SYNC_STEPS = [
  { name: 'location', label: 'Location Details', weight: 5 },
  { name: 'pipelines', label: 'Pipelines & Stages', weight: 5 },
  { name: 'calendars', label: 'Calendars', weight: 5 },
  { name: 'users', label: 'Users', weight: 5 },
  { name: 'contacts', label: 'Contacts', weight: 40 },
  { name: 'opportunities', label: 'Opportunities', weight: 25 },
  { name: 'appointments', label: 'Appointments', weight: 10 },
  { name: 'invoices', label: 'Invoices', weight: 5 },
]

export class InitialSyncService {
  private progress: Map<string, InitialSyncProgress> = new Map()

  constructor(private supabase: SupabaseClient<any>) {}

  /**
   * Start initial sync for a new location
   */
  async startInitialSync(
    tenantId: string,
    locationId: string,
    onProgress?: (progress: InitialSyncProgress) => void
  ): Promise<InitialSyncProgress> {
    const progressKey = `${tenantId}:${locationId}`

    // Initialize progress
    const initialProgress: InitialSyncProgress = {
      locationId,
      tenantId,
      status: 'in_progress',
      currentStep: 'location',
      progress: 0,
      steps: SYNC_STEPS.map(step => ({
        name: step.name,
        status: 'pending',
        recordsSynced: 0,
      })),
      startedAt: new Date(),
    }

    this.progress.set(progressKey, initialProgress)
    await this.saveProgress(initialProgress)

    try {
      // Get API client
      const client = createGHLApiClient(this.supabase, tenantId, { locationId })

      // Execute each step
      for (const step of SYNC_STEPS) {
        const stepIndex = SYNC_STEPS.findIndex(s => s.name === step.name)
        initialProgress.currentStep = step.name
        initialProgress.steps[stepIndex].status = 'in_progress'

        try {
          const recordsSynced = await this.executeStep(client, tenantId, locationId, step.name)
          initialProgress.steps[stepIndex].status = 'completed'
          initialProgress.steps[stepIndex].recordsSynced = recordsSynced
        } catch (error) {
          initialProgress.steps[stepIndex].status = 'failed'
          initialProgress.steps[stepIndex].error =
            error instanceof Error ? error.message : String(error)
          console.error(`Step ${step.name} failed:`, error)
          // Continue with other steps
        }

        // Calculate progress
        const completedWeight = SYNC_STEPS.slice(0, stepIndex + 1)
          .filter((_, i) => initialProgress.steps[i].status === 'completed')
          .reduce((sum, s) => sum + s.weight, 0)
        initialProgress.progress = Math.round(completedWeight)

        // Save and notify progress
        await this.saveProgress(initialProgress)
        onProgress?.(initialProgress)
      }

      // Mark as completed
      initialProgress.status = 'completed'
      initialProgress.completedAt = new Date()
      initialProgress.progress = 100

      // Initialize sync status for future syncs
      await this.initializeSyncStatus(tenantId, locationId)

    } catch (error) {
      initialProgress.status = 'failed'
      initialProgress.error = error instanceof Error ? error.message : String(error)
    }

    await this.saveProgress(initialProgress)
    this.progress.delete(progressKey)

    return initialProgress
  }

  /**
   * Get current sync progress
   */
  getProgress(tenantId: string, locationId: string): InitialSyncProgress | undefined {
    return this.progress.get(`${tenantId}:${locationId}`)
  }

  /**
   * Execute a specific sync step
   */
  private async executeStep(
    client: GHLApiClient,
    tenantId: string,
    locationId: string,
    step: string
  ): Promise<number> {
    switch (step) {
      case 'location':
        return this.syncLocationDetails(client, tenantId, locationId)
      case 'pipelines':
        return this.syncPipelines(client, locationId)
      case 'calendars':
        return this.syncCalendars(client, locationId)
      case 'users':
        return this.syncUsers(client, locationId)
      case 'contacts':
        return this.syncAllContacts(client, tenantId, locationId)
      case 'opportunities':
        return this.syncAllOpportunities(client, tenantId, locationId)
      case 'appointments':
        return this.syncAllAppointments(client, locationId)
      case 'invoices':
        return this.syncAllInvoices(client, locationId)
      default:
        return 0
    }
  }

  /**
   * Sync location details
   */
  private async syncLocationDetails(
    client: GHLApiClient,
    tenantId: string,
    locationId: string
  ): Promise<number> {
    const response = await client.getLocation(locationId)

    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to fetch location')
    }

    const location = response.data as unknown as Record<string, unknown>

    await this.supabase.from('ghl_locations').upsert(
      {
        id: locationId,
        tenant_id: tenantId,
        name: location.name,
        email: location.email || null,
        phone: location.phone || null,
        website: location.website || null,
        timezone: location.timezone || 'UTC',
        address_data: location.address || {},
        settings: location.settings || {},
        logo_url: location.logoUrl || null,
        is_active: true,
        last_sync: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    return 1
  }

  /**
   * Sync pipelines and stages
   */
  private async syncPipelines(client: GHLApiClient, locationId: string): Promise<number> {
    const response = await client.getPipelines(locationId)

    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to fetch pipelines')
    }

    const pipelines = (response.data as unknown as Record<string, unknown>).pipelines as unknown[]
    let synced = 0

    for (const pipeline of pipelines || []) {
      const p = pipeline as Record<string, unknown>

      await this.supabase.from('ghl_pipelines').upsert(
        {
          id: p.id,
          location_id: locationId,
          name: p.name,
          show_in_funnel: p.showInFunnel !== false,
          show_in_pie_chart: p.showInPieChart !== false,
        },
        { onConflict: 'id' }
      )
      synced++

      // Sync stages
      const stages = p.stages as unknown[]
      for (const stage of stages || []) {
        const s = stage as Record<string, unknown>
        await this.supabase.from('ghl_pipeline_stages').upsert(
          {
            id: s.id,
            pipeline_id: p.id,
            location_id: locationId,
            name: s.name,
            position: s.position || 0,
            probability: s.probability || 0,
          },
          { onConflict: 'id' }
        )
      }
    }

    return synced
  }

  /**
   * Sync calendars
   */
  private async syncCalendars(client: GHLApiClient, locationId: string): Promise<number> {
    const response = await client.getCalendars(locationId)

    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to fetch calendars')
    }

    const calendars = (response.data as unknown as Record<string, unknown>).calendars as unknown[]
    let synced = 0

    for (const calendar of calendars || []) {
      const c = calendar as Record<string, unknown>

      await this.supabase.from('ghl_calendars').upsert(
        {
          id: c.id,
          location_id: locationId,
          name: c.name,
          description: c.description || null,
          calendar_type: c.calendarType || 'round_robin',
          is_active: c.isActive !== false,
        },
        { onConflict: 'id' }
      )
      synced++
    }

    return synced
  }

  /**
   * Sync users
   */
  private async syncUsers(client: GHLApiClient, locationId: string): Promise<number> {
    const response = await client.getUsers(locationId)

    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to fetch users')
    }

    const users = (response.data as unknown as Record<string, unknown>).users as unknown[]
    let synced = 0

    for (const user of users || []) {
      const u = user as Record<string, unknown>

      await this.supabase.from('ghl_users').upsert(
        {
          id: u.id,
          location_id: locationId,
          name: u.name || u.firstName || '',
          email: u.email,
          phone: u.phone || null,
          role: u.role || 'user',
          is_active: u.isActive !== false,
        },
        { onConflict: 'id' }
      )
      synced++
    }

    return synced
  }

  /**
   * Sync all contacts (paginated)
   */
  private async syncAllContacts(
    client: GHLApiClient,
    tenantId: string,
    locationId: string
  ): Promise<number> {
    let synced = 0
    let hasMore = true
    let startAfter: string | undefined

    while (hasMore) {
      const response = await client.getContacts({
        locationId,
        limit: 100,
        startAfter,
      })

      if (response.error) {
        throw new Error(response.error)
      }

      const data = response.data as unknown as Record<string, unknown>
      const contacts = data.contacts as unknown[]

      if (!contacts || contacts.length === 0) {
        break
      }

      // Batch upsert
      const mappedContacts = contacts.map(c => this.mapContact(c as Record<string, unknown>, tenantId, locationId))

      for (const contact of mappedContacts) {
        await this.supabase.from('ghl_contacts').upsert(contact, { onConflict: 'id' })
        synced++
      }

      // Check for more pages
      const meta = data.meta as Record<string, unknown>
      startAfter = meta?.startAfterId as string | undefined
      hasMore = !!startAfter && contacts.length === 100
    }

    return synced
  }

  /**
   * Sync all opportunities (paginated)
   */
  private async syncAllOpportunities(
    client: GHLApiClient,
    tenantId: string,
    locationId: string
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

      if (response.error) {
        throw new Error(response.error)
      }

      const data = response.data as unknown as Record<string, unknown>
      const opportunities = data.opportunities as unknown[]

      if (!opportunities || opportunities.length === 0) {
        break
      }

      for (const opp of opportunities) {
        const o = opp as Record<string, unknown>
        await this.supabase.from('ghl_opportunities').upsert(
          {
            id: o.id,
            location_id: locationId,
            tenant_id: tenantId,
            contact_id: o.contactId || null,
            name: o.name,
            status: o.status || 'open',
            pipeline_id: o.pipelineId,
            pipeline_stage_id: o.pipelineStageId || o.stageId,
            monetary_value: o.monetaryValue || 0,
            currency: o.currency || 'USD',
            assigned_to: o.assignedTo || null,
          },
          { onConflict: 'id' }
        )
        synced++
      }

      const meta = data.meta as Record<string, unknown>
      startAfter = meta?.startAfterId as string | undefined
      hasMore = !!startAfter && opportunities.length === 100
    }

    return synced
  }

  /**
   * Sync all appointments
   */
  private async syncAllAppointments(client: GHLApiClient, locationId: string): Promise<number> {
    // Sync appointments for the next 90 days
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30) // Include past 30 days
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 60) // Include next 60 days

    const response = await client.getCalendarEvents({
      locationId,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    })

    if (response.error) {
      throw new Error(response.error)
    }

    const data = response.data as unknown as Record<string, unknown>
    const events = data.events as unknown[]
    let synced = 0

    for (const event of events || []) {
      const e = event as Record<string, unknown>
      await this.supabase.from('ghl_appointments').upsert(
        {
          id: e.id,
          location_id: locationId,
          contact_id: e.contactId || null,
          calendar_id: e.calendarId || null,
          title: e.title || e.name || 'Appointment',
          status: e.status || 'confirmed',
          start_time: e.startTime,
          end_time: e.endTime,
          timezone: e.timezone || 'UTC',
          assigned_user_id: e.assignedUserId || null,
        },
        { onConflict: 'id' }
      )
      synced++
    }

    return synced
  }

  /**
   * Sync all invoices
   */
  private async syncAllInvoices(client: GHLApiClient, locationId: string): Promise<number> {
    const response = await client.getInvoices({ locationId, limit: 100 })

    if (response.error) {
      throw new Error(response.error)
    }

    const data = response.data as unknown as Record<string, unknown>
    const invoices = data.invoices as unknown[]
    let synced = 0

    for (const invoice of invoices || []) {
      const i = invoice as Record<string, unknown>
      await this.supabase.from('ghl_invoices').upsert(
        {
          id: i.id,
          location_id: locationId,
          contact_id: i.contactId || null,
          invoice_number: i.invoiceNumber || null,
          name: i.name || null,
          status: i.status || 'draft',
          due_date: i.dueDate || null,
          amount_due: i.amountDue || 0,
          total_amount: i.totalAmount || 0,
          currency: i.currency || 'USD',
        },
        { onConflict: 'id' }
      )
      synced++
    }

    return synced
  }

  /**
   * Initialize sync status records for future incremental syncs
   */
  private async initializeSyncStatus(tenantId: string, locationId: string): Promise<void> {
    const entityTypes = ['contacts', 'opportunities', 'appointments', 'invoices', 'calendars', 'pipelines', 'users']
    const now = new Date()

    const syncIntervals: Record<string, number> = {
      contacts: 15,
      opportunities: 10,
      appointments: 5,
      invoices: 30,
      calendars: 60,
      pipelines: 1440, // 24 hours
      users: 60,
    }

    for (const entityType of entityTypes) {
      const nextSync = new Date(now.getTime() + syncIntervals[entityType] * 60 * 1000)

      await this.supabase.from('sync_status').upsert(
        {
          tenant_id: tenantId,
          location_id: locationId,
          entity_type: entityType,
          status: 'healthy',
          last_sync_at: now.toISOString(),
          next_sync_at: nextSync.toISOString(),
          records_synced: 0,
        },
        { onConflict: 'tenant_id,location_id,entity_type' }
      )
    }
  }

  /**
   * Save progress to database
   */
  private async saveProgress(progress: InitialSyncProgress): Promise<void> {
    await this.supabase.from('ghl_sync_log').insert({
      location_id: progress.locationId,
      entity_type: 'initial_sync',
      entity_id: progress.locationId,
      action: 'sync',
      payload: progress,
      source: 'initial_sync',
    })
  }

  /**
   * Map contact to database format
   */
  private mapContact(
    record: Record<string, unknown>,
    tenantId: string,
    locationId: string
  ): Record<string, unknown> {
    return {
      id: record.id,
      tenant_id: tenantId,
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
}

/**
 * Create initial sync service
 */
export function createInitialSyncService(supabase: SupabaseClient<any>): InitialSyncService {
  return new InitialSyncService(supabase)
}
