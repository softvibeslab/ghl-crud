/**
 * RBAC Types
 * Role-Based Access Control type definitions for GHL Dashboard
 */

import type { Json } from './database'

// ============================================
// ENUMS
// ============================================

export type UserRole = 'admin' | 'manager' | 'agent'
export type TenantStatus = 'active' | 'suspended' | 'pending'
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'completed'
export type OAuthProvider = 'agency' | 'location' | 'marketplace'
export type PermissionAction = 'create' | 'read' | 'update' | 'delete'

// ============================================
// DATABASE TABLE TYPES
// ============================================

export interface Tenant {
  id: string
  name: string
  slug: string
  settings: TenantSettings
  subscription_tier: string
  status: TenantStatus
  created_at: string
  updated_at: string
}

export interface TenantInsert {
  id?: string
  name: string
  slug: string
  settings?: TenantSettings
  subscription_tier?: string
  status?: TenantStatus
  created_at?: string
  updated_at?: string
}

export interface TenantUpdate {
  name?: string
  slug?: string
  settings?: TenantSettings
  subscription_tier?: string
  status?: TenantStatus
  updated_at?: string
}

export interface TenantSettings {
  features?: {
    multiLocation?: boolean
    advancedReporting?: boolean
    webhookIntegration?: boolean
    apiAccess?: boolean
  }
  branding?: {
    primaryColor?: string
    logo?: string
    favicon?: string
  }
  limits?: {
    maxUsers?: number
    maxLocations?: number
    apiRateLimit?: number
  }
}

// ============================================
// DASHBOARD USER TYPES
// ============================================

