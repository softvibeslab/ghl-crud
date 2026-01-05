/**
 * Dashboard User Detail API
 * GET /api/dashboard/users/[id] - Get user details
 * PATCH /api/dashboard/users/[id] - Update user
 * DELETE /api/dashboard/users/[id] - Delete user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  requireAuth,
  requireRole,
  createUserService,
} from '@/lib/rbac'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/dashboard/users/[id]
 * Get user details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult
  const { id } = params

  try {
    const supabase = await createClient()
    const userService = createUserService(supabase)

    const user = await userService.getUserById(id)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check tenant access
    if (user.tenant_id !== context.tenant.id) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Managers can only see their team members or themselves
    if (context.user.role === 'manager') {
      const isSelf = user.id === context.user.id
      const isTeamMember = context.teamMembers.includes(user.id)

      if (!isSelf && !isTeamMember) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Agents can only see themselves
    if (context.user.role === 'agent' && user.id !== context.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get additional info
    const locations = await userService.getUserLocations(id)
    let teamMembers = null

    if (user.role === 'manager') {
      teamMembers = await userService.getTeamMembers(id)
    }

    return NextResponse.json({
      user,
      locations,
      teamMembers,
    })
  } catch (error) {
    console.error('Error getting user:', error)
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/dashboard/users/[id]
 * Update user (Admin or self for limited fields)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult
  const { id } = params

  try {
    const body = await request.json()
    const supabase = await createClient()
    const userService = createUserService(supabase)

    // Get target user
    const targetUser = await userService.getUserById(id)
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check tenant access
    if (targetUser.tenant_id !== context.tenant.id) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const isSelf = id === context.user.id
    const isAdmin = context.user.role === 'admin'

    // Non-admins can only update themselves with limited fields
    if (!isAdmin && !isSelf) {
      return NextResponse.json(
        { error: 'Only admins can update other users' },
        { status: 403 }
      )
    }

    // Define allowed fields based on role
    const updates: any = {}

    // All users can update these for themselves
    if (isSelf) {
      if (body.fullName) updates.fullName = body.fullName
      if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl
      if (body.settings) updates.settings = body.settings
    }

    // Only admins can update these
    if (isAdmin) {
      if (body.fullName) updates.fullName = body.fullName
      if (body.role) updates.role = body.role
      if (body.ghlUserId !== undefined) updates.ghlUserId = body.ghlUserId
      if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl
      if (body.isActive !== undefined) updates.isActive = body.isActive
      if (body.settings) updates.settings = body.settings

      // Handle location assignments
      if (body.locationIds) {
        // Remove all current assignments
        const currentLocations = await userService.getUserLocations(id)
        const currentIds = currentLocations.map(l => l.location_id)

        // Remove locations not in new list
        const toRemove = currentIds.filter(l => !body.locationIds.includes(l))
        if (toRemove.length > 0) {
          await userService.removeLocations(id, toRemove)
        }

        // Add new locations
        const toAdd = body.locationIds.filter((l: string) => !currentIds.includes(l))
        if (toAdd.length > 0) {
          await userService.assignLocations(id, toAdd, context.user.id)
        }
      }

      // Handle team assignments (for managers)
      if (body.teamMemberIds && targetUser.role === 'manager') {
        const currentTeam = await userService.getTeamMembers(id)
        const currentIds = currentTeam.map(m => m.id)

        // Remove members not in new list
        const toRemove = currentIds.filter(m => !body.teamMemberIds.includes(m))
        if (toRemove.length > 0) {
          await userService.removeTeamMembers(id, toRemove)
        }

        // Add new members
        const toAdd = body.teamMemberIds.filter((m: string) => !currentIds.includes(m))
        if (toAdd.length > 0) {
          await userService.assignTeamMembers(id, toAdd, context.user.id)
        }
      }
    }

    // Prevent role escalation
    if (body.role && !isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can change user roles' },
        { status: 403 }
      )
    }

    // Prevent self-demotion from admin
    if (isSelf && isAdmin && body.role && body.role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot demote yourself from admin' },
        { status: 400 }
      )
    }

    // Update user
    const updatedUser = await userService.updateUser(id, updates)

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dashboard/users/[id]
 * Delete user (Admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireRole(request, 'admin')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult
  const { id } = params

  try {
    const supabase = await createClient()
    const userService = createUserService(supabase)

    // Get target user
    const targetUser = await userService.getUserById(id)
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check tenant access
    if (targetUser.tenant_id !== context.tenant.id) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent self-deletion
    if (id === context.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 }
      )
    }

    // Soft delete (deactivate) by default
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    if (hardDelete) {
      await userService.deleteUser(id)
    } else {
      await userService.deactivateUser(id)
    }

    return NextResponse.json({
      success: true,
      action: hardDelete ? 'deleted' : 'deactivated',
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
