/**
 * Location Initial Sync API
 * POST /api/dashboard/locations/[id]/sync - Start initial sync for a location
 * GET /api/dashboard/locations/[id]/sync - Get sync progress
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, canAccessLocation, getTenantId } from '@/lib/rbac'
import { createInitialSyncService } from '@/lib/ghl/initial-sync.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET - Get current sync progress for a location
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireRole(request, ['admin', 'manager'])
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult
  const { id: locationId } = await params

  // Check access
  if (!canAccessLocation(context, locationId)) {
    return NextResponse.json(
      { error: 'Access denied to this location' },
      { status: 403 }
    )
  }

  try {
    const supabase = await createClient()
    const syncService = createInitialSyncService(supabase)

    // Check for in-progress sync
    const progress = syncService.getProgress(context.tenant.id, locationId)

    if (progress) {
      return NextResponse.json({ inProgress: true, progress })
    }

    // Get last sync status from database
    const { data: syncLogs } = await supabase
      .from('ghl_sync_log')
      .select('*')
      .eq('location_id', locationId)
      .eq('entity_type', 'initial_sync')
      .order('created_at', { ascending: false })
      .limit(1)

    const lastSync = syncLogs?.[0]

    return NextResponse.json({
      inProgress: false,
      lastSync: lastSync?.payload || null,
      lastSyncAt: lastSync?.created_at || null,
    })
  } catch (error) {
    console.error('Error getting sync progress:', error)
    return NextResponse.json(
      { error: 'Failed to get sync progress' },
      { status: 500 }
    )
  }
}

/**
 * POST - Start initial sync for a location
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireRole(request, 'admin')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult
  const { id: locationId } = await params

  // Check access
  if (!canAccessLocation(context, locationId)) {
    return NextResponse.json(
      { error: 'Access denied to this location' },
      { status: 403 }
    )
  }

  try {
    const supabase = await createClient()
    const syncService = createInitialSyncService(supabase)
    const tenantId = getTenantId(context)

    // Check if sync is already in progress
    const existingProgress = syncService.getProgress(tenantId, locationId)
    if (existingProgress) {
      return NextResponse.json(
        {
          error: 'Sync already in progress',
          progress: existingProgress,
        },
        { status: 409 }
      )
    }

    // Start async sync (non-blocking)
    const body = await request.json().catch(() => ({}))
    const { waitForCompletion } = body

    if (waitForCompletion) {
      // Synchronous - wait for completion
      const result = await syncService.startInitialSync(tenantId, locationId)
      return NextResponse.json({
        success: result.status === 'completed',
        result,
      })
    }

    // Async - start and return immediately
    syncService.startInitialSync(tenantId, locationId).catch(console.error)

    return NextResponse.json({
      success: true,
      message: 'Initial sync started',
      checkProgressAt: `/api/dashboard/locations/${locationId}/sync`,
    })
  } catch (error) {
    console.error('Error starting initial sync:', error)
    return NextResponse.json(
      { error: 'Failed to start initial sync' },
      { status: 500 }
    )
  }
}
