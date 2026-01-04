import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { BaseCRUDService, PaginationParams, FilterParams, ListResponse, CRUDResponse } from './base-crud.service'
import {
  GHLLocation, GHLLocationInsert, GHLLocationUpdate,
  GHLPipeline, GHLPipelineInsert, GHLPipelineUpdate,
  GHLPipelineStage, GHLPipelineStageInsert, GHLPipelineStageUpdate,
  GHLContact, GHLContactInsert, GHLContactUpdate,
  GHLOpportunity, GHLOpportunityInsert, GHLOpportunityUpdate,
  GHLWorkflow, GHLWorkflowInsert, GHLWorkflowUpdate,
  GHLConversation, GHLConversationInsert, GHLConversationUpdate,
  GHLMessage, GHLMessageInsert, GHLMessageUpdate,
  GHLCalendar, GHLCalendarInsert, GHLCalendarUpdate,
  GHLAppointment, GHLAppointmentInsert, GHLAppointmentUpdate,
  GHLInvoice, GHLInvoiceInsert, GHLInvoiceUpdate,
  GHLProduct, GHLProductInsert, GHLProductUpdate,
  GHLUser, GHLUserInsert, GHLUserUpdate
} from '@/types/database'

// Re-export base types
export type { PaginationParams, FilterParams, ListResponse, CRUDResponse }
export { BaseCRUDService }

// Location Service
export class LocationService extends BaseCRUDService<GHLLocation, GHLLocationInsert, GHLLocationUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_locations')
  }

  async findActive(): Promise<ListResponse<GHLLocation>> {
    return this.findAll({}, { is_active: true })
  }
}

// Pipeline Service
export class PipelineService extends BaseCRUDService<GHLPipeline, GHLPipelineInsert, GHLPipelineUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_pipelines')
  }

  async findByLocation(locationId: string): Promise<ListResponse<GHLPipeline>> {
    return this.findAll({}, { location_id: locationId })
  }
}

// Pipeline Stage Service
export class PipelineStageService extends BaseCRUDService<GHLPipelineStage, GHLPipelineStageInsert, GHLPipelineStageUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_pipeline_stages')
  }

  async findByPipeline(pipelineId: string): Promise<ListResponse<GHLPipelineStage>> {
    const { page = 1, limit = 100 } = {}
    const offset = (page - 1) * limit

    const { data, error, count } = await this.supabase
      .from('ghl_pipeline_stages')
      .select('*', { count: 'exact' })
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return { data: [], error: error.message, count: 0, page, limit, totalPages: 0 }
    }

    const totalCount = count ?? 0
    return {
      data: (data ?? []) as GHLPipelineStage[],
      error: null,
      count: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  }

  // Override findById for composite key
  async findByCompositeId(pipelineId: string, stageId: string): Promise<CRUDResponse<GHLPipelineStage>> {
    const { data, error } = await this.supabase
      .from('ghl_pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .eq('id', stageId)
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as GHLPipelineStage, error: null }
  }
}

