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
  messageCreateSchema,
  validateBody,
} from '@/lib/api'

// GET /api/messages - List messages with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const pagination = getPaginationParams(searchParams)
    const filters = getFilterParams(searchParams, [
      'conversation_id',
      'location_id',
      'contact_id',
      'direction',
      'message_type',
    ])

    // Special case: recent messages for location
    const recent = searchParams.get('recent') === 'true'
    const locationId = searchParams.get('location_id')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    if (recent && locationId) {
      const result = await services.messages.getRecentMessages(locationId, limit)
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

    // Special case: filter by conversation (sorted by created_at asc)
    const conversationId = searchParams.get('conversation_id')
    if (conversationId) {
      const result = await services.messages.findByConversation(conversationId, pagination)
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
      const result = await services.messages.findByContact(contactId, pagination)
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

    const result = await services.messages.findAll(pagination, filters)

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
    console.error('Error fetching messages:', error)
    return internalErrorResponse()
  }
}

// POST /api/messages - Create a new message
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(messageCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.messages.create(validation.data)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, undefined, 201)
  } catch (error) {
    console.error('Error creating message:', error)
    return internalErrorResponse()
  }
}
