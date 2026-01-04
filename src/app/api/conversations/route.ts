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
  conversationCreateSchema,
  validateBody,
} from '@/lib/api'

// GET /api/conversations - List conversations with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const pagination = getPaginationParams(searchParams)
    const filters = getFilterParams(searchParams, [
      'location_id',
      'contact_id',
      'type',
      'channel',
      'assigned_to',
      'inbox_status',
    ])

    // Special case: unread conversations
    const unread = searchParams.get('unread') === 'true'
    const locationId = searchParams.get('location_id')
    if (unread && locationId) {
      const result = await services.conversations.findUnread(locationId)
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

    // Special case: filter by location (with sorting by last_message_date)
    if (locationId && !filters.contact_id) {
      const result = await services.conversations.findByLocation(locationId, pagination)
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
      const result = await services.conversations.findByContact(contactId)
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

    const result = await services.conversations.findAll(pagination, filters)

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
    console.error('Error fetching conversations:', error)
    return internalErrorResponse()
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(conversationCreateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.conversations.create(validation.data)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse(result.data, undefined, 201)
  } catch (error) {
    console.error('Error creating conversation:', error)
    return internalErrorResponse()
  }
}
