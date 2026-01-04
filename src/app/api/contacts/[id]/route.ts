import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  contactUpdateSchema,
  validateBody,
} from '@/lib/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/contacts/[id] - Get a single contact
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.contacts.findById(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Contact not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data || result.data.is_deleted) {
      return notFoundResponse('Contact not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching contact:', error)
    return internalErrorResponse()
  }
}

// PUT /api/contacts/[id] - Update a contact
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(contactUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.contacts.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Contact not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating contact:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/contacts/[id] - Soft delete a contact
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // Use soft delete for contacts
    const result = await services.contacts.softDelete(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Contact not found')
      }
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting contact:', error)
    return internalErrorResponse()
  }
}
