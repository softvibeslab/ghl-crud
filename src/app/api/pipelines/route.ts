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
  pipelineCreateSchema,
  validateBody,
} from '@/lib/api'

// GET /api/pipelines - List pipelines with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const pagination = getPaginationParams(searchParams)
    const filters = getFilterParams(searchParams, ['location_id'])

    // If location_id is provided, use the specialized method
    const locationId = searchParams.get('location_id')
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

    const result = await services.pipelines.findAll(pagination, filters)

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

// POST /api/pipelines - Create a new pipeline
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
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
