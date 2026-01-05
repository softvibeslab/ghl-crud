/**
 * Cron Sync Endpoint
 * GET /api/cron/sync
 *
 * Triggered by Vercel cron or external scheduler
 * Processes pending sync tasks for all tenants
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createIncrementalSyncService } from '@/lib/ghl/incremental-sync.service'

// Vercel cron configuration - runs every 5 minutes
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds max

/**
 * Verify cron secret (for security)
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // Allow in development
    return process.env.NODE_ENV === 'development'
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const startTime = Date.now()
  const results: unknown[] = []
  let processed = 0
  let failed = 0

  try {
    // Create service client (bypass RLS)
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

    const syncService = createIncrementalSyncService(supabase)

    // Get pending sync tasks (limit to 5 per cron run to avoid timeout)
    const pendingTasks = await syncService.getPendingSyncTasks(5)

    if (pendingTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending sync tasks',
        processed: 0,
        duration: Date.now() - startTime,
      })
    }

    // Process each task
    for (const task of pendingTasks) {
      try {
        const result = await syncService.syncEntity(
          task.tenantId,
          task.locationId,
          task.entityType,
          task.lastSyncAt
        )

        results.push(result)

        if (result.success) {
          processed++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`Sync error for ${task.entityType}:${task.locationId}:`, error)
        failed++
        results.push({
          success: false,
          entityType: task.entityType,
          locationId: task.locationId,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // Check if we're running out of time (leave 10s buffer)
      if (Date.now() - startTime > 50000) {
        console.log('Approaching timeout, stopping early')
        break
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: pendingTasks.length,
      results,
      duration: Date.now() - startTime,
    })
  } catch (error) {
    console.error('Cron sync error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        processed,
        failed,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

/**
 * Manual trigger with POST
 * Allows specifying specific entities/locations
 */
export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { tenantId, locationId, entityType, force } = body

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      )
    }

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

    const syncService = createIncrementalSyncService(supabase)

    if (locationId && entityType) {
      // Sync specific entity for specific location
      // When force is true, pass null to trigger full sync; otherwise use incremental
      const sinceTime = force ? null : new Date(Date.now() - 15 * 60 * 1000) // 15 min ago for incremental
      const result = await syncService.syncEntity(
        tenantId,
        locationId,
        entityType,
        sinceTime
      )

      return NextResponse.json({
        success: result.success,
        result,
      })
    }

    // Trigger sync for all pending tasks for this tenant
    const { data: locations } = await supabase
      .from('ghl_locations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    const results: unknown[] = []

    for (const location of locations || []) {
      const pendingTasks = await syncService.getPendingSyncTasks(10)
      const locationTasks = pendingTasks.filter(t => t.locationId === location.id)

      for (const task of locationTasks) {
        const result = await syncService.syncEntity(
          task.tenantId,
          task.locationId,
          task.entityType,
          task.lastSyncAt
        )
        results.push(result)
      }
    }

    return NextResponse.json({
      success: true,
      syncedLocations: locations?.length || 0,
      results,
    })
  } catch (error) {
    console.error('Manual sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
