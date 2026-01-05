import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  calendarUpdateSchema,
  validateBody,
} from '@/lib/api'
import {
  requireAuth,
  requirePermission,
  canAccessLocation,
} from '@/lib/rbac'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/calendars/[id] - Get a single calendar (RBAC protected)
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Check authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.calendars.findById(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Calendar not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Calendar not found')
    }

    // Check location access
    const calendar = result.data as typeof result.data & { location_id?: string; tenant_id?: string }
    if (calendar.location_id && !canAccessLocation(context, calendar.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this calendar' },
        { status: 403 }
      )
    }

    // Check tenant access
    if (calendar.tenant_id && calendar.tenant_id !== context.tenant.id) {
      return notFoundResponse('Calendar not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching calendar:', error)
    return internalErrorResponse()
  }
}

// PUT /api/calendars/[id] - Update a calendar (RBAC protected)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Check permission to update calendars
  const authResult = await requirePermission(request, 'calendars', 'update')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the calendar to check access
    const existingResult = await services.calendars.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Calendar not found')
    }

    const existingCalendar = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingCalendar.tenant_id && existingCalendar.tenant_id !== context.tenant.id) {
      return notFoundResponse('Calendar not found')
    }

    // Check location access
    if (existingCalendar.location_id && !canAccessLocation(context, existingCalendar.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this calendar' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // If changing location, verify access to new location
    if (body.location_id && body.location_id !== existingCalendar.location_id) {
      if (!canAccessLocation(context, body.location_id)) {
        return NextResponse.json(
          { error: 'Access denied to target location' },
          { status: 403 }
        )
      }
    }

    const validation = validateBody(calendarUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.calendars.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Calendar not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating calendar:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/calendars/[id] - Delete a calendar (RBAC protected - admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Check permission to delete calendars
  const authResult = await requirePermission(request, 'calendars', 'delete')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the calendar to check access
    const existingResult = await services.calendars.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Calendar not found')
    }

    const existingCalendar = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingCalendar.tenant_id && existingCalendar.tenant_id !== context.tenant.id) {
      return notFoundResponse('Calendar not found')
    }

    // Check location access
    if (existingCalendar.location_id && !canAccessLocation(context, existingCalendar.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this calendar' },
        { status: 403 }
      )
    }

    const result = await services.calendars.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting calendar:', error)
    return internalErrorResponse()
  }
}
