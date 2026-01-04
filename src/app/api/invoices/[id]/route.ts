import { NextRequest } from 'next/server'
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

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/invoices/[id] - Get a single invoice
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return internalErrorResponse()
  }
}

// PUT /api/invoices/[id] - Update an invoice
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
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

// DELETE /api/invoices/[id] - Delete an invoice
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

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
