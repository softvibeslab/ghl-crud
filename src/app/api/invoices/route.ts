import { NextRequest, NextResponse } from 'next/server'
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
import {
  requireAuth,
  requirePermission,
  filterByAccess,
  canAccessLocation,
} from '@/lib/rbac'

// GET /api/invoices - List invoices with pagination and filters (RBAC protected)
export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

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

    // Apply location filter based on user's access
    let locationId = filters.location_id as string | undefined

    // If a specific location is requested, verify access
    if (locationId && !canAccessLocation(context, locationId)) {
      return NextResponse.json(
        { error: 'Access denied to this location' },
        { status: 403 }
      )
    }

    // For non-admins, filter by their accessible locations
    if (context.user.role !== 'admin') {
      if (!locationId && context.assignedLocations.length > 0) {
        locationId = context.assignedLocations[0]
        filters.location_id = locationId
      } else if (context.assignedLocations.length === 0) {
        return successResponse([], {
          page: 1,
          limit: pagination.limit || 50,
          total: 0,
          totalPages: 0,
        })
      }
    }

    // Add tenant_id filter
    const filtersWithTenant = {
      ...filters,
      tenant_id: context.tenant.id,
    }

    // Special case: overdue invoices
    const overdue = searchParams.get('overdue') === 'true'
    if (overdue && locationId) {
      const result = await services.invoices.findOverdue(locationId)
      if (result.error) {
        return errorResponse(result.error)
      }

      let filteredData = result.data || []
      if (context.user.role === 'agent') {
        filteredData = filterByAccess(filteredData, context)
      }

      return successResponse(filteredData, {
        page: result.page,
        limit: result.limit,
        total: context.user.role === 'agent' ? filteredData.length : result.count,
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

      let filteredData = result.data || []
      if (context.user.role === 'agent') {
        filteredData = filterByAccess(filteredData, context)
      }

      return successResponse(filteredData, {
        page: result.page,
        limit: result.limit,
        total: context.user.role === 'agent' ? filteredData.length : result.count,
        totalPages: result.totalPages,
      })
    }

    // Special case: filter by location
    if (locationId) {
      const result = await services.invoices.findByLocation(locationId, pagination)
      if (result.error) {
        return errorResponse(result.error)
      }

      let filteredData = result.data || []
      if (context.user.role === 'agent') {
        filteredData = filterByAccess(filteredData, context)
      }

      return successResponse(filteredData, {
        page: result.page,
        limit: result.limit,
        total: context.user.role === 'agent' ? filteredData.length : result.count,
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

      let filteredData = result.data || []
      if (context.user.role === 'agent') {
        filteredData = filterByAccess(filteredData, context)
      }

      return successResponse(filteredData, {
        page: result.page,
        limit: result.limit,
        total: context.user.role === 'agent' ? filteredData.length : result.count,
        totalPages: result.totalPages,
      })
    }

    const result = await services.invoices.findAll(pagination, filtersWithTenant)

    if (result.error) {
      return errorResponse(result.error)
    }

    let filteredData = result.data || []
    if (context.user.role === 'agent') {
      filteredData = filterByAccess(filteredData, context)
    }

    return successResponse(filteredData, {
      page: result.page,
      limit: result.limit,
      total: context.user.role === 'agent' ? filteredData.length : result.count,
      totalPages: result.totalPages,
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return internalErrorResponse()
  }
}

// POST /api/invoices - Create a new invoice (RBAC protected)
export async function POST(request: NextRequest) {
  // Check permission to create invoices
  const authResult = await requirePermission(request, 'invoices', 'create')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()

    // Verify user has access to the target location
    if (body.location_id && !canAccessLocation(context, body.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this location' },
        { status: 403 }
      )
    }

    // For non-admins without a specified location, use their first assigned location
    if (!body.location_id && context.user.role !== 'admin') {
      if (context.assignedLocations.length > 0) {
        body.location_id = context.assignedLocations[0]
      } else {
        return NextResponse.json(
          { error: 'No location assigned to user' },
          { status: 400 }
        )
      }
    }

    // Add tenant_id to the invoice
    body.tenant_id = context.tenant.id

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
