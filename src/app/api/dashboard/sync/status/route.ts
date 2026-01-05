/**
 * Sync Status Dashboard API
 * GET /api/dashboard/sync/status - Get sync status for all entities
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, canAccessLocation } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('locationId')

  try {
    const supabase = await createClient()

    // Build query based on user's access
    let query = supabase
      .from('sync_status')
      .select('*')
      .eq('tenant_id', context.tenant.id)

    // Filter by location if specified
    if (locationId) {
      if (!canAccessLocation(context, locationId)) {
        return NextResponse.json(
          { error: 'Access denied to this location' },
          { status: 403 }
        )
      }
      query = query.eq('location_id', locationId)
    } else if (context.user.role !== 'admin') {
      // Non-admins only see their assigned locations
      if (context.assignedLocations.length > 0) {
        query = query.in('location_id', context.assignedLocations)
      } else {
        return NextResponse.json({ syncStatus: [], summary: {} })
      }
    }

    const { data: syncStatus, error } = await query.order('updated_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch sync status: ${error.message}`)
    }

    // Calculate summary
    const summary = {
      total: syncStatus?.length || 0,
      syncing: syncStatus?.filter(s => s.status === 'syncing').length || 0,
      healthy: syncStatus?.filter(s => s.status === 'healthy').length || 0,
      pending: syncStatus?.filter(s => s.status === 'pending').length || 0,
      degraded: syncStatus?.filter(s => s.status === 'degraded').length || 0,
      error: syncStatus?.filter(s => s.status === 'error').length || 0,
      lastSync: syncStatus?.[0]?.last_sync_at || null,
      totalRecordsSynced: syncStatus?.reduce((sum, s) => sum + (s.records_synced || 0), 0) || 0,
    }

    // Group by location for easier display
    const byLocation: Record<string, unknown[]> = {}
    for (const status of syncStatus || []) {
      const locId = status.location_id
      if (!byLocation[locId]) {
        byLocation[locId] = []
      }
      byLocation[locId].push(status)
    }

    return NextResponse.json({
      syncStatus,
      byLocation,
      summary,
    })
  } catch (error) {
    console.error('Error fetching sync status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}
