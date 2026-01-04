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
  pipelineStageCreateSchema,
  validateBody,
} from '@/lib/api'

// GET /api/pipeline-stages - List pipeline stages with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const pagination = getPaginationParams(searchParams)
    const filters = getFilterParams(searchParams, ['pipeline_id', 'location_id'])

    // If pipeline_id is provided, use the specialized method (sorted by position)
    const pipelineId = searchParams.get('pipeline_id')
    if (pipelineId) {
      const result = await services.pipelineStages.findByPipeline(pipelineId)
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

    const result = await services.pipelineStages.findAll(pagination, filters)

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
    console.error('Error fetching pipeline stages:', error)
    return internalErrorResponse()
  }
}

// POST /api/pipeline-stages - Create a new pipeline stage
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(pipelineStageCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.pipelineStages.create(validation.data)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, undefined, 201)
  } catch (error) {
    console.error('Error creating pipeline stage:', error)
    return internalErrorResponse()
  }
}
