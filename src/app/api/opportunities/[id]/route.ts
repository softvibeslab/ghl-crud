import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  opportunityUpdateSchema,
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

// GET /api/opportunities/[id] - Get a single opportunity (RBAC protected)
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

    const result = await services.opportunities.findById(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Opportunity not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Opportunity not found')
    }

    // Check location access
    const opportunity = result.data as typeof result.data & { location_id?: string; tenant_id?: string }
    if (opportunity.location_id && !canAccessLocation(context, opportunity.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this opportunity' },
        { status: 403 }
      )
    }

    // Check tenant access
    if (opportunity.tenant_id && opportunity.tenant_id !== context.tenant.id) {
      return notFoundResponse('Opportunity not found')
    }

    // For agents, check record-level access
    if (context.user.role === 'agent' && !canAccessRecord(opportunity, context)) {
      return NextResponse.json(
        { error: 'Access denied to this opportunity' },
        { status: 403 }
      )
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching opportunity:', error)
    return internalErrorResponse()
  }
}

// PUT /api/opportunities/[id] - Update an opportunity (RBAC protected)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Check permission to update opportunities
  const authResult = await requirePermission(request, 'opportunities', 'update')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the opportunity to check access
    const existingResult = await services.opportunities.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Opportunity not found')
    }

    const existingOpportunity = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingOpportunity.tenant_id && existingOpportunity.tenant_id !== context.tenant.id) {
      return notFoundResponse('Opportunity not found')
    }

    // Check location access
    if (existingOpportunity.location_id && !canAccessLocation(context, existingOpportunity.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this opportunity' },
        { status: 403 }
      )
    }

    // For agents, check record-level access
    if (context.user.role === 'agent' && !canAccessRecord(existingOpportunity, context)) {
      return NextResponse.json(
        { error: 'Access denied to this opportunity' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // If changing location, verify access to new location
    if (body.location_id && body.location_id !== existingOpportunity.location_id) {
      if (!canAccessLocation(context, body.location_id)) {
        return NextResponse.json(
          { error: 'Access denied to target location' },
          { status: 403 }
        )
      }
    }

    const validation = validateBody(opportunityUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.opportunities.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Opportunity not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating opportunity:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/opportunities/[id] - Delete an opportunity (RBAC protected - admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Check permission to delete opportunities (admin only based on ROLE_PERMISSIONS)
  const authResult = await requirePermission(request, 'opportunities', 'delete')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the opportunity to check access
    const existingResult = await services.opportunities.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Opportunity not found')
    }

    const existingOpportunity = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingOpportunity.tenant_id && existingOpportunity.tenant_id !== context.tenant.id) {
      return notFoundResponse('Opportunity not found')
    }

    // Check location access
    if (existingOpportunity.location_id && !canAccessLocation(context, existingOpportunity.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this opportunity' },
        { status: 403 }
      )
    }

    const result = await services.opportunities.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting opportunity:', error)
    return internalErrorResponse()
  }
}
