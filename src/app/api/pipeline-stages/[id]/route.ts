import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  pipelineStageUpdateSchema,
  validateBody,
} from '@/lib/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/pipeline-stages/[id] - Get a single pipeline stage
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // Check for pipeline_id query param for composite lookup
    const { searchParams } = new URL(request.url)
    const pipelineId = searchParams.get('pipeline_id')

    let result
    if (pipelineId) {
      result = await services.pipelineStages.findByCompositeId(pipelineId, id)
    } else {
      result = await services.pipelineStages.findById(id)
    }

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Pipeline stage not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Pipeline stage not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching pipeline stage:', error)
    return internalErrorResponse()
  }
}

// PUT /api/pipeline-stages/[id] - Update a pipeline stage
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(pipelineStageUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.pipelineStages.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Pipeline stage not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating pipeline stage:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/pipeline-stages/[id] - Delete a pipeline stage
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.pipelineStages.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting pipeline stage:', error)
    return internalErrorResponse()
  }
}
