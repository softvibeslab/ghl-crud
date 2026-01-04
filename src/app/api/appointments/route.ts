import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  internalErrorResponse,
  getPaginationParams,
  getFilterParams,
  appointmentCreateSchema,
  validateBody,
} from '@/lib/api'

// GET /api/appointments - List appointments with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const pagination = getPaginationParams(searchParams)
    const filters = getFilterParams(searchParams, [
      'location_id',
      'contact_id',
      'calendar_id',
      'status',
      'assigned_user_id',
    ])

    const locationId = searchParams.get('location_id')

    // Special case: upcoming appointments
    const upcoming = searchParams.get('upcoming') === 'true'
    const days = parseInt(searchParams.get('days') || '7', 10)
    if (upcoming && locationId) {
      const result = await services.appointments.findUpcoming(locationId, days)
      if (result.error) {
        return errorResponse(result.error)
      }
      return successResponse(result.data, {
        page: result.page,
        limit: result.limit,
        total: result.count,
        totalPages: result.totalPages,
      })
    }

    // Special case: date range filter
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    if (startDate && endDate && locationId) {
      const result = await services.appointments.findByDateRange(
        locationId,
        new Date(startDate),
        new Date(endDate)
      )
      if (result.error) {
        return errorResponse(result.error)
      }
      return successResponse(result.data, {
        page: result.page,
        limit: result.limit,
        total: result.count,
        totalPages: result.totalPages,
      })
    }

    // Special case: filter by location
    if (locationId) {
      const result = await services.appointments.findByLocation(locationId, pagination)
      if (result.error) {
        return errorResponse(result.error)
      }
      return successResponse(result.data, {
        page: result.page,
        limit: result.limit,
        total: result.count,
        totalPages: result.totalPages,
      })
    }

    // Special case: filter by contact
    const contactId = searchParams.get('contact_id')
    if (contactId) {
      const result = await services.appointments.findByContact(contactId)
      if (result.error) {
        return errorResponse(result.error)
      }
      return successResponse(result.data, {
        page: result.page,
        limit: result.limit,
        total: result.count,
        totalPages: result.totalPages,
      })
    }

    // Special case: filter by calendar
    const calendarId = searchParams.get('calendar_id')
    if (calendarId) {
      const result = await services.appointments.findByCalendar(calendarId)
      if (result.error) {
        return errorResponse(result.error)
      }
      return successResponse(result.data, {
        page: result.page,
        limit: result.limit,
        total: result.count,
        totalPages: result.totalPages,
      })
    }

    const result = await services.appointments.findAll(pagination, filters)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, {
      page: result.page,
      limit: result.limit,
      total: result.count,
      totalPages: result.totalPages,
    })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return internalErrorResponse()
  }
}

// POST /api/appointments - Create a new appointment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(appointmentCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.appointments.create(validation.data)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, undefined, 201)
  } catch (error) {
    console.error('Error creating appointment:', error)
    return internalErrorResponse()
  }
}
