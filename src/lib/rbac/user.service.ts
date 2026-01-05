/**
 * User Management Service
 * Handles dashboard user CRUD operations with RBAC
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type {
  DashboardUser,
  DashboardUserInsert,
  DashboardUserUpdate,
  UserRole,
  UserContext,
  UserLocationAssignment,
  UserLocationAssignmentInsert,
  ManagerTeamAssignment,
  ManagerTeamAssignmentInsert,
  Tenant,
  TenantInsert,
  TenantUpdate,
} from '@/types/rbac'

// Note: Using 'any' for Supabase client until migrations are applied and types regenerated

// ============================================
// TYPES
// ============================================

export interface CreateUserOptions {
  email: string
  fullName: string
  role: UserRole
  tenantId: string
  supabaseUserId: string
  ghlUserId?: string
  locationIds?: string[]
  avatarUrl?: string
}

export interface UpdateUserOptions {
  fullName?: string
  role?: UserRole
  ghlUserId?: string
  avatarUrl?: string
  isActive?: boolean
  settings?: DashboardUser['settings']
}

export interface UserListFilters {
  tenantId: string
  role?: UserRole
  isActive?: boolean
  locationId?: string
  search?: string
  limit?: number
  offset?: number
}

export interface UserListResult {
  users: DashboardUser[]
  total: number
  hasMore: boolean
}

// ============================================
// USER SERVICE CLASS
// ============================================

export class UserService {
  constructor(private supabase: SupabaseClient<any>) {}

  // ========================================
  // USER CRUD OPERATIONS
  // ========================================

  /**
   * Create a new dashboard user
   */
  async createUser(options: CreateUserOptions): Promise<DashboardUser> {
    const {
      email,
      fullName,
      role,
      tenantId,
      supabaseUserId,
      ghlUserId,
      locationIds,
      avatarUrl,
    } = options

    // Create user record
    const { data: user, error } = await this.supabase
      .from('dashboard_users')
      .insert({
        email,
        full_name: fullName,
        role,
        tenant_id: tenantId,
        supabase_user_id: supabaseUserId,
        ghl_user_id: ghlUserId || null,
        avatar_url: avatarUrl || null,
        is_active: true,
        settings: {
          notifications: { email: true, push: true, sms: false },
          preferences: { theme: 'system', language: 'en' },
        },
      } as DashboardUserInsert)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`)
    }

    // Assign locations if provided
    if (locationIds && locationIds.length > 0) {
      await this.assignLocations(user.id, locationIds)
    }

    return user as DashboardUser
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<DashboardUser | null> {
    const { data, error } = await this.supabase
      .from('dashboard_users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get user: ${error.message}`)
    }

    return data as DashboardUser
  }

  /**
   * Get user by Supabase user ID
   */
  async getUserBySupabaseId(supabaseUserId: string): Promise<DashboardUser | null> {
    const { data, error } = await this.supabase
      .from('dashboard_users')
      .select('*')
      .eq('supabase_user_id', supabaseUserId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get user: ${error.message}`)
    }

    return data as DashboardUser
  }

  /**
   * Get user by email within tenant
   */
  async getUserByEmail(email: string, tenantId: string): Promise<DashboardUser | null> {
    const { data, error } = await this.supabase
      .from('dashboard_users')
      .select('*')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get user: ${error.message}`)
    }

    return data as DashboardUser
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: UpdateUserOptions): Promise<DashboardUser> {
    const updateData: DashboardUserUpdate = {}

    if (updates.fullName !== undefined) updateData.full_name = updates.fullName
    if (updates.role !== undefined) updateData.role = updates.role
    if (updates.ghlUserId !== undefined) updateData.ghl_user_id = updates.ghlUserId
    if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive
    if (updates.settings !== undefined) updateData.settings = updates.settings

    const { data, error } = await this.supabase
      .from('dashboard_users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`)
    }

    return data as DashboardUser
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('dashboard_users')
      .update({ is_active: false })
      .eq('id', userId)

    if (error) {
      throw new Error(`Failed to deactivate user: ${error.message}`)
    }
  }

  /**
   * Reactivate user
   */
  async reactivateUser(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('dashboard_users')
      .update({ is_active: true })
      .eq('id', userId)

    if (error) {
      throw new Error(`Failed to reactivate user: ${error.message}`)
    }
  }

  /**
   * Delete user permanently
   */
  async deleteUser(userId: string): Promise<void> {
    // Remove all assignments first
    await this.supabase
      .from('user_location_assignments')
      .delete()
      .eq('user_id', userId)

    await this.supabase
      .from('manager_team_assignments')
      .delete()
      .or(`manager_id.eq.${userId},agent_id.eq.${userId}`)

    // Delete user
    const { error } = await this.supabase
      .from('dashboard_users')
      .delete()
      .eq('id', userId)

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`)
    }
  }

  /**
   * List users with filters
   */
  async listUsers(filters: UserListFilters): Promise<UserListResult> {
    const {
      tenantId,
      role,
      isActive,
      locationId,
      search,
      limit = 50,
      offset = 0,
    } = filters

    let query = this.supabase
      .from('dashboard_users')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)

    if (role) {
      query = query.eq('role', role)
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive)
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    if (locationId) {
      // Get users assigned to this location
      const { data: assignments } = await this.supabase
        .from('user_location_assignments')
        .select('user_id')
        .eq('location_id', locationId)

      const userIds = assignments?.map(a => a.user_id) || []
      if (userIds.length > 0) {
        query = query.in('id', userIds)
      } else {
        // No users assigned to this location
        return { users: [], total: 0, hasMore: false }
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`)
    }

    return {
      users: data as DashboardUser[],
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
    }
  }

  // ========================================
  // LOCATION ASSIGNMENT OPERATIONS
  // ========================================

  /**
   * Assign user to locations
   */
  async assignLocations(
    userId: string,
    locationIds: string[],
    assignedBy?: string,
    permissions: { canView?: boolean; canEdit?: boolean; canDelete?: boolean } = {}
  ): Promise<void> {
    const assignments: UserLocationAssignmentInsert[] = locationIds.map(locationId => ({
      user_id: userId,
      location_id: locationId,
      can_view: permissions.canView ?? true,
      can_edit: permissions.canEdit ?? true,
      can_delete: permissions.canDelete ?? false,
      assigned_by: assignedBy || null,
    }))

    const { error } = await this.supabase
      .from('user_location_assignments')
      .upsert(assignments, {
        onConflict: 'user_id,location_id',
      })

    if (error) {
      throw new Error(`Failed to assign locations: ${error.message}`)
    }
  }

  /**
   * Remove user from locations
   */
  async removeLocations(userId: string, locationIds: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('user_location_assignments')
      .delete()
      .eq('user_id', userId)
      .in('location_id', locationIds)

    if (error) {
      throw new Error(`Failed to remove locations: ${error.message}`)
    }
  }

  /**
   * Get user's location assignments
   */
  async getUserLocations(userId: string): Promise<UserLocationAssignment[]> {
    const { data, error } = await this.supabase
      .from('user_location_assignments')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to get user locations: ${error.message}`)
    }

    return data as UserLocationAssignment[]
  }

  /**
   * Update location assignment permissions
   */
  async updateLocationPermissions(
    userId: string,
    locationId: string,
    permissions: { canView?: boolean; canEdit?: boolean; canDelete?: boolean }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('user_location_assignments')
      .update(permissions)
      .eq('user_id', userId)
      .eq('location_id', locationId)

    if (error) {
      throw new Error(`Failed to update location permissions: ${error.message}`)
    }
  }

  // ========================================
  // TEAM MANAGEMENT (MANAGER -> AGENTS)
  // ========================================

  /**
   * Assign agents to manager's team
   */
  async assignTeamMembers(
    managerId: string,
    agentIds: string[],
    assignedBy?: string
  ): Promise<void> {
    const assignments: ManagerTeamAssignmentInsert[] = agentIds.map(agentId => ({
      manager_id: managerId,
      agent_id: agentId,
      assigned_by: assignedBy || null,
    }))

    const { error } = await this.supabase
      .from('manager_team_assignments')
      .upsert(assignments, {
        onConflict: 'manager_id,agent_id',
      })

    if (error) {
      throw new Error(`Failed to assign team members: ${error.message}`)
    }
  }

  /**
   * Remove agents from manager's team
   */
  async removeTeamMembers(managerId: string, agentIds: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('manager_team_assignments')
      .delete()
      .eq('manager_id', managerId)
      .in('agent_id', agentIds)

    if (error) {
      throw new Error(`Failed to remove team members: ${error.message}`)
    }
  }

  /**
   * Get manager's team members
   */
  async getTeamMembers(managerId: string): Promise<DashboardUser[]> {
    const { data: assignments, error: assignError } = await this.supabase
      .from('manager_team_assignments')
      .select('agent_id')
      .eq('manager_id', managerId)

    if (assignError) {
      throw new Error(`Failed to get team assignments: ${assignError.message}`)
    }

    if (!assignments || assignments.length === 0) {
      return []
    }

    const agentIds = assignments.map(a => a.agent_id)

    const { data: users, error } = await this.supabase
      .from('dashboard_users')
      .select('*')
      .in('id', agentIds)
      .eq('is_active', true)

    if (error) {
      throw new Error(`Failed to get team members: ${error.message}`)
    }

    return users as DashboardUser[]
  }

  /**
   * Get agent's manager
   */
  async getAgentManager(agentId: string): Promise<DashboardUser | null> {
    const { data: assignment, error: assignError } = await this.supabase
      .from('manager_team_assignments')
      .select('manager_id')
      .eq('agent_id', agentId)
      .single()

    if (assignError) {
      if (assignError.code === 'PGRST116') return null
      throw new Error(`Failed to get manager assignment: ${assignError.message}`)
    }

    return this.getUserById(assignment.manager_id)
  }

  // ========================================
  // TENANT OPERATIONS
  // ========================================

  /**
   * Create a new tenant
   */
  async createTenant(data: {
    name: string
    slug: string
    subscriptionTier?: string
  }): Promise<Tenant> {
    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .insert({
        name: data.name,
        slug: data.slug,
        subscription_tier: data.subscriptionTier || 'free',
        status: 'active',
        settings: {
          features: {
            multiLocation: true,
            advancedReporting: false,
            webhookIntegration: true,
            apiAccess: true,
          },
        },
      } as TenantInsert)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create tenant: ${error.message}`)
    }

    return tenant as Tenant
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get tenant: ${error.message}`)
    }

    return data as Tenant
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get tenant: ${error.message}`)
    }

    return data as Tenant
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, updates: TenantUpdate): Promise<Tenant> {
    const { data, error } = await this.supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update tenant: ${error.message}`)
    }

    return data as Tenant
  }
}

/**
 * Create a new user service instance
 */
export function createUserService(supabase: SupabaseClient<any>): UserService {
  return new UserService(supabase)
}