export interface DashboardUser {
  id: string
  supabase_user_id: string
  tenant_id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  ghl_user_id: string | null
  settings: UserSettings
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface DashboardUserInsert {
  id?: string
  supabase_user_id: string
  tenant_id: string
  email: string
  full_name: string
  avatar_url?: string | null
  role?: UserRole
  ghl_user_id?: string | null
  settings?: UserSettings
  is_active?: boolean
  last_login?: string | null
  created_at?: string
  updated_at?: string
}

export interface DashboardUserUpdate {
  email?: string
  full_name?: string
  avatar_url?: string | null
  role?: UserRole
  ghl_user_id?: string | null
  settings?: UserSettings
  is_active?: boolean
  last_login?: string | null
  updated_at?: string
}

export interface UserSettings {
  notifications?: {
    email?: boolean
    push?: boolean
    sms?: boolean
  }
  preferences?: {
    timezone?: string
    dateFormat?: string
    language?: string
    theme?: 'light' | 'dark' | 'system'
  }
  dashboard?: {
    defaultView?: string
    pinnedEntities?: string[]
  }
}

// ============================================
// ASSIGNMENT TYPES
// ============================================

export interface UserLocationAssignment {
  id: string
  user_id: string
  location_id: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
  assigned_at: string
  assigned_by: string | null
}

export interface UserLocationAssignmentInsert {
  id?: string
  user_id: string
  location_id: string
  can_view?: boolean
  can_edit?: boolean
  can_delete?: boolean
  assigned_at?: string
  assigned_by?: string | null
}

export interface ManagerTeamAssignment {
  id: string
  manager_id: string
  agent_id: string
  assigned_at: string
  assigned_by: string | null
}

export interface ManagerTeamAssignmentInsert {
  id?: string
  manager_id: string
  agent_id: string
  assigned_at?: string
  assigned_by?: string | null
}

// ============================================
// OAUTH TOKEN TYPES
// ============================================

export interface GHLOAuthToken {
  id: string
  tenant_id: string
  location_id: string | null
  provider: OAuthProvider
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  token_type: string
  expires_at: string
  scopes: string[]
  company_id: string | null
  user_type: string | null
  created_at: string
  updated_at: string
}

export interface GHLOAuthTokenInsert {
  id?: string
  tenant_id: string
  location_id?: string | null
  provider?: OAuthProvider
  access_token_encrypted: string
  refresh_token_encrypted?: string | null
  token_type?: string
  expires_at: string
  scopes?: string[]
  company_id?: string | null
  user_type?: string | null
  created_at?: string
  updated_at?: string
}

export interface GHLOAuthTokenUpdate {
  access_token_encrypted?: string
  refresh_token_encrypted?: string | null
  expires_at?: string
  scopes?: string[]
  updated_at?: string
}

// ============================================
// PERMISSION OVERRIDE TYPES
// ============================================

export interface PermissionOverride {
  id: string
  user_id: string
  entity_type: string
  entity_id: string | null
  action: PermissionAction
  is_allowed: boolean
  reason: string | null
  granted_by: string | null
  expires_at: string | null
  created_at: string
}

export interface PermissionOverrideInsert {
  id?: string
  user_id: string
  entity_type: string
  entity_id?: string | null
  action: PermissionAction
  is_allowed?: boolean
  reason?: string | null
  granted_by?: string | null
  expires_at?: string | null
  created_at?: string
}

// ============================================
// SYNC STATUS TYPES
// ============================================

export interface SyncStatusRecord {
  id: string
  tenant_id: string
  location_id: string | null
  entity_type: string
  status: SyncStatus
  last_sync_at: string | null
  next_sync_at: string | null
  last_cursor: string | null
  records_synced: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface SyncStatusInsert {
  id?: string
  tenant_id: string
  location_id?: string | null
  entity_type: string
  status?: SyncStatus
  last_sync_at?: string | null
  next_sync_at?: string | null
  last_cursor?: string | null
  records_synced?: number
  error_message?: string | null
  created_at?: string
  updated_at?: string
}

export interface SyncStatusUpdate {
  status?: SyncStatus
  last_sync_at?: string | null
  next_sync_at?: string | null
  last_cursor?: string | null
  records_synced?: number
  error_message?: string | null
  updated_at?: string
}

// ============================================
// PERMISSION MATRIX TYPES
// ============================================

export interface PermissionMatrix {
  contacts: EntityPermissions
  opportunities: EntityPermissions
  appointments: EntityPermissions
  conversations: EntityPermissions
  invoices: EntityPermissions
  calendars: EntityPermissions
  pipelines: EntityPermissions
  products: EntityPermissions
  users: EntityPermissions
  locations: EntityPermissions
  workflows: EntityPermissions
}

export interface EntityPermissions {
  create: boolean
  read: boolean
  update: boolean
  delete: boolean
}

// Default permission matrices by role
export const ROLE_PERMISSIONS: Record<UserRole, PermissionMatrix> = {
  admin: {
    contacts: { create: true, read: true, update: true, delete: true },
    opportunities: { create: true, read: true, update: true, delete: true },
    appointments: { create: true, read: true, update: true, delete: true },
    conversations: { create: true, read: true, update: true, delete: true },
    invoices: { create: true, read: true, update: true, delete: true },
    calendars: { create: true, read: true, update: true, delete: true },
    pipelines: { create: true, read: true, update: true, delete: true },
    products: { create: true, read: true, update: true, delete: true },
    users: { create: true, read: true, update: true, delete: true },
    locations: { create: true, read: true, update: true, delete: true },
    workflows: { create: true, read: true, update: true, delete: true },
  },
  manager: {
    contacts: { create: true, read: true, update: true, delete: false },
    opportunities: { create: true, read: true, update: true, delete: false },
    appointments: { create: true, read: true, update: true, delete: false },
    conversations: { create: true, read: true, update: true, delete: false },
    invoices: { create: true, read: true, update: true, delete: false },
    calendars: { create: true, read: true, update: true, delete: false },
    pipelines: { create: false, read: true, update: false, delete: false },
    products: { create: true, read: true, update: true, delete: false },
    users: { create: false, read: true, update: false, delete: false },
    locations: { create: false, read: true, update: false, delete: false },
    workflows: { create: false, read: true, update: false, delete: false },
  },
  agent: {
    contacts: { create: true, read: true, update: true, delete: false },
    opportunities: { create: true, read: true, update: true, delete: false },
    appointments: { create: true, read: true, update: true, delete: false },
    conversations: { create: true, read: true, update: true, delete: false },
    invoices: { create: false, read: true, update: false, delete: false },
    calendars: { create: false, read: true, update: false, delete: false },
    pipelines: { create: false, read: true, update: false, delete: false },
    products: { create: false, read: true, update: false, delete: false },
    users: { create: false, read: false, update: false, delete: false },
    locations: { create: false, read: true, update: false, delete: false },
    workflows: { create: false, read: true, update: false, delete: false },
  },
}

// ============================================
// CONTEXT AND SESSION TYPES
// ============================================

export interface UserContext {
  user: DashboardUser
  tenant: Tenant
  permissions: PermissionMatrix
  assignedLocations: string[]
  teamMembers: string[] // For managers: agents in their team
  overrides: PermissionOverride[]
}

export interface AuthSession {
  supabaseUserId: string
  tenantId: string
  dashboardUserId: string
  role: UserRole
  expiresAt: string
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface RBACFilterOptions {
  userId: string
  tenantId: string
  role: UserRole
  assignedLocations?: string[]
  teamMembers?: string[]
}

export interface FilteredQueryResult<T> {
  data: T[]
  total: number
  filtered: number
  hasMore: boolean
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  override?: PermissionOverride
}

// ============================================
// UTILITY TYPES
// ============================================

export type GHLEntityType =
  | 'contacts'
  | 'opportunities'
  | 'appointments'
  | 'conversations'
  | 'invoices'
  | 'calendars'
  | 'pipelines'
  | 'products'
  | 'users'
  | 'locations'
  | 'workflows'

export interface EntityOwnership {
  locationId?: string
  assignedTo?: string
  createdBy?: string
}
