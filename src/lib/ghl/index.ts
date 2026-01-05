/**
 * GHL Integration Module
 * Exports all GHL-related services and utilities
 */

// OAuth Service
export {
  GHLOAuthService,
  createOAuthService,
  GHL_OAUTH_SCOPES,
  type GHLOAuthScope,
  type GHLTokenResponse,
  type GHLOAuthToken,
} from './oauth.service'

// API Client
export {
  GHLApiClient,
  createGHLApiClient,
  type GHLApiResponse,
  type GHLPaginatedResponse,
} from './api-client'

// Webhook Handler
export {
  GHLWebhookHandler,
  createWebhookHandler,
  type GHLWebhookEvent,
  type WebhookHandlerResult,
} from './webhook-handler'

// Sync Service
export {
  GHLSyncService,
  createSyncService,
  type SyncOptions,
  type SyncResult,
} from './sync.service'
