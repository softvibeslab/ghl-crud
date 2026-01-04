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
  workflowCreateSchema,
  validateBody,
} from '@/lib/api'

// GET /api/workflows - List workflows with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const pagination = getPaginationParams(searchParams)
    const filters = getFilterParams(searchParams, [
      'location_id',
      'status',
    ])

    const locationId = searchParams.get('location_id') || undefined

    // Special case: published workflows only
    const published = searchParams.get('published') === 'true'
    if (published) {
      const result = await services.workflows.findPublished(locationId)
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
      const result = await services.workflows.findByLocation(locationId)
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

    const result = await services.workflows.findAll(pagination, filters)

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
    console.error('Error fetching workflows:', error)
    return internalErrorResponse()
  }
}

// POST /api/workflows - Create a new workflow
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(workflowCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.workflows.create(validation.data)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, undefined, 201)
  } catch (error) {
    console.error('Error creating workflow:', error)
    return internalErrorResponse()
  }
}
