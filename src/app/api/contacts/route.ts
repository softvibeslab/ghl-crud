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
  contactCreateSchema,
  validateBody,
} from '@/lib/api'
import {
  requireAuth,
  requirePermission,
  filterByAccess,
  canAccessLocation,
  type UserContext,
} from '@/lib/rbac'
import { NextResponse } from 'next/server'

// GET /api/contacts - List contacts with pagination and filters (RBAC protected)
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
      'type',
      'assigned_to',
      'source',
    ])

    // Apply location filter based on user's access
    const locationId = filters.location_id as string | undefined

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
        // If no specific location, filter to user's first assigned location
        // (Supabase doesn't support IN operator directly in filters object)
        filters.location_id = context.assignedLocations[0]
      } else if (context.assignedLocations.length === 0) {
        // No locations assigned - return empty
        return successResponse([], {
          page: 1,
          limit: pagination.limit || 50,
          total: 0,
          totalPages: 0,
        })
      }
    }

    // Add is_deleted: false to not return soft-deleted contacts
    // Add tenant_id filter
    const filtersWithDeleted = {
      ...filters,
      is_deleted: false,
      tenant_id: context.tenant.id,
    }

    const result = await services.contacts.findAll(pagination, filtersWithDeleted)

    if (result.error) {
      return errorResponse(result.error)
    }

    // Apply additional RBAC filtering for agents (only their assigned contacts)
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
    console.error('Error fetching contacts:', error)
    return internalErrorResponse()
  }
}

// POST /api/contacts - Create a new contact (RBAC protected)
export async function POST(request: NextRequest) {
  // Check permission to create contacts
  const authResult = await requirePermission(request, 'contacts', 'create')
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

    // Add tenant_id to the contact
    body.tenant_id = context.tenant.id

    const validation = validateBody(contactCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.contacts.create(validation.data)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, undefined, 201)
  } catch (error) {
    console.error('Error creating contact:', error)
    return internalErrorResponse()
  }
}
