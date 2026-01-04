import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export type TableName = keyof Database['public']['Tables']

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FilterParams {
  [key: string]: string | number | boolean | string[] | undefined
}

export interface CRUDResponse<T> {
  data: T | null
  error: string | null
  count?: number
}

export interface ListResponse<T> {
  data: T[]
  error: string | null
  count: number
  page: number
  limit: number
  totalPages: number
}

export class BaseCRUDService<
  TRow extends Record<string, unknown>,
  TInsert extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>
> {
  protected supabase: SupabaseClient<Database>
  protected tableName: TableName

  constructor(supabase: SupabaseClient<Database>, tableName: TableName) {
    this.supabase = supabase
    this.tableName = tableName
  }

  async findAll(
    pagination: PaginationParams = {},
    filters: FilterParams = {}
  ): Promise<ListResponse<TRow>> {
    const { page = 1, limit = 20, sortBy = 'id', sortOrder = 'desc' } = pagination
    const offset = (page - 1) * limit

    let query = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact' })

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          query = query.contains(key, value)
        } else if (typeof value === 'string' && value.includes('%')) {
          query = query.ilike(key, value)
        } else {
          query = query.eq(key, value)
        }
      }
    })

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return {
        data: [],
        error: error.message,
        count: 0,
        page,
        limit,
        totalPages: 0
      }
    }

    const totalCount = count ?? 0
    return {
      data: (data ?? []) as TRow[],
      error: null,
      count: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  }

  async findById(id: string): Promise<CRUDResponse<TRow>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as TRow, error: null }
  }

  async create(payload: TInsert): Promise<CRUDResponse<TRow>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(payload as never)
      .select()
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as TRow, error: null }
  }

  async update(id: string, payload: TUpdate): Promise<CRUDResponse<TRow>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(payload as never)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as TRow, error: null }
  }

  async delete(id: string): Promise<CRUDResponse<{ id: string }>> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: { id }, error: null }
  }

  async upsert(payload: TInsert): Promise<CRUDResponse<TRow>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(payload as never, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as TRow, error: null }
  }

  async bulkCreate(payloads: TInsert[]): Promise<CRUDResponse<TRow[]>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(payloads as never[])
      .select()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as TRow[], error: null }
  }

  async bulkUpsert(payloads: TInsert[]): Promise<CRUDResponse<TRow[]>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(payloads as never[], { onConflict: 'id' })
      .select()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as TRow[], error: null }
  }

  async count(filters: FilterParams = {}): Promise<CRUDResponse<number>> {
    let query = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query = query.eq(key, value)
      }
    })

    const { count, error } = await query

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: count ?? 0, error: null }
  }

  async search(
    searchTerm: string,
    searchFields: string[],
    pagination: PaginationParams = {}
  ): Promise<ListResponse<TRow>> {
    const { page = 1, limit = 20, sortBy = 'id', sortOrder = 'desc' } = pagination
    const offset = (page - 1) * limit

    // Build OR filter for search
    const orFilter = searchFields
      .map(field => `${field}.ilike.%${searchTerm}%`)
      .join(',')

    const { data, error, count } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .or(orFilter)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    if (error) {
      return {
        data: [],
        error: error.message,
        count: 0,
        page,
        limit,
        totalPages: 0
      }
    }

    const totalCount = count ?? 0
    return {
      data: (data ?? []) as TRow[],
      error: null,
      count: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  }
}
