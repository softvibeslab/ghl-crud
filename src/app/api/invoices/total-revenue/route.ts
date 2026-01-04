import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api'

// GET /api/invoices/total-revenue?location_id=... - Get total revenue from paid invoices
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location_id')

    if (!locationId) {
      return validationErrorResponse('location_id is required')
    }

    const result = await services.invoices.getTotalRevenue(locationId)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({
      location_id: locationId,
      total_revenue: result.data,
    })
  } catch (error) {
    console.error('Error calculating total revenue:', error)
    return internalErrorResponse()
  }
}
