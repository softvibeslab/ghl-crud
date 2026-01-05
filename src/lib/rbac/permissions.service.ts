/**
 * RBAC Permissions Service
 * Handles permission checking and enforcement for GHL Dashboard
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  ROLE_PERMISSIONS,
  type UserRole,
  type DashboardUser,
  type PermissionMatrix,
  type EntityPermissions,
  type PermissionOverride,
  type PermissionCheckResult,
  type GHLEntityType,
  type EntityOwnership,
  type UserContext,
  type PermissionAction,
} from '@/types/rbac'

// Re-export for convenience
export { ROLE_PERMISSIONS }

// Note: Using 'any' for Supabase client until migrations are applied and types regenerated

/**
 * Permission Service for checking and enforcing RBAC
 */
export class PermissionService {
  constructor(private supabase: SupabaseClient<any>) {}

  /**
   * Check if a user has permission to perform an action on an entity
   */
  async checkPermission(
    userId: string,
    entityType: GHLEntityType,
    action: PermissionAction,
    ownership?: EntityOwnership
  ): Promise<PermissionCheckResult> {
    // Get user context
    const context = await this.getUserContext(userId)
    if (!context) {
      return { allowed: false, reason: 'User not found' }
    }

    // Check for explicit overrides first
    const override = await this.checkOverrides(userId, entityType, action)
    if (override) {
      return {
        allowed: override.is_allowed,
        reason: override.reason || 'Permission override applied',
        override,
      }
    }

    // Get base permissions for role
    const basePermissions = context.permissions[entityType]
    if (!basePermissions[action]) {
      return { allowed: false, reason: `Role ${context.user.role} cannot ${action} ${entityType}` }
    }

    // For agents and managers, check ownership/assignment constraints
    if (context.user.role !== 'admin' && ownership) {
      const ownershipCheck = this.checkOwnershipConstraints(context, ownership)
      if (!ownershipCheck.allowed) {
        return ownershipCheck
      }
    }

    return { allowed: true }
  }

  /**
   * Get full user context including permissions
   */
  async getUserContext(userId: string): Promise<UserContext | null> {
    // Get dashboard user
    const { data: user, error: userError } = await this.supabase
      .from('dashboard_users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return null
    }

    // Get tenant
    const { data: tenant, error: tenantError } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('id', user.tenant_id)
      .single()

    if (tenantError || !tenant) {
      return null
    }

    // Get assigned locations
    const { data: locationAssignments } = await this.supabase
      .from('user_location_assignments')
      .select('location_id')
      .eq('user_id', userId)
      .eq('can_view', true)

    const assignedLocations = locationAssignments?.map(a => a.location_id) || []

    // Get team members (for managers)
    let teamMembers: string[] = []
    if (user.role === 'manager') {
      const { data: teamAssignments } = await this.supabase
        .from('manager_team_assignments')
        .select('agent_id')
        .eq('manager_id', userId)

      teamMembers = teamAssignments?.map(a => a.agent_id) || []
    }

    // Get permission overrides
    const { data: overrides } = await this.supabase
      .from('permission_overrides')
      .select('*')
      .eq('user_id', userId)
      .or('expires_at.is.null,expires_at.gt.now()')

    // Build permission matrix with role defaults
    const permissions = this.buildPermissionMatrix(user.role as UserRole, overrides || [])

    return {
      user: user as DashboardUser,
      tenant: tenant,
      permissions,
      assignedLocations,
      teamMembers,
      overrides: overrides || [],
    }
  }

