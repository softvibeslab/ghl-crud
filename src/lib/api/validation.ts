import { z } from 'zod'
import type { Json } from '@/types/database'

// Common schemas - properly typed for Supabase Json compatibility
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(jsonSchema),
    z.array(jsonSchema),
  ])
)

// Location schemas
export const locationCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  address_data: jsonSchema.optional().default({}),
  timezone: z.string().default('UTC'),
  settings: jsonSchema.optional().default({}),
  logo_url: z.string().url().optional().nullable(),
  is_active: z.boolean().optional().default(true),
})

export const locationUpdateSchema = locationCreateSchema.partial().omit({ id: true })

// Pipeline schemas
export const pipelineCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  name: z.string().min(1, 'Name is required'),
  show_in_funnel: z.boolean().optional().default(true),
  show_in_pie_chart: z.boolean().optional().default(true),
})

export const pipelineUpdateSchema = pipelineCreateSchema.partial().omit({ id: true })

// Pipeline Stage schemas
export const pipelineStageCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  pipeline_id: z.string().min(1, 'Pipeline ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  name: z.string().min(1, 'Name is required'),
  position: z.number().int().min(0).optional().default(0),
  probability: z.number().min(0).max(100).optional().default(0),
})

export const pipelineStageUpdateSchema = pipelineStageCreateSchema.partial().omit({ id: true })

// Contact schemas
export const contactCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  secondary_email: z.string().email().optional().nullable(),
  company_name: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  type: z.string().optional().default('lead'),
  dnd: z.boolean().optional().default(false),
  dnd_settings: jsonSchema.optional().default({}),
  assigned_to: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  address_data: jsonSchema.optional().default({}),
  custom_fields: jsonSchema.optional().default({}),
  custom_attributes: jsonSchema.optional().default({}),
  attribution_data: jsonSchema.optional().default({}),
})

export const contactUpdateSchema = contactCreateSchema.partial().omit({ id: true })

// Opportunity schemas
export const opportunityCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  contact_id: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['open', 'won', 'lost', 'abandoned']).optional().default('open'),
  pipeline_id: z.string().min(1, 'Pipeline ID is required'),
  pipeline_stage_id: z.string().min(1, 'Pipeline Stage ID is required'),
  monetary_value: z.number().min(0).optional().default(0),
  currency: z.string().optional().default('USD'),
  assigned_to: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  loss_reason: z.string().optional().nullable(),
  custom_fields: jsonSchema.optional().default({}),
  notes: z.string().optional().nullable(),
})

export const opportunityUpdateSchema = opportunityCreateSchema.partial().omit({ id: true })

// Workflow schemas
export const workflowCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['draft', 'published']).optional().default('draft'),
  version: z.number().int().min(1).optional().default(1),
  trigger_types: z.array(z.string()).optional().default([]),
  description: z.string().optional().nullable(),
})

export const workflowUpdateSchema = workflowCreateSchema.partial().omit({ id: true })

// Conversation schemas
export const conversationCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  contact_id: z.string().optional().nullable(),
  type: z.string().optional().default('sms'),
  channel: z.string().optional().nullable(),
  unread_count: z.number().int().min(0).optional().default(0),
  last_message_body: z.string().optional().nullable(),
  last_message_type: z.string().optional().nullable(),
  last_message_date: z.string().optional().nullable(),
  assigned_to: z.string().optional().nullable(),
  starred: z.boolean().optional().default(false),
  is_archived: z.boolean().optional().default(false),
  inbox_status: z.string().optional().default('open'),
})

export const conversationUpdateSchema = conversationCreateSchema.partial().omit({ id: true })

// Message schemas
export const messageCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  conversation_id: z.string().min(1, 'Conversation ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  contact_id: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  message_type: z.string().min(1, 'Message type is required'),
  direction: z.enum(['inbound', 'outbound']),
  status: z.string().optional().default('pending'),
  content_type: z.string().optional().default('text/plain'),
  attachments: jsonSchema.optional().default([]),
  meta_data: jsonSchema.optional().default({}),
  source: z.string().optional().nullable(),
  user_id: z.string().optional().nullable(),
})

export const messageUpdateSchema = messageCreateSchema.partial().omit({ id: true })

// Calendar schemas
export const calendarCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  widget_slug: z.string().optional().nullable(),
  calendar_type: z.string().optional().default('personal'),
  team_members: jsonSchema.optional().default([]),
  event_type: z.string().optional().nullable(),
  slot_duration: z.number().int().min(5).optional().default(30),
  slot_buffer: z.number().int().min(0).optional().default(0),
  availability: jsonSchema.optional().default({}),
  notifications: jsonSchema.optional().default({}),
  is_active: z.boolean().optional().default(true),
})

export const calendarUpdateSchema = calendarCreateSchema.partial().omit({ id: true })

// Appointment schemas
export const appointmentCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  contact_id: z.string().optional().nullable(),
  calendar_id: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required'),
  status: z.enum(['confirmed', 'cancelled', 'showed', 'noshow', 'invalid']).optional().default('confirmed'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  timezone: z.string().optional().default('UTC'),
  assigned_user_id: z.string().optional().nullable(),
  appointment_type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  google_event_id: z.string().optional().nullable(),
  appointment_status: z.string().optional().nullable(),
})

export const appointmentUpdateSchema = appointmentCreateSchema.partial().omit({ id: true })

// Invoice schemas
export const invoiceCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  contact_id: z.string().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent', 'paid', 'void', 'partially_paid']).optional().default('draft'),
  due_date: z.string().optional().nullable(),
  issue_date: z.string().optional().nullable(),
  amount_due: z.number().min(0).optional().default(0),
  total_amount: z.number().min(0).optional().default(0),
  discount: z.number().min(0).optional().default(0),
  currency: z.string().optional().default('USD'),
  items: jsonSchema.optional().default([]),
  business_details: jsonSchema.optional().default({}),
  payment_terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  sent_to: jsonSchema.optional().default([]),
})

export const invoiceUpdateSchema = invoiceCreateSchema.partial().omit({ id: true })

// Product schemas
export const productCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().min(1, 'Location ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  product_type: z.string().optional().default('one_time'),
  price: z.number().min(0).optional().default(0),
  currency: z.string().optional().default('USD'),
  image_url: z.string().url().optional().nullable(),
  available_in_store: z.boolean().optional().default(true),
  statement_descriptor: z.string().optional().nullable(),
})

export const productUpdateSchema = productCreateSchema.partial().omit({ id: true })

// User schemas
export const userCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  location_id: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().nullable(),
  role: z.string().optional().default('user'),
  permissions: jsonSchema.optional().default({}),
  is_active: z.boolean().optional().default(true),
})

export const userUpdateSchema = userCreateSchema.partial().omit({ id: true })

// Validation helper
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    return { success: false, error: errors.join(', ') }
  }
  return { success: true, data: result.data }
}
