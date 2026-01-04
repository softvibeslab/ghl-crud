import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServices } from '@/lib/services'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api'

// GET /api/opportunities/total-value?location_id=...&status=... - Get total value of opportunities
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const services = createServices(supabase)

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location_id')
    const status = searchParams.get('status') || undefined

    if (!locationId) {
      return validationErrorResponse('location_id is required')
    }

    const result = await services.opportunities.getTotalValue(locationId, status)

    if (result.error) {
      return errorResponse(result.error)
    }

    return successResponse({
      location_id: locationId,
      status: status || 'all',
      total_value: result.data,
    })
  } catch (error) {
    console.error('Error calculating total value:', error)
    return internalErrorResponse()
  }
}
