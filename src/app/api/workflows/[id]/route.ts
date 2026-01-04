import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  workflowUpdateSchema,
  validateBody,
} from '@/lib/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/workflows/[id] - Get a single workflow
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.workflows.findById(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Workflow not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Workflow not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching workflow:', error)
    return internalErrorResponse()
  }
}

// PUT /api/workflows/[id] - Update a workflow
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(workflowUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.workflows.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Workflow not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating workflow:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/workflows/[id] - Delete a workflow
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.workflows.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting workflow:', error)
    return internalErrorResponse()
  }
}
