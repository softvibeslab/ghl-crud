import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  invoiceUpdateSchema,
  validateBody,
} from '@/lib/api'
import {
  requireAuth,
  requirePermission,
  canAccessLocation,
  canAccessRecord,
} from '@/lib/rbac'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/invoices/[id] - Get a single invoice (RBAC protected)
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

    const result = await services.invoices.findById(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Invoice not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Invoice not found')
    }

    // Check location access
    const invoice = result.data as typeof result.data & { location_id?: string; tenant_id?: string }
    if (invoice.location_id && !canAccessLocation(context, invoice.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      )
    }

    // Check tenant access
    if (invoice.tenant_id && invoice.tenant_id !== context.tenant.id) {
      return notFoundResponse('Invoice not found')
    }

    // For agents, check record-level access
    if (context.user.role === 'agent' && !canAccessRecord(invoice, context)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      )
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return internalErrorResponse()
  }
}

// PUT /api/invoices/[id] - Update an invoice (RBAC protected)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Check permission to update invoices
  const authResult = await requirePermission(request, 'invoices', 'update')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the invoice to check access
    const existingResult = await services.invoices.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Invoice not found')
    }

    const existingInvoice = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingInvoice.tenant_id && existingInvoice.tenant_id !== context.tenant.id) {
      return notFoundResponse('Invoice not found')
    }

    // Check location access
    if (existingInvoice.location_id && !canAccessLocation(context, existingInvoice.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      )
    }

    // For agents, check record-level access
    if (context.user.role === 'agent' && !canAccessRecord(existingInvoice, context)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // If changing location, verify access to new location
    if (body.location_id && body.location_id !== existingInvoice.location_id) {
      if (!canAccessLocation(context, body.location_id)) {
        return NextResponse.json(
          { error: 'Access denied to target location' },
          { status: 403 }
        )
      }
    }

    const validation = validateBody(invoiceUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.invoices.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Invoice not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating invoice:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/invoices/[id] - Delete an invoice (RBAC protected - admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Check permission to delete invoices
  const authResult = await requirePermission(request, 'invoices', 'delete')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    // First fetch the invoice to check access
    const existingResult = await services.invoices.findById(id)
    if (existingResult.error || !existingResult.data) {
      return notFoundResponse('Invoice not found')
    }

    const existingInvoice = existingResult.data as typeof existingResult.data & { location_id?: string; tenant_id?: string }

    // Check tenant access
    if (existingInvoice.tenant_id && existingInvoice.tenant_id !== context.tenant.id) {
      return notFoundResponse('Invoice not found')
    }

    // Check location access
    if (existingInvoice.location_id && !canAccessLocation(context, existingInvoice.location_id)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      )
    }

    const result = await services.invoices.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return internalErrorResponse()
  }
}