// Contact Service
export class ContactService extends BaseCRUDService<GHLContact, GHLContactInsert, GHLContactUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_contacts')
  }

  async findByLocation(locationId: string, pagination?: PaginationParams): Promise<ListResponse<GHLContact>> {
    return this.findAll(pagination, { location_id: locationId, is_deleted: false })
  }

  async findByEmail(email: string): Promise<CRUDResponse<GHLContact>> {
    const { data, error } = await this.supabase
      .from('ghl_contacts')
      .select('*')
      .eq('email', email)
      .eq('is_deleted', false)
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as GHLContact, error: null }
  }

  async findByPhone(phone: string): Promise<CRUDResponse<GHLContact>> {
    const { data, error } = await this.supabase
      .from('ghl_contacts')
      .select('*')
      .eq('phone', phone)
      .eq('is_deleted', false)
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as GHLContact, error: null }
  }

  async findByTags(tags: string[], locationId?: string): Promise<ListResponse<GHLContact>> {
    let query = this.supabase
      .from('ghl_contacts')
      .select('*', { count: 'exact' })
      .contains('tags', tags)
      .eq('is_deleted', false)

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data, error, count } = await query

    if (error) {
      return { data: [], error: error.message, count: 0, page: 1, limit: 100, totalPages: 0 }
    }

    return {
      data: (data ?? []) as GHLContact[],
      error: null,
      count: count ?? 0,
      page: 1,
      limit: 100,
      totalPages: 1
    }
  }

  async searchContacts(searchTerm: string, locationId?: string): Promise<ListResponse<GHLContact>> {
    const searchFields = ['first_name', 'last_name', 'email', 'phone', 'company_name']

    let query = this.supabase
      .from('ghl_contacts')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .or(searchFields.map(f => `${f}.ilike.%${searchTerm}%`).join(','))

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data, error, count } = await query.limit(50)

    if (error) {
      return { data: [], error: error.message, count: 0, page: 1, limit: 50, totalPages: 0 }
    }

    return {
      data: (data ?? []) as GHLContact[],
      error: null,
      count: count ?? 0,
      page: 1,
      limit: 50,
      totalPages: 1
    }
  }

  // Soft delete for contacts
  async softDelete(id: string): Promise<CRUDResponse<GHLContact>> {
    return this.update(id, { is_deleted: true } as GHLContactUpdate)
  }
}

// Opportunity Service
export class OpportunityService extends BaseCRUDService<GHLOpportunity, GHLOpportunityInsert, GHLOpportunityUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_opportunities')
  }

  async findByLocation(locationId: string, pagination?: PaginationParams): Promise<ListResponse<GHLOpportunity>> {
    return this.findAll(pagination, { location_id: locationId })
  }

  async findByContact(contactId: string): Promise<ListResponse<GHLOpportunity>> {
    return this.findAll({}, { contact_id: contactId })
  }

  async findByPipeline(pipelineId: string, stageId?: string): Promise<ListResponse<GHLOpportunity>> {
    const filters: FilterParams = { pipeline_id: pipelineId }
    if (stageId) {
      filters.pipeline_stage_id = stageId
    }
    return this.findAll({}, filters)
  }

  async findByStatus(status: 'open' | 'won' | 'lost' | 'abandoned', locationId?: string): Promise<ListResponse<GHLOpportunity>> {
    const filters: FilterParams = { status }
    if (locationId) {
      filters.location_id = locationId
    }
    return this.findAll({}, filters)
  }

  async getTotalValue(locationId: string, status?: string): Promise<CRUDResponse<number>> {
    let query = this.supabase
      .from('ghl_opportunities')
      .select('monetary_value')
      .eq('location_id', locationId)

    if (status) {
      query = query.eq('status', status as 'open' | 'won' | 'lost' | 'abandoned')
    }

    const { data, error } = await query

    if (error) {
      return { data: null, error: error.message }
    }

    const total = (data ?? []).reduce((sum, opp: { monetary_value: number }) => sum + (opp.monetary_value || 0), 0)
    return { data: total, error: null }
  }
}

// Workflow Service
export class WorkflowService extends BaseCRUDService<GHLWorkflow, GHLWorkflowInsert, GHLWorkflowUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_workflows')
  }

  async findByLocation(locationId: string): Promise<ListResponse<GHLWorkflow>> {
    return this.findAll({}, { location_id: locationId })
  }

  async findPublished(locationId?: string): Promise<ListResponse<GHLWorkflow>> {
    const filters: FilterParams = { status: 'published' }
    if (locationId) {
      filters.location_id = locationId
    }
    return this.findAll({}, filters)
  }
}

