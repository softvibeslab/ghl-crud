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
  opportunityCreateSchema,
  validateBody,
} from '@/lib/api'

// GET /api/opportunities - List opportunities with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const pagination = getPaginationParams(searchParams)
    const filters = getFilterParams(searchParams, [
      'location_id',
      'contact_id',
      'pipeline_id',
      'pipeline_stage_id',
      'status',
      'assigned_to',
    ])

    // Special case: filter by status with location
    const status = searchParams.get('status') as 'open' | 'won' | 'lost' | 'abandoned' | null
    const locationId = searchParams.get('location_id') || undefined
    if (status && ['open', 'won', 'lost', 'abandoned'].includes(status)) {
      const result = await services.opportunities.findByStatus(status, locationId)
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

    // Special case: filter by pipeline
    const pipelineId = searchParams.get('pipeline_id')
    const stageId = searchParams.get('pipeline_stage_id') || undefined
    if (pipelineId) {
      const result = await services.opportunities.findByPipeline(pipelineId, stageId)
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

    // Special case: filter by contact
    const contactId = searchParams.get('contact_id')
    if (contactId) {
      const result = await services.opportunities.findByContact(contactId)
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

    const result = await services.opportunities.findAll(pagination, filters)

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
    console.error('Error fetching opportunities:', error)
    return internalErrorResponse()
  }
}

// POST /api/opportunities - Create a new opportunity
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(opportunityCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.opportunities.create(validation.data)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, undefined, 201)
  } catch (error) {
    console.error('Error creating opportunity:', error)
    return internalErrorResponse()
  }
}
