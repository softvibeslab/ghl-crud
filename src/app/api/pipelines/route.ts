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
  pipelineCreateSchema,
  validateBody,
} from '@/lib/api'
import {
  requireAuth,
  requirePermission,
  canAccessLocation,
} from '@/lib/rbac'

// GET /api/pipelines - List pipelines with pagination and filters (RBAC protected)
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
    const filters = getFilterParams(searchParams, ['location_id'])

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

    // If location_id is provided, use the specialized method
    if (locationId) {
      const result = await services.pipelines.findByLocation(locationId)
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

    const result = await services.pipelines.findAll(pagination, filtersWithTenant)

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
    console.error('Error fetching pipelines:', error)
    return internalErrorResponse()
  }
}

// POST /api/pipelines - Create a new pipeline (RBAC protected)
export async function POST(request: NextRequest) {
  // Check permission to create pipelines
  const authResult = await requirePermission(request, 'pipelines', 'create')
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

    // Add tenant_id to the pipeline
    body.tenant_id = context.tenant.id

    const validation = validateBody(pipelineCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.pipelines.create(validation.data)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, undefined, 201)
  } catch (error) {
    console.error('Error creating pipeline:', error)
    return internalErrorResponse()
  }
}
