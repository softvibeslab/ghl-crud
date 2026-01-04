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

// GET /api/contacts/by-email?email=... - Find contact by email
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return validationErrorResponse('Email parameter is required')
    }

    const result = await services.contacts.findByEmail(email)

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
    console.error('Error finding contact by email:', error)
    return internalErrorResponse()
  }
}
