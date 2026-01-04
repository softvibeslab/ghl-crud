import { PaginationParams } from '@/lib/services'

export function getPaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const sortBy = searchParams.get('sortBy') || 'id'
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  return {
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit)),
    sortBy,
    sortOrder,
  }
}

export function getFilterParams(
  searchParams: URLSearchParams,
  allowedFilters: string[]
): Record<string, string> {
  const filters: Record<string, string> = {}

  allowedFilters.forEach((filter) => {
    const value = searchParams.get(filter)
    if (value) {
      filters[filter] = value
    }
  })

  return filters
}
