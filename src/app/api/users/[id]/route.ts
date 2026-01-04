import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  userUpdateSchema,
  validateBody,
} from '@/lib/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/users/[id] - Get a single user
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.users.findById(id)

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
    console.error('Error fetching user:', error)
    return internalErrorResponse()
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(userUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.users.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('User not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating user:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.users.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return internalErrorResponse()
  }
}
