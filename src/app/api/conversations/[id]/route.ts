import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  conversationUpdateSchema,
  validateBody,
} from '@/lib/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/conversations/[id] - Get a single conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.conversations.findById(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Conversation not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Conversation not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return internalErrorResponse()
  }
}

// PUT /api/conversations/[id] - Update a conversation
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(conversationUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.conversations.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Conversation not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating conversation:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/conversations/[id] - Delete a conversation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.conversations.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return internalErrorResponse()
  }
}
