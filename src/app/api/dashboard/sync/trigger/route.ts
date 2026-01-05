/**
 * Manual Sync Trigger API
 * POST /api/dashboard/sync/trigger - Trigger manual sync for a location
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, canAccessLocation, getTenantId } from '@/lib/rbac'
import { createIncrementalSyncService } from '@/lib/ghl/incremental-sync.service'

export async function POST(request: NextRequest) {
  // Only admins and managers can trigger manual sync
  const authResult = await requireRole(request, ['admin', 'manager'])
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const body = await request.json()
    const { locationId, entityType, fullSync } = body

    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId is required' },
        { status: 400 }
      )
    }

    // Check access to location
    if (!canAccessLocation(context, locationId)) {
      return NextResponse.json(
        { error: 'Access denied to this location' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const syncService = createIncrementalSyncService(supabase)
    const tenantId = getTenantId(context)

    // Entity types to sync
    const entitiesToSync = entityType
      ? [entityType]
      : ['contacts', 'opportunities', 'appointments', 'invoices', 'calendars', 'pipelines', 'users']

    const results: unknown[] = []

    for (const entity of entitiesToSync) {
      try {
        // When fullSync is true, pass null for full sync; otherwise use last 15 minutes
        const sinceTime = fullSync ? null : new Date(Date.now() - 15 * 60 * 1000)
        const result = await syncService.syncEntity(
          tenantId,
          locationId,
          entity,
          sinceTime
        )
        results.push(result)
      } catch (error) {
        results.push({
          success: false,
          entityType: entity,
          locationId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const successCount = results.filter((r: any) => r.success).length
    const totalRecords = results.reduce((sum: number, r: any) => sum + (r.recordsSynced || 0), 0)

    return NextResponse.json({
      success: successCount === results.length,
      message: `Synced ${successCount}/${results.length} entities, ${totalRecords} total records`,
      results,
    })
  } catch (error) {
    console.error('Manual sync error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    )
  }
}
