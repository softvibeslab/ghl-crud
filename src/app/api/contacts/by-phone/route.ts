import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api'

// GET /api/contacts/by-phone?phone=... - Find contact by phone
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return validationErrorResponse('Phone parameter is required')
    }

    const result = await services.contacts.findByPhone(phone)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Contact not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Contact not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error finding contact by phone:', error)
    return internalErrorResponse()
  }
}
