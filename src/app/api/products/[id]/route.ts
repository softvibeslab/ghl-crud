import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  productUpdateSchema,
  validateBody,
} from '@/lib/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/products/[id] - Get a single product
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.products.findById(id)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Product not found')
      }
      return errorResponse(result.error)
    }

    if (!result.data) {
      return notFoundResponse('Product not found')
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error fetching product:', error)
    return internalErrorResponse()
  }
}

// PUT /api/products/[id] - Update a product
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const body = await request.json()
    const validation = validateBody(productUpdateSchema, body)

    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const result = await services.products.update(id, validation.data)

    if (result.error) {
      if (result.error.includes('No rows')) {
        return notFoundResponse('Product not found')
      }
      return errorResponse(result.error)
    }

    return successResponse(result.data)
  } catch (error) {
    console.error('Error updating product:', error)
    return internalErrorResponse()
  }
}

// DELETE /api/products/[id] - Delete a product
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const services = createServices(supabase)

    const result = await services.products.delete(id)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return internalErrorResponse()
  }
}