// Conversation Service
export class ConversationService extends BaseCRUDService<GHLConversation, GHLConversationInsert, GHLConversationUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_conversations')
  }

  async findByLocation(locationId: string, pagination?: PaginationParams): Promise<ListResponse<GHLConversation>> {
    return this.findAll(
      { ...pagination, sortBy: 'last_message_date', sortOrder: 'desc' },
      { location_id: locationId, is_archived: false }
    )
  }

  async findByContact(contactId: string): Promise<ListResponse<GHLConversation>> {
    return this.findAll({}, { contact_id: contactId })
  }

  async findUnread(locationId: string): Promise<ListResponse<GHLConversation>> {
    const { data, error, count } = await this.supabase
      .from('ghl_conversations')
      .select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .gt('unread_count', 0)
      .eq('is_archived', false)
      .order('last_message_date', { ascending: false })

    if (error) {
      return { data: [], error: error.message, count: 0, page: 1, limit: 50, totalPages: 0 }
    }

    return {
      data: (data ?? []) as GHLConversation[],
      error: null,
      count: count ?? 0,
      page: 1,
      limit: 50,
      totalPages: 1
    }
  }

  async markAsRead(id: string): Promise<CRUDResponse<GHLConversation>> {
    return this.update(id, { unread_count: 0 } as GHLConversationUpdate)
  }
}

// Message Service
export class MessageService extends BaseCRUDService<GHLMessage, GHLMessageInsert, GHLMessageUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_messages')
  }

  async findByConversation(conversationId: string, pagination?: PaginationParams): Promise<ListResponse<GHLMessage>> {
    return this.findAll(
      { ...pagination, sortBy: 'created_at', sortOrder: 'asc' },
      { conversation_id: conversationId }
    )
  }

  async findByContact(contactId: string, pagination?: PaginationParams): Promise<ListResponse<GHLMessage>> {
    return this.findAll(
      { ...pagination, sortBy: 'created_at', sortOrder: 'desc' },
      { contact_id: contactId }
    )
  }

  async getRecentMessages(locationId: string, limit: number = 50): Promise<ListResponse<GHLMessage>> {
    const { data, error, count } = await this.supabase
      .from('ghl_messages')
      .select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return { data: [], error: error.message, count: 0, page: 1, limit, totalPages: 0 }
    }

    return {
      data: (data ?? []) as GHLMessage[],
      error: null,
      count: count ?? 0,
      page: 1,
      limit,
      totalPages: 1
    }
  }
}

// Calendar Service
export class CalendarService extends BaseCRUDService<GHLCalendar, GHLCalendarInsert, GHLCalendarUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_calendars')
  }

  async findByLocation(locationId: string): Promise<ListResponse<GHLCalendar>> {
    return this.findAll({}, { location_id: locationId, is_active: true })
  }
}

// Appointment Service
export class AppointmentService extends BaseCRUDService<GHLAppointment, GHLAppointmentInsert, GHLAppointmentUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_appointments')
  }

  async findByLocation(locationId: string, pagination?: PaginationParams): Promise<ListResponse<GHLAppointment>> {
    return this.findAll(
      { ...pagination, sortBy: 'start_time', sortOrder: 'asc' },
      { location_id: locationId }
    )
  }

  async findByContact(contactId: string): Promise<ListResponse<GHLAppointment>> {
    return this.findAll({}, { contact_id: contactId })
  }

  async findByCalendar(calendarId: string): Promise<ListResponse<GHLAppointment>> {
    return this.findAll({}, { calendar_id: calendarId })
  }

  async findUpcoming(locationId: string, days: number = 7): Promise<ListResponse<GHLAppointment>> {
    const now = new Date()
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const { data, error, count } = await this.supabase
      .from('ghl_appointments')
      .select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .gte('start_time', now.toISOString())
      .lte('start_time', future.toISOString())
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true })

    if (error) {
      return { data: [], error: error.message, count: 0, page: 1, limit: 100, totalPages: 0 }
    }

    return {
      data: (data ?? []) as GHLAppointment[],
      error: null,
      count: count ?? 0,
      page: 1,
      limit: 100,
      totalPages: 1
    }
  }

  async findByDateRange(locationId: string, startDate: Date, endDate: Date): Promise<ListResponse<GHLAppointment>> {
    const { data, error, count } = await this.supabase
      .from('ghl_appointments')
      .select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .gte('start_time', startDate.toISOString())
      .lte('end_time', endDate.toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      return { data: [], error: error.message, count: 0, page: 1, limit: 100, totalPages: 0 }
    }

    return {
      data: (data ?? []) as GHLAppointment[],
      error: null,
      count: count ?? 0,
      page: 1,
      limit: 100,
      totalPages: 1
    }
  }
}

