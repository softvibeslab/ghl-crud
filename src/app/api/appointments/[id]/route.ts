import { NextRequest } from 'next/server'
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

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/appointments/[id] - Get a single appointment
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching appointment:', error)
    return internalErrorResponse()
  }
}

// PUT /api/appointments/[id] - Update an appointment
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
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

// DELETE /api/appointments/[id] - Delete an appointment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

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
