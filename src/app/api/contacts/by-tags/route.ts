import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api'

// GET /api/contacts/by-tags?tags=tag1,tag2&location_id=... - Find contacts by tags
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const tagsParam = searchParams.get('tags')
    const locationId = searchParams.get('location_id') || undefined

    if (!tagsParam) {
      return validationErrorResponse('Tags parameter is required')
    }

    const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean)

    if (tags.length === 0) {
      return validationErrorResponse('At least one tag is required')
    }

    const result = await services.contacts.findByTags(tags, locationId)

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
    console.error('Error finding contacts by tags:', error)
    return internalErrorResponse()
  }
}
