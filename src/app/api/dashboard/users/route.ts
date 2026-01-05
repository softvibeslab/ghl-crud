/**
 * Dashboard Users API
 * GET /api/dashboard/users - List users (Admin/Manager)
 * POST /api/dashboard/users - Create user (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  requireAuth,
  requireRole,
  createUserService,
  type UserContext,
} from '@/lib/rbac'

/**
 * GET /api/dashboard/users
 * List all dashboard users (filtered by role)
 */
export async function GET(request: NextRequest) {
  // Check authentication and role
  const authResult = await requireRole(request, ['admin', 'manager'])
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult
  const { searchParams } = new URL(request.url)

  try {
    const supabase = await createClient()
    const userService = createUserService(supabase)

    // Parse query parameters
    const filters = {
      tenantId: context.tenant.id,
      role: searchParams.get('role') as any || undefined,
      isActive: searchParams.get('isActive')
        ? searchParams.get('isActive') === 'true'
        : undefined,
      locationId: searchParams.get('locationId') || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    }

    // Managers can only see agents in their team
    if (context.user.role === 'manager') {
      const teamMembers = await userService.getTeamMembers(context.user.id)
      const teamIds = teamMembers.map(m => m.id)

      // Return only team members
      const { users, total, hasMore } = await userService.listUsers({
        ...filters,
        role: 'agent', // Managers can only see agents
      })

      const filteredUsers = users.filter(u => teamIds.includes(u.id))

      return NextResponse.json({
        users: filteredUsers,
        total: filteredUsers.length,
        hasMore: false,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
        },
      })
    }

    // Admins see all users
    const result = await userService.listUsers(filters)

    return NextResponse.json({
      users: result.users,
      total: result.total,
      hasMore: result.hasMore,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
      },
    })
  } catch (error) {
    console.error('Error listing users:', error)
    return NextResponse.json(
      { error: 'Failed to list users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dashboard/users
 * Create a new dashboard user (Admin only)
 */
export async function POST(request: NextRequest) {
  // Check authentication - admin only
  const authResult = await requireRole(request, 'admin')
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { context } = authResult

  try {
    const body = await request.json()
    const { email, fullName, role, supabaseUserId, ghlUserId, locationIds, avatarUrl } = body

    // Validate required fields
    if (!email || !fullName || !role || !supabaseUserId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, fullName, role, supabaseUserId' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['admin', 'manager', 'agent'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, manager, or agent' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const userService = createUserService(supabase)

    // Check if user already exists
    const existing = await userService.getUserByEmail(email, context.tenant.id)
    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists in this tenant' },
        { status: 409 }
      )
    }

    // Create user
    const user = await userService.createUser({
      email,
      fullName,
      role,
      tenantId: context.tenant.id,
      supabaseUserId,
      ghlUserId,
      locationIds,
      avatarUrl,
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
