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
  invoiceCreateSchema,
  validateBody,
} from '@/lib/api'

// GET /api/invoices - List invoices with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const pagination = getPaginationParams(searchParams)
    const filters = getFilterParams(searchParams, [
      'location_id',
      'contact_id',
      'status',
    ])

    const locationId = searchParams.get('location_id')

    // Special case: overdue invoices
    const overdue = searchParams.get('overdue') === 'true'
    if (overdue && locationId) {
      const result = await services.invoices.findOverdue(locationId)
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

    // Special case: filter by status
    const status = searchParams.get('status')
    if (status) {
      const result = await services.invoices.findByStatus(status, locationId || undefined)
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
      const result = await services.invoices.findByLocation(locationId, pagination)
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
      const result = await services.invoices.findByContact(contactId)
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

    const result = await services.invoices.findAll(pagination, filters)

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
    console.error('Error fetching invoices:', error)
    return internalErrorResponse()
  }
}

// POST /api/invoices - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(invoiceCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.invoices.create(validation.data)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, undefined, 201)
  } catch (error) {
    console.error('Error creating invoice:', error)
    return internalErrorResponse()
  }
}
