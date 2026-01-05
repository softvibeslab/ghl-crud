import { NextRequest, NextResponse } from 'next/server'
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
import {
  requireAuth,
  requirePermission,
  canAccessLocation,
  checkPermission,
} from '@/lib/rbac'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/contacts/[id] - Get a single contact (RBAC protected)
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Check authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

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

    const contact = result.data as typeof result.data & { tenant_id?: string }

    // Check tenant access (tenant_id will exist after migrations are applied)
    if (contact.tenant_id && contact.tenant_id !== context.tenant.id) {
      return notFoundResponse('Contact not found')
    }

    // Check location access
    if (contact.location_id && !canAccessLocation(context, contact.location_id)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // For agents, check if they are assigned to this contact
    if (context.user.role === 'agent') {
      const isAssigned = contact.assigned_to === context.user.ghl_user_id
      const isUnassigned = !contact.assigned_to

      if (!isAssigned && !isUnassigned) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // For managers, check if assignee is in their team
    if (context.user.role === 'manager' && contact.assigned_to) {
      const isOwn = contact.assigned_to === context.user.ghl_user_id
      const isTeam = context.teamMembers.includes(contact.assigned_to)

      if (!isOwn && !isTeam) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    return successResponse(contact)
  } catch (error) {
    console.error('Error fetching contact:', error)
    return internalErrorResponse()
  }
}

// PUT /api/contacts/[id] - Update a contact (RBAC protected)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Check permission to update contacts
  const authResult = await requirePermission(request, 'contacts', 'update')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First get the contact to check access
    const existingResult = await services.contacts.findById(id)

    if (existingResult.error || !existingResult.data || existingResult.data.is_deleted) {
      return notFoundResponse('Contact not found')
    }

    const contact = existingResult.data as typeof existingResult.data & { tenant_id?: string }

    // Check tenant access (tenant_id will exist after migrations are applied)
    if (contact.tenant_id && contact.tenant_id !== context.tenant.id) {
      return notFoundResponse('Contact not found')
    }

    // Check location access
    if (contact.location_id && !canAccessLocation(context, contact.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this contact' },
        { status: 403 }
      )
    }

    // For agents, check if they can edit this contact
    if (context.user.role === 'agent') {
      const isAssigned = contact.assigned_to === context.user.ghl_user_id
      const isUnassigned = !contact.assigned_to

      if (!isAssigned && !isUnassigned) {
        return NextResponse.json(
          { error: 'Access denied - not assigned to this contact' },
          { status: 403 }
        )
      }
    }

    // For managers, check if assignee is in their team
    if (context.user.role === 'manager' && contact.assigned_to) {
      const isOwn = contact.assigned_to === context.user.ghl_user_id
      const isTeam = context.teamMembers.includes(contact.assigned_to)

      if (!isOwn && !isTeam) {
        return NextResponse.json(
          { error: 'Access denied - contact not in your team' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()

    // Prevent changing location to one user doesn't have access to
    if (body.location_id && !canAccessLocation(context, body.location_id)) {
      return NextResponse.json(
        { error: 'Cannot move contact to inaccessible location' },
        { status: 403 }
      )
    }

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

// DELETE /api/contacts/[id] - Soft delete a contact (RBAC protected)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Check permission to delete contacts
  const authResult = await requirePermission(request, 'contacts', 'delete')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First get the contact to check access
    const existingResult = await services.contacts.findById(id)

    if (existingResult.error || !existingResult.data || existingResult.data.is_deleted) {
      return notFoundResponse('Contact not found')
    }

    const contact = existingResult.data as typeof existingResult.data & { tenant_id?: string }

    // Check tenant access (tenant_id will exist after migrations are applied)
    if (contact.tenant_id && contact.tenant_id !== context.tenant.id) {
      return notFoundResponse('Contact not found')
    }

    // Check location access
    if (contact.location_id && !canAccessLocation(context, contact.location_id)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Only admins can delete contacts (based on role permissions)
    // This is already checked by requirePermission, but double-check
    if (context.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete contacts' },
        { status: 403 }
      )
    }

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
