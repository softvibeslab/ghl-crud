/**
 * RBAC Middleware
 * Authentication and authorization middleware for API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPermissionService, PermissionService } from './permissions.service'
import type {
  UserContext,
  GHLEntityType,
  PermissionAction,
  EntityOwnership,
  UserRole,
  DashboardUser,
} from '@/types/rbac'

// ============================================
// TYPES
// ============================================

export interface AuthenticatedRequest extends NextRequest {
  context?: UserContext
}

export interface MiddlewareOptions {
  requireAuth?: boolean
  requiredRole?: UserRole | UserRole[]
  entityType?: GHLEntityType
  action?: PermissionAction
}

export interface AuthResult {
  success: boolean
  context?: UserContext
  error?: string
  statusCode?: number
}

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Get authenticated user context from request
 */
export async function getAuthContext(
  request: NextRequest
): Promise<AuthResult> {
  try {
    const supabase = await createClient()

    // Get current Supabase session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Not authenticated',
        statusCode: 401,
      }
    }

    // Get dashboard user profile
    const { data: dashboardUser, error: profileError } = await supabase
      .from('dashboard_users')
      .select('*')
      .eq('supabase_user_id', user.id)
      .eq('is_active', true)
      .single()

    if (profileError || !dashboardUser) {
      return {
        success: false,
        error: 'User profile not found or inactive',
        statusCode: 403,
      }
    }

    // Get full context using permission service
    const permissionService = createPermissionService(supabase)
    const context = await permissionService.getUserContext(dashboardUser.id)

    if (!context) {
      return {
        success: false,
        error: 'Failed to load user context',
        statusCode: 500,
      }
    }

    // Update last login
    await supabase
      .from('dashboard_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', dashboardUser.id)

    return {
      success: true,
      context,
    }
  } catch (error) {
    console.error('Auth error:', error)
    return {
      success: false,
      error: 'Authentication failed',
      statusCode: 500,
    }
  }
}

/**
 * Check if user has required role
 */
export function hasRole(
  userRole: UserRole,
  requiredRole: UserRole | UserRole[]
): boolean {
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

  // Role hierarchy: admin > manager > agent
  const roleHierarchy: Record<UserRole, number> = {
    admin: 3,
    manager: 2,
    agent: 1,
  }

  const userLevel = roleHierarchy[userRole]

  // Check if user's role meets any of the required roles
  return roles.some(role => userLevel >= roleHierarchy[role])
}

/**
 * Check permission for a specific action
 */
export async function checkPermission(
  context: UserContext,
  entityType: GHLEntityType,
  action: PermissionAction,
  ownership?: EntityOwnership
): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = await createClient()
  const permissionService = createPermissionService(supabase)

  return permissionService.checkPermission(
    context.user.id,
    entityType,
    action,
    ownership
  )
}

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Require authentication middleware
 * Returns context if authenticated, or error response
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ context: UserContext } | NextResponse> {
  const result = await getAuthContext(request)

  if (!result.success || !result.context) {
    return NextResponse.json(
      { error: result.error || 'Authentication required' },
      { status: result.statusCode || 401 }
    )
  }

  return { context: result.context }
}

/**
 * Require specific role middleware
 */
export async function requireRole(
  request: NextRequest,
  requiredRole: UserRole | UserRole[]
): Promise<{ context: UserContext } | NextResponse> {
  const authResult = await requireAuth(request)

  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  if (!hasRole(context.user.role, requiredRole)) {
    return NextResponse.json(
      {
        error: 'Insufficient permissions',
        required: requiredRole,
        current: context.user.role,
      },
      { status: 403 }
    )
  }

  return { context }
}

/**
 * Require permission for entity action
 */
export async function requirePermission(
  request: NextRequest,
  entityType: GHLEntityType,
  action: PermissionAction,
  ownership?: EntityOwnership
): Promise<{ context: UserContext } | NextResponse> {
  const authResult = await requireAuth(request)

  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  const permissionResult = await checkPermission(context, entityType, action, ownership)

  if (!permissionResult.allowed) {
    return NextResponse.json(
      {
        error: 'Permission denied',
        reason: permissionResult.reason,
        action,
        entityType,
      },
      { status: 403 }
    )
  }

  return { context }
}

// ============================================
// HIGHER-ORDER MIDDLEWARE
// ============================================

