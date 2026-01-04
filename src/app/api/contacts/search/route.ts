import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api'

// GET /api/contacts/search - Search contacts
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const locationId = searchParams.get('location_id') || undefined

    if (!query || query.trim().length < 2) {
      return validationErrorResponse('Search query must be at least 2 characters')
    }

    const result = await services.contacts.searchContacts(query.trim(), locationId)

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
    console.error('Error searching contacts:', error)
    return internalErrorResponse()
  }
}
