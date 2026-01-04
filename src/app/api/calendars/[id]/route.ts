import { NextRequest } from 'next/server'
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

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/calendars/[id] - Get a single calendar
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching calendar:', error)
    return internalErrorResponse()
  }
}

// PUT /api/calendars/[id] - Update a calendar
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
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

// DELETE /api/calendars/[id] - Delete a calendar
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

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