/**
 * Create a protected API handler with RBAC
 */
export function withRBAC(
  handler: (
    request: NextRequest,
    context: UserContext,
    params?: Record<string, string>
  ) => Promise<NextResponse>,
  options: MiddlewareOptions = {}
): (request: NextRequest, params?: { params: Record<string, string> }) => Promise<NextResponse> {
  return async (request: NextRequest, routeParams?: { params: Record<string, string> }) => {
    const { requireAuth: needsAuth = true, requiredRole, entityType, action } = options

    // Skip auth if not required
    if (!needsAuth) {
      const result = await getAuthContext(request)
      return handler(request, result.context!, routeParams?.params)
    }

    // Check authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { context } = authResult

    // Check role if required
    if (requiredRole && !hasRole(context.user.role, requiredRole)) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          required: requiredRole,
          current: context.user.role,
        },
        { status: 403 }
      )
    }

    // Check entity permission if required
    if (entityType && action) {
      const permissionResult = await checkPermission(context, entityType, action)
      if (!permissionResult.allowed) {
        return NextResponse.json(
          {
            error: 'Permission denied',
            reason: permissionResult.reason,
            action,
            entityType,
          },
          { status: 403 }
        )
      }
    }

    // Call the handler with context
    return handler(request, context, routeParams?.params)
  }
}

/**
 * Admin-only route wrapper
 */
export function adminOnly(
  handler: (request: NextRequest, context: UserContext) => Promise<NextResponse>
) {
  return withRBAC(handler, { requiredRole: 'admin' })
}

/**
 * Manager and above route wrapper
 */
export function managerOrAbove(
  handler: (request: NextRequest, context: UserContext) => Promise<NextResponse>
) {
  return withRBAC(handler, { requiredRole: ['admin', 'manager'] })
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get tenant ID from authenticated context
 */
export function getTenantId(context: UserContext): string {
  return context.tenant.id
}

/**
 * Get user's accessible location IDs
 */
export function getAccessibleLocationIds(context: UserContext): string[] {
  return context.assignedLocations
}

/**
 * Check if user can access a specific location
 */
export function canAccessLocation(
  context: UserContext,
  locationId: string
): boolean {
  if (context.user.role === 'admin') {
    return true
  }
  return context.assignedLocations.includes(locationId)
}

/**
 * Check if user can access a specific record based on ownership
 */
export function canAccessRecord(
  record: { assigned_to?: string | null; location_id?: string },
  context: UserContext
): boolean {
  const { user, assignedLocations, teamMembers } = context

  // Admins can access everything
  if (user.role === 'admin') {
    return true
  }

  // Check location access
  if (record.location_id && !assignedLocations.includes(record.location_id)) {
    return false
  }

  // For agents, must be assigned to the record
  if (user.role === 'agent') {
    if (record.assigned_to && record.assigned_to !== user.ghl_user_id) {
      return false
    }
  }

  // For managers, can access own or team records
  if (user.role === 'manager') {
    if (record.assigned_to) {
      const isOwn = record.assigned_to === user.ghl_user_id
      const isTeam = teamMembers.includes(record.assigned_to)
      if (!isOwn && !isTeam) {
        return false
      }
    }
  }

  return true
}

/**
 * Filter entity list based on user's access
 */
export function filterByAccess<T extends { location_id?: string; assigned_to?: string | null }>(
  items: T[],
  context: UserContext
): T[] {
  const { user, assignedLocations, teamMembers } = context

  // Admins see everything
  if (user.role === 'admin') {
    return items
  }

  return items.filter(item => {
    // Check location access
    if (item.location_id && !assignedLocations.includes(item.location_id)) {
      return false
    }

    // For agents, check assignment
    if (user.role === 'agent') {
      if (item.assigned_to && item.assigned_to !== user.ghl_user_id) {
        return false
      }
    }

    // For managers, check team
    if (user.role === 'manager') {
      if (item.assigned_to) {
        const isOwn = item.assigned_to === user.ghl_user_id
        const isTeam = teamMembers.includes(item.assigned_to)
        if (!isOwn && !isTeam) {
          return false
        }
      }
    }

    return true
  })
}

// ============================================
// EXPORTS
// ============================================

export {
  type UserContext,
  type GHLEntityType,
  type PermissionAction,
  type EntityOwnership,
  type UserRole,
}
