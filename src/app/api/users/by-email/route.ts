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

// GET /api/users/by-email?email=... - Find user by email
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return validationErrorResponse('Email parameter is required')
    }

    const result = await services.users.findByEmail(email)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('User not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('User not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error finding user by email:', error)
    return internalErrorResponse()
  }
}
