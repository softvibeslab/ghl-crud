import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  pipelineUpdateSchema,
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

// GET /api/pipelines/[id] - Get a single pipeline (RBAC protected)
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

    const result = await services.pipelines.findById(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Pipeline not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Pipeline not found')
    }

    // Check location access
    const pipeline = result.data as typeof result.data & { location_id?: string; tenant_id?: string }
    if (pipeline.location_id && !canAccessLocation(context, pipeline.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this pipeline' },
        { status: 403 }
      )
    }

    // Check tenant access
    if (pipeline.tenant_id && pipeline.tenant_id !== context.tenant.id) {
      return notFoundResponse('Pipeline not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching pipeline:', error)
    return internalErrorResponse()
  }
}

// PUT /api/pipelines/[id] - Update a pipeline (RBAC protected)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Check permission to update pipelines
  const authResult = await requirePermission(request, 'pipelines', 'update')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the pipeline to check access
    const existingResult = await services.pipelines.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Pipeline not found')
    }

    const existingPipeline = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingPipeline.tenant_id && existingPipeline.tenant_id !== context.tenant.id) {
      return notFoundResponse('Pipeline not found')
    }

    // Check location access
    if (existingPipeline.location_id && !canAccessLocation(context, existingPipeline.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this pipeline' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // If changing location, verify access to new location
    if (body.location_id && body.location_id !== existingPipeline.location_id) {
      if (!canAccessLocation(context, body.location_id)) {
        return NextResponse.json(
          { error: 'Access denied to target location' },
          { status: 403 }
        )
      }
    }

    const validation = validateBody(pipelineUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.pipelines.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Pipeline not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating pipeline:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/pipelines/[id] - Delete a pipeline (RBAC protected - admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Check permission to delete pipelines
  const authResult = await requirePermission(request, 'pipelines', 'delete')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the pipeline to check access
    const existingResult = await services.pipelines.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Pipeline not found')
    }

    const existingPipeline = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingPipeline.tenant_id && existingPipeline.tenant_id !== context.tenant.id) {
      return notFoundResponse('Pipeline not found')
    }

    // Check location access
    if (existingPipeline.location_id && !canAccessLocation(context, existingPipeline.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this pipeline' },
        { status: 403 }
      )
    }

    const result = await services.pipelines.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting pipeline:', error)
    return internalErrorResponse()
  }
}
