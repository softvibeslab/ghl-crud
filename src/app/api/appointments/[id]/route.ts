import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  appointmentUpdateSchema,
  validateBody,
} from '@/lib/api'
import {
  requireAuth,
  requirePermission,
  canAccessLocation,
  canAccessRecord,
} from '@/lib/rbac'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/appointments/[id] - Get a single appointment (RBAC protected)
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

    const result = await services.appointments.findById(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Appointment not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Appointment not found')
    }

    // Check location access
    const appointment = result.data as typeof result.data & { location_id?: string; tenant_id?: string }
    if (appointment.location_id && !canAccessLocation(context, appointment.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this appointment' },
        { status: 403 }
      )
    }

    // Check tenant access
    if (appointment.tenant_id && appointment.tenant_id !== context.tenant.id) {
      return notFoundResponse('Appointment not found')
    }

    // For agents, check record-level access
    if (context.user.role === 'agent' && !canAccessRecord(appointment, context)) {
      return NextResponse.json(
        { error: 'Access denied to this appointment' },
        { status: 403 }
      )
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching appointment:', error)
    return internalErrorResponse()
  }
}

// PUT /api/appointments/[id] - Update an appointment (RBAC protected)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Check permission to update appointments
  const authResult = await requirePermission(request, 'appointments', 'update')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the appointment to check access
    const existingResult = await services.appointments.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Appointment not found')
    }

    const existingAppointment = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingAppointment.tenant_id && existingAppointment.tenant_id !== context.tenant.id) {
      return notFoundResponse('Appointment not found')
    }

    // Check location access
    if (existingAppointment.location_id && !canAccessLocation(context, existingAppointment.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this appointment' },
        { status: 403 }
      )
    }

    // For agents, check record-level access
    if (context.user.role === 'agent' && !canAccessRecord(existingAppointment, context)) {
      return NextResponse.json(
        { error: 'Access denied to this appointment' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // If changing location, verify access to new location
    if (body.location_id && body.location_id !== existingAppointment.location_id) {
      if (!canAccessLocation(context, body.location_id)) {
        return NextResponse.json(
          { error: 'Access denied to target location' },
          { status: 403 }
        )
      }
    }

    const validation = validateBody(appointmentUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.appointments.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Appointment not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating appointment:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/appointments/[id] - Delete an appointment (RBAC protected - admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Check permission to delete appointments
  const authResult = await requirePermission(request, 'appointments', 'delete')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the appointment to check access
    const existingResult = await services.appointments.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Appointment not found')
    }

    const existingAppointment = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingAppointment.tenant_id && existingAppointment.tenant_id !== context.tenant.id) {
      return notFoundResponse('Appointment not found')
    }

    // Check location access
    if (existingAppointment.location_id && !canAccessLocation(context, existingAppointment.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this appointment' },
        { status: 403 }
      )
    }

    const result = await services.appointments.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return internalErrorResponse()
  }
}
