/**
 * GHL Sync Service
 * Handles polling-based synchronization with GoHighLevel
 */

import { SupabaseClient } from '@supabase/supabase-js'

// Note: Using 'any' for Supabase client until migrations are applied and types regenerated
import { GHLApiClient, createGHLApiClient } from './api-client'

// Sync options
export interface SyncOptions {
  entityTypes?: string[]
  fullSync?: boolean
  limit?: number
}

// Sync result
export interface SyncResult {
  success: boolean
  entityType: string
  recordsSynced: number
  errors: string[]
  duration: number
}

// Entity sync configuration
interface EntitySyncConfig {
  tableName: string
  apiMethod: (client: GHLApiClient, locationId: string, lastSync?: Date) => Promise<unknown[]>
  mapToDatabase: (record: Record<string, unknown>, locationId: string) => Record<string, unknown>
}

// Sync Service class
export class GHLSyncService {
  private supabase: SupabaseClient<any>

  constructor(supabase: SupabaseClient<any>) {
    this.supabase = supabase
  }

  /**
   * Get entity sync configurations
   */
  private getEntityConfigs(): Record<string, EntitySyncConfig> {
    return {
      contacts: {
        tableName: 'ghl_contacts',
        apiMethod: async (client, locationId) => {
          const result = await client.getContacts({ locationId, limit: 100 })
          return (result.data?.data as unknown[]) || []
        },
        mapToDatabase: this.mapContact.bind(this),
      },
      opportunities: {
        tableName: 'ghl_opportunities',
        apiMethod: async (client, locationId) => {
          const result = await client.getOpportunities({ locationId, limit: 100 })
          return (result.data?.data as unknown[]) || []
        },
        mapToDatabase: this.mapOpportunity.bind(this),
      },
      appointments: {
        tableName: 'ghl_appointments',
        apiMethod: async (client, locationId) => {
          const result = await client.getCalendarEvents({ locationId })
          return ((result.data as Record<string, unknown>)?.events as unknown[]) || []
        },
        mapToDatabase: this.mapAppointment.bind(this),
      },
      calendars: {
        tableName: 'ghl_calendars',
        apiMethod: async (client, locationId) => {
          const result = await client.getCalendars(locationId)
          return ((result.data as Record<string, unknown>)?.calendars as unknown[]) || []
        },
        mapToDatabase: this.mapCalendar.bind(this),
      },
      pipelines: {
        tableName: 'ghl_pipelines',
        apiMethod: async (client, locationId) => {
          const result = await client.getPipelines(locationId)
          return ((result.data as Record<string, unknown>)?.pipelines as unknown[]) || []
        },
        mapToDatabase: this.mapPipeline.bind(this),
      },
      products: {
        tableName: 'ghl_products',
        apiMethod: async (client, locationId) => {
          const result = await client.getProducts(locationId)
          return ((result.data as Record<string, unknown>)?.products as unknown[]) || []
        },
        mapToDatabase: this.mapProduct.bind(this),
      },
      users: {
        tableName: 'ghl_users',
        apiMethod: async (client, locationId) => {
          const result = await client.getUsers(locationId)
          return ((result.data as Record<string, unknown>)?.users as unknown[]) || []
        },
        mapToDatabase: this.mapUser.bind(this),
      },
      workflows: {
        tableName: 'ghl_workflows',
        apiMethod: async (client, locationId) => {
          const result = await client.getWorkflows(locationId)
          return ((result.data as Record<string, unknown>)?.workflows as unknown[]) || []
        },
        mapToDatabase: this.mapWorkflow.bind(this),
      },
    }
  }

  /**
   * Sync a single location
   */
  async syncLocation(
    tenantId: string,
    locationId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = []
    const client = createGHLApiClient(this.supabase, tenantId, { locationId })
    const configs = this.getEntityConfigs()

    const entityTypes = options.entityTypes || Object.keys(configs)

    for (const entityType of entityTypes) {
      const config = configs[entityType]
      if (!config) continue

      const startTime = Date.now()
      const errors: string[] = []
      let recordsSynced = 0

      try {
        // Update sync status to syncing
        await this.updateSyncStatus(tenantId, locationId, entityType, 'syncing')

        // Fetch records from GHL
        const records = await config.apiMethod(client, locationId)

        // Map and upsert records
        for (const record of records) {
          try {
            const mapped = config.mapToDatabase(record as Record<string, unknown>, locationId)

            const { error } = await this.supabase
              .from(config.tableName)
              .upsert(mapped, { onConflict: 'id' })

            if (error) {
              errors.push(`${entityType}:${(record as Record<string, unknown>).id}: ${error.message}`)
            } else {
              recordsSynced++
            }
          } catch (err) {
            errors.push(`${entityType}:${(record as Record<string, unknown>).id}: ${err}`)
          }
        }

        // Update sync status
        await this.updateSyncStatus(
          tenantId,
          locationId,
          entityType,
          errors.length > 0 ? 'degraded' : 'healthy',
          recordsSynced,
          errors[0]
        )

        // Log to sync_log
        await this.logSync(locationId, entityType, recordsSynced, 'poll')
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(errorMsg)

        await this.updateSyncStatus(tenantId, locationId, entityType, 'error', 0, errorMsg)
      }

      results.push({
        success: errors.length === 0,
        entityType,
        recordsSynced,
        errors,
        duration: Date.now() - startTime,
      })
    }

    // Update location last_sync
    await this.supabase
      .from('ghl_locations')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', locationId)

    return results
  }

