/**
 * RBAC Module
 * Exports all RBAC-related services and utilities
 */

// Permission Service
export {
  PermissionService,
  createPermissionService,
  canAccess,
  ROLE_PERMISSIONS,
} from './permissions.service'

// Middleware
export {
  getAuthContext,
  requireAuth,
  requireRole,
  requirePermission,
  withRBAC,
  adminOnly,
  managerOrAbove,
  hasRole,
  checkPermission,
  getTenantId,
  getAccessibleLocationIds,
  canAccessLocation,
  canAccessRecord,
  filterByAccess,
  type AuthenticatedRequest,
  type MiddlewareOptions,
  type AuthResult,
} from './middleware'

// User Service
export {
  UserService,
  createUserService,
  type CreateUserOptions,
  type UpdateUserOptions,
  type UserListFilters,
  type UserListResult,
} from './user.service'

// Re-export types
export type {
  UserRole,
  UserContext,
  DashboardUser,
  DashboardUserInsert,
  DashboardUserUpdate,
  Tenant,
  TenantInsert,
  TenantUpdate,
  PermissionMatrix,
  EntityPermissions,
  PermissionOverride,
  PermissionCheckResult,
  GHLEntityType,
  EntityOwnership,
  PermissionAction,
  UserLocationAssignment,
  ManagerTeamAssignment,
} from '@/types/rbac'