  /**
   * Check for permission overrides
   */
  private async checkOverrides(
    userId: string,
    entityType: GHLEntityType,
    action: PermissionAction
  ): Promise<PermissionOverride | null> {
    const { data: overrides } = await this.supabase
      .from('permission_overrides')
      .select('*')
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq('action', action)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false })
      .limit(1)

    return overrides?.[0] || null
  }

  /**
   * Check ownership constraints for non-admin users
   */
  private checkOwnershipConstraints(
    context: UserContext,
    ownership: EntityOwnership
  ): PermissionCheckResult {
    const { user, assignedLocations, teamMembers } = context

    // Check location access
    if (ownership.locationId) {
      // Admins have access to all locations
      if (user.role === 'admin') {
        return { allowed: true }
      }

      // Check if user has access to this location
      if (!assignedLocations.includes(ownership.locationId)) {
        return {
          allowed: false,
          reason: 'User does not have access to this location',
        }
      }
    }

    // For agents, check if they are assigned to the record
    if (user.role === 'agent' && ownership.assignedTo) {
      // Agent can only access their own records or unassigned records
      const isOwnRecord = ownership.assignedTo === user.ghl_user_id
      const isUnassigned = !ownership.assignedTo

      if (!isOwnRecord && !isUnassigned) {
        return {
          allowed: false,
          reason: 'Agent can only access records assigned to them',
        }
      }
    }

    // For managers, check if the assignee is in their team
    if (user.role === 'manager' && ownership.assignedTo) {
      const isOwnRecord = ownership.assignedTo === user.ghl_user_id
      const isTeamRecord = teamMembers.includes(ownership.assignedTo)
      const isUnassigned = !ownership.assignedTo

      if (!isOwnRecord && !isTeamRecord && !isUnassigned) {
        return {
          allowed: false,
          reason: 'Manager can only access records from their team',
        }
      }
    }

    return { allowed: true }
  }

  /**
   * Build permission matrix with overrides applied
   */
  private buildPermissionMatrix(
    role: UserRole,
    overrides: PermissionOverride[]
  ): PermissionMatrix {
    // Start with role defaults
    const matrix = { ...ROLE_PERMISSIONS[role] }

    // Apply overrides
    for (const override of overrides) {
      const entityType = override.entity_type as GHLEntityType
      if (matrix[entityType]) {
        matrix[entityType] = {
          ...matrix[entityType],
          [override.action]: override.is_allowed,
        }
      }
    }

    return matrix
  }

  /**
   * Get all locations accessible to a user
   */
  async getAccessibleLocations(userId: string): Promise<string[]> {
    const context = await this.getUserContext(userId)
    if (!context) return []

    // Admins get all tenant locations
    if (context.user.role === 'admin') {
      const { data: locations } = await this.supabase
        .from('ghl_locations')
        .select('id')
        .eq('tenant_id', context.tenant.id)

      return locations?.map(l => l.id) || []
    }

    return context.assignedLocations
  }

  /**
   * Filter query results based on user's access
   */
  applyRBACFilter<T extends { location_id?: string; assigned_to?: string }>(
    query: any, // Supabase query builder
    context: UserContext
  ): any {
    const { user, assignedLocations, teamMembers } = context

    // Admins see everything in their tenant
    if (user.role === 'admin') {
      return query.eq('tenant_id', context.tenant.id)
    }

    // Managers see their locations + their team's records
    if (user.role === 'manager') {
      if (assignedLocations.length > 0) {
        query = query.in('location_id', assignedLocations)
      }
      // Also include records from team members
      if (teamMembers.length > 0) {
        query = query.or(
          `assigned_to.in.(${[user.ghl_user_id, ...teamMembers].join(',')}),assigned_to.is.null`
        )
      }
      return query
    }

    // Agents see only their assigned locations and records
    if (user.role === 'agent') {
      if (assignedLocations.length > 0) {
        query = query.in('location_id', assignedLocations)
      }
      // Only their records or unassigned
      if (user.ghl_user_id) {
        query = query.or(`assigned_to.eq.${user.ghl_user_id},assigned_to.is.null`)
      }
      return query
    }

    return query
  }
}

/**
 * Create a new permission service instance
 */
export function createPermissionService(
  supabase: SupabaseClient<any>
): PermissionService {
  return new PermissionService(supabase)
}

/**
 * Quick permission check utility
 */
export async function canAccess(
  supabase: SupabaseClient<any>,
  userId: string,
  entityType: GHLEntityType,
  action: PermissionAction,
  ownership?: EntityOwnership
): Promise<boolean> {
  const service = createPermissionService(supabase)
  const result = await service.checkPermission(userId, entityType, action, ownership)
  return result.allowed
}