// Invoice Service
export class InvoiceService extends BaseCRUDService<GHLInvoice, GHLInvoiceInsert, GHLInvoiceUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_invoices')
  }

  async findByLocation(locationId: string, pagination?: PaginationParams): Promise<ListResponse<GHLInvoice>> {
    return this.findAll(pagination, { location_id: locationId })
  }

  async findByContact(contactId: string): Promise<ListResponse<GHLInvoice>> {
    return this.findAll({}, { contact_id: contactId })
  }

  async findByStatus(status: string, locationId?: string): Promise<ListResponse<GHLInvoice>> {
    const filters: FilterParams = { status }
    if (locationId) {
      filters.location_id = locationId
    }
    return this.findAll({}, filters)
  }

  async findOverdue(locationId: string): Promise<ListResponse<GHLInvoice>> {
    const today = new Date().toISOString().split('T')[0]

    const { data, error, count } = await this.supabase
      .from('ghl_invoices')
      .select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .lt('due_date', today)
      .not('status', 'in', '("paid","void")')
      .order('due_date', { ascending: true })

    if (error) {
      return { data: [], error: error.message, count: 0, page: 1, limit: 100, totalPages: 0 }
    }

    return {
      data: (data ?? []) as GHLInvoice[],
      error: null,
      count: count ?? 0,
      page: 1,
      limit: 100,
      totalPages: 1
    }
  }

  async getTotalRevenue(locationId: string): Promise<CRUDResponse<number>> {
    const { data, error } = await this.supabase
      .from('ghl_invoices')
      .select('total_amount')
      .eq('location_id', locationId)
      .eq('status', 'paid' as const)

    if (error) {
      return { data: null, error: error.message }
    }

    const total = (data ?? []).reduce((sum, inv: { total_amount: number }) => sum + (inv.total_amount || 0), 0)
    return { data: total, error: null }
  }
}

// Product Service
export class ProductService extends BaseCRUDService<GHLProduct, GHLProductInsert, GHLProductUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_products')
  }

  async findByLocation(locationId: string): Promise<ListResponse<GHLProduct>> {
    return this.findAll({}, { location_id: locationId })
  }

  async findAvailable(locationId: string): Promise<ListResponse<GHLProduct>> {
    return this.findAll({}, { location_id: locationId, available_in_store: true })
  }
}

// User Service
export class UserService extends BaseCRUDService<GHLUser, GHLUserInsert, GHLUserUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ghl_users')
  }

  async findByLocation(locationId: string): Promise<ListResponse<GHLUser>> {
    return this.findAll({}, { location_id: locationId, is_active: true })
  }

  async findByEmail(email: string): Promise<CRUDResponse<GHLUser>> {
    const { data, error } = await this.supabase
      .from('ghl_users')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as GHLUser, error: null }
  }
}

// Service Factory
export function createServices(supabase: SupabaseClient<Database>) {
  return {
    locations: new LocationService(supabase),
    pipelines: new PipelineService(supabase),
    pipelineStages: new PipelineStageService(supabase),
    contacts: new ContactService(supabase),
    opportunities: new OpportunityService(supabase),
    workflows: new WorkflowService(supabase),
    conversations: new ConversationService(supabase),
    messages: new MessageService(supabase),
    calendars: new CalendarService(supabase),
    appointments: new AppointmentService(supabase),
    invoices: new InvoiceService(supabase),
    products: new ProductService(supabase),
    users: new UserService(supabase)
  }
}

export type GHLServices = ReturnType<typeof createServices>
