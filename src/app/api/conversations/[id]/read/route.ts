import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/conversations/[id]/read - Mark a conversation as read
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.conversations.markAsRead(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Conversation not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error marking conversation as read:', error)
    return internalErrorResponse()
  }
}
