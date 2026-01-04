import { NextRequest } from 'next/server'
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

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/pipelines/[id] - Get a single pipeline
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching pipeline:', error)
    return internalErrorResponse()
  }
}

// PUT /api/pipelines/[id] - Update a pipeline
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
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

// DELETE /api/pipelines/[id] - Delete a pipeline
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

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
