import { NextRequest } from 'next/server'
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

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/opportunities/[id] - Get a single opportunity
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching opportunity:', error)
    return internalErrorResponse()
  }
}

// PUT /api/opportunities/[id] - Update an opportunity
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
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

// DELETE /api/opportunities/[id] - Delete an opportunity
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

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
