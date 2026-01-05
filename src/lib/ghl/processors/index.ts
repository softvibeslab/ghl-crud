/**
 * Webhook Processors Index
 * Exports all entity-specific webhook processors
 */

export {
  ContactProcessor,
  createContactProcessor,
  type ContactWebhookPayload,
} from './contact.processor'

export {
  OpportunityProcessor,
  createOpportunityProcessor,
  type OpportunityWebhookPayload,
} from './opportunity.processor'

export {
  AppointmentProcessor,
  createAppointmentProcessor,
  type AppointmentWebhookPayload,
} from './appointment.processor'

export {
  ConversationProcessor,
  createConversationProcessor,
  type ConversationWebhookPayload,
  type MessageWebhookPayload,
} from './conversation.processor'

export {
  InvoiceProcessor,
  createInvoiceProcessor,
  type InvoiceWebhookPayload,
} from './invoice.processor'
