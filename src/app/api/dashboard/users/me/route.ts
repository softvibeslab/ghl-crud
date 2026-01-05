/**
 * Current User API
 * GET /api/dashboard/users/me - Get current user profile
 * PATCH /api/dashboard/users/me - Update current user profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  requireAuth,
  createUserService,
} from '@/lib/rbac'

/**
 * GET /api/dashboard/users/me
 * Get current authenticated user's profile
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const supabase = await createClient()
    const userService = createUserService(supabase)

    // Get location assignments
    const locations = await userService.getUserLocations(context.user.id)

    // Get team members if manager
    let teamMembers = null
    if (context.user.role === 'manager') {
      teamMembers = await userService.getTeamMembers(context.user.id)
    }

    // Get manager if agent
    let manager = null
    if (context.user.role === 'agent') {
      manager = await userService.getAgentManager(context.user.id)
    }

    return NextResponse.json({
      user: context.user,
      tenant: context.tenant,
      permissions: context.permissions,
      locations,
      teamMembers,
      manager,
      assignedLocationIds: context.assignedLocations,
    })
  } catch (error) {
    console.error('Error getting current user:', error)
    return NextResponse.json(
      { error: 'Failed to get user profile' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/dashboard/users/me
 * Update current user's profile (limited fields)
 */
export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const body = await request.json()
    const supabase = await createClient()
    const userService = createUserService(supabase)

    // Only allow updating certain fields
    const allowedUpdates: any = {}

    if (body.fullName) {
      allowedUpdates.fullName = body.fullName
    }

    if (body.avatarUrl !== undefined) {
      allowedUpdates.avatarUrl = body.avatarUrl
    }

    if (body.settings) {
      // Merge settings instead of replacing
      allowedUpdates.settings = {
        ...context.user.settings,
        ...body.settings,
      }
    }

    // Prevent changing role, email, or other sensitive fields
    if (body.role || body.email || body.tenantId || body.isActive !== undefined) {
      return NextResponse.json(
        { error: 'Cannot modify role, email, tenant, or active status' },
        { status: 400 }
      )
    }

    const updatedUser = await userService.updateUser(context.user.id, allowedUpdates)

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating current user:', error)
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    )
  }
}
