/**
 * Daily Reconciliation Cron Endpoint
 * GET /api/cron/reconcile
 *
 * Runs daily to perform full reconciliation between local and GHL data
 * Identifies and fixes data inconsistencies
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createGHLApiClient } from '@/lib/ghl/api-client'

// Vercel cron configuration - runs daily at 2 AM
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max

/**
 * Verify cron secret (for security)
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return process.env.NODE_ENV === 'development'
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results = {
    locationsProcessed: 0,
    contactsReconciled: 0,
    opportunitiesReconciled: 0,
    discrepanciesFound: 0,
    errors: [] as string[],
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get all active locations
    const { data: locations, error: locError } = await supabase
      .from('ghl_locations')
      .select('id, tenant_id')
      .eq('is_active', true)

    if (locError) {
      throw new Error(`Failed to fetch locations: ${locError.message}`)
    }

    for (const location of locations || []) {
      try {
        // Check time limit (leave 30s buffer)
        if (Date.now() - startTime > 270000) {
          console.log('Approaching timeout, stopping reconciliation')
          break
        }

        const client = createGHLApiClient(supabase, location.tenant_id, {
          locationId: location.id,
        })

        // Reconcile contacts count
        const contactsReconciled = await reconcileContactCounts(
          supabase,
          client,
          location.id
        )
        results.contactsReconciled += contactsReconciled.synced
        results.discrepanciesFound += contactsReconciled.discrepancies

        // Reconcile opportunities count
        const oppsReconciled = await reconcileOpportunityCounts(
          supabase,
          client,
          location.id
        )
        results.opportunitiesReconciled += oppsReconciled.synced
        results.discrepanciesFound += oppsReconciled.discrepancies

        // Clean up orphaned records
        await cleanupOrphanedRecords(supabase, location.id)

        results.locationsProcessed++
      } catch (error) {
        const errorMsg = `Location ${location.id}: ${error instanceof Error ? error.message : String(error)}`
        results.errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    // Log reconciliation summary
    await supabase.from('ghl_sync_log').insert({
      entity_type: 'reconciliation',
      entity_id: 'daily',
      action: 'sync',
      payload: results,
      source: 'cron',
    })

    return NextResponse.json({
      success: true,
      ...results,
      duration: Date.now() - startTime,
    })
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed',
        ...results,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

/**
 * Reconcile contact counts between local and GHL
 */
async function reconcileContactCounts(
  supabase: any,
  client: any,
  locationId: string
): Promise<{ synced: number; discrepancies: number }> {
  // Get local count
  const { count: localCount } = await supabase
    .from('ghl_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('is_deleted', false)

  // Get GHL count (fetch first page to get total)
  const response = await client.getContacts({ locationId, limit: 1 })
  const ghlTotal = (response.data as any)?.meta?.total || 0

  const discrepancy = Math.abs(ghlTotal - (localCount || 0))

  // If significant discrepancy (>10%), trigger full sync
  if (discrepancy > Math.max(ghlTotal, localCount || 0) * 0.1) {
    console.log(`Contact discrepancy for ${locationId}: local=${localCount}, ghl=${ghlTotal}`)

    // Mark for resync
    await supabase.from('sync_status').upsert(
      {
        location_id: locationId,
        entity_type: 'contacts',
        status: 'pending',
        next_sync_at: new Date().toISOString(), // Immediate resync
        error_message: `Discrepancy: local=${localCount}, ghl=${ghlTotal}`,
      },
      { onConflict: 'location_id,entity_type' }
    )

    return { synced: 0, discrepancies: discrepancy }
  }

  return { synced: localCount || 0, discrepancies: 0 }
}

/**
 * Reconcile opportunity counts between local and GHL
 */
async function reconcileOpportunityCounts(
  supabase: any,
  client: any,
  locationId: string
): Promise<{ synced: number; discrepancies: number }> {
  // Get local count
  const { count: localCount } = await supabase
    .from('ghl_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)

  // Get GHL count
  const response = await client.getOpportunities({ locationId, limit: 1 })
  const ghlTotal = (response.data as any)?.meta?.total || 0

  const discrepancy = Math.abs(ghlTotal - (localCount || 0))

  if (discrepancy > Math.max(ghlTotal, localCount || 0) * 0.1) {
    console.log(`Opportunity discrepancy for ${locationId}: local=${localCount}, ghl=${ghlTotal}`)

    await supabase.from('sync_status').upsert(
      {
        location_id: locationId,
        entity_type: 'opportunities',
        status: 'pending',
        next_sync_at: new Date().toISOString(),
        error_message: `Discrepancy: local=${localCount}, ghl=${ghlTotal}`,
      },
      { onConflict: 'location_id,entity_type' }
    )

    return { synced: 0, discrepancies: discrepancy }
  }

  return { synced: localCount || 0, discrepancies: 0 }
}

/**
 * Clean up orphaned records
 */
async function cleanupOrphanedRecords(supabase: any, locationId: string): Promise<void> {
  // Find contacts with no activity in 90 days that are deleted
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // Hard delete soft-deleted records older than 90 days
  await supabase
    .from('ghl_contacts')
    .delete()
    .eq('location_id', locationId)
    .eq('is_deleted', true)
    .lt('date_updated', ninetyDaysAgo.toISOString())

  // Clean old sync logs (keep 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  await supabase
    .from('ghl_sync_log')
    .delete()
    .eq('location_id', locationId)
    .lt('created_at', thirtyDaysAgo.toISOString())
}