  /**
   * Initial sync for a new location
   */
  async initialSync(tenantId: string, locationId: string): Promise<SyncResult[]> {
    // First, sync the location details
    const client = createGHLApiClient(this.supabase, tenantId, { locationId })
    const locationResult = await client.getLocation(locationId)

    if (locationResult.data) {
      const locationData = locationResult.data as Record<string, unknown>
      await this.supabase.from('ghl_locations').upsert({
        id: locationId,
        tenant_id: tenantId,
        name: locationData.name as string,
        email: locationData.email as string,
        phone: locationData.phone as string,
        website: locationData.website as string,
        timezone: locationData.timezone as string || 'America/New_York',
        address_data: locationData.address || {},
        settings: locationData.settings || {},
        is_active: true,
      })
    }

    // Sync all entities
    return this.syncLocation(tenantId, locationId, { fullSync: true })
  }

  /**
   * Incremental sync (for scheduled polling)
   */
  async incrementalSync(tenantId: string, locationId: string): Promise<SyncResult[]> {
    // Get last sync time
    const { data: location } = await this.supabase
      .from('ghl_locations')
      .select('last_sync')
      .eq('id', locationId)
      .single()

    const lastSync = location?.last_sync ? new Date(location.last_sync) : undefined

    // Only sync entities that need updates
    const priorityEntities = ['contacts', 'opportunities', 'appointments']

    return this.syncLocation(tenantId, locationId, {
      entityTypes: priorityEntities,
    })
  }

  /**
   * Update sync status
   */
  private async updateSyncStatus(
    tenantId: string,
    locationId: string,
    entityType: string,
    status: string,
    recordsSynced?: number,
    lastError?: string
  ): Promise<void> {
    const now = new Date().toISOString()
    const nextPoll = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

    await this.supabase.from('sync_status').upsert(
      {
        tenant_id: tenantId,
        location_id: locationId,
        entity_type: entityType,
        status,
        last_poll_at: now,
        next_poll_at: nextPoll,
        records_synced: recordsSynced,
        last_error: lastError,
        errors_count: lastError
          ? (await this.getErrorCount(tenantId, locationId, entityType)) + 1
          : 0,
      },
      { onConflict: 'tenant_id,location_id,entity_type' }
    )
  }

  /**
   * Get current error count
   */
  private async getErrorCount(
    tenantId: string,
    locationId: string,
    entityType: string
  ): Promise<number> {
    const { data } = await this.supabase
      .from('sync_status')
      .select('errors_count')
      .eq('tenant_id', tenantId)
      .eq('location_id', locationId)
      .eq('entity_type', entityType)
      .single()

    return data?.errors_count || 0
  }

  /**
   * Log sync operation
   */
  private async logSync(
    locationId: string,
    entityType: string,
    count: number,
    source: string
  ): Promise<void> {
    await this.supabase.from('ghl_sync_log').insert({
      location_id: locationId,
      entity_type: entityType,
      entity_id: `bulk_${new Date().toISOString()}`,
      action: 'sync',
      payload: { count, source },
      source,
    })
  }

  // ============================================
  // DATA MAPPERS
  // ============================================

  private mapContact(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      first_name: record.firstName,
      last_name: record.lastName,
      email: record.email,
      phone: record.phone,
      company_name: record.companyName,
      tags: record.tags || [],
      type: record.type || 'lead',
      dnd: record.dnd || false,
      assigned_to: record.assignedTo,
      source: record.source,
      address_data: record.address || {},
      custom_fields: record.customFields || [],
      date_added: record.dateAdded,
      date_updated: record.dateUpdated || new Date().toISOString(),
    }
  }

  private mapOpportunity(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      contact_id: record.contactId,
      name: record.name,
      status: record.status || 'open',
      pipeline_id: record.pipelineId,
      pipeline_stage_id: record.pipelineStageId,
      monetary_value: record.monetaryValue || 0,
      currency: record.currency || 'USD',
      assigned_to: record.assignedTo,
      source: record.source,
      created_at: record.createdAt,
      updated_at: record.updatedAt || new Date().toISOString(),
    }
  }

  private mapAppointment(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      contact_id: record.contactId,
      calendar_id: record.calendarId,
      title: record.title,
      status: record.appointmentStatus || 'confirmed',
      start_time: record.startTime,
      end_time: record.endTime,
      timezone: record.timezone || 'America/New_York',
      assigned_user_id: record.assignedUserId,
      notes: record.notes,
      address: record.address,
    }
  }

  private mapCalendar(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      name: record.name,
      description: record.description,
      slug: record.slug,
      calendar_type: record.calendarType || 'round_robin',
      team_members: record.teamMembers || [],
      slot_duration: record.slotDuration || 30,
      slot_buffer: record.slotBuffer || 0,
      is_active: record.isActive !== false,
    }
  }

  private mapPipeline(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      name: record.name,
      show_in_funnel: record.showInFunnel !== false,
      show_in_pie_chart: record.showInPieChart !== false,
    }
  }

  private mapProduct(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      name: record.name,
      description: record.description,
      product_type: record.productType || 'DIGITAL',
      price: record.price || 0,
      currency: record.currency || 'USD',
      image_url: record.imageUrl,
      available_in_store: record.availableInStore !== false,
    }
  }

  private mapUser(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      name: record.name,
      email: record.email,
      phone: record.phone,
      role: record.role || 'user',
      permissions: record.permissions || {},
      is_active: record.isActive !== false,
    }
  }

  private mapWorkflow(record: Record<string, unknown>, locationId: string): Record<string, unknown> {
    return {
      id: record.id,
      location_id: locationId,
      name: record.name,
      status: record.status || 'draft',
      version: record.version || 1,
      trigger_types: record.triggerTypes || [],
      description: record.description,
    }
  }
}

// Factory function
export function createSyncService(supabase: SupabaseClient<any>): GHLSyncService {
  return new GHLSyncService(supabase)
}
