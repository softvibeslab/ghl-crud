/**
 * GHL OAuth Initiation Endpoint
 * GET /api/auth/ghl
 *
 * Initiates OAuth flow with GoHighLevel Marketplace
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOAuthService, GHL_OAUTH_SCOPES } from '@/lib/ghl/oauth.service'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenant_id')

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id is required' },
      { status: 400 }
    )
  }

  try {
    // Create Supabase client
    const supabase = await createClient()

    // Verify user has access to this tenant and is admin
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: user, error: userError } = await supabase
      .from('dashboard_users')
      .select('id, tenant_id, role')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', authUser.user.id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized access to tenant' },
        { status: 403 }
      )
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can initiate OAuth connections' },
        { status: 403 }
      )
    }

    // Generate state parameter (tenantId + nonce for CSRF protection)
    const nonce = crypto.randomBytes(16).toString('hex')
    const state = `${tenantId}:${nonce}`

    // Store state in session for validation (optional, for extra security)
    // This could be stored in Redis or a temporary table

    // Generate authorization URL
    const oauthService = createOAuthService(supabase)
    const authUrl = oauthService.getAuthorizationUrl(state, [...GHL_OAUTH_SCOPES])

    // Redirect to GHL authorization page
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('OAuth initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/ghl
 *
 * Disconnect GHL integration for a location
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenant_id')
  const locationId = searchParams.get('location_id')

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id is required' },
      { status: 400 }
    )
  }

  try {
    const supabase = await createClient()

    // Verify admin access
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: user } = await supabase
      .from('dashboard_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', authUser.user.id)
      .single()

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can disconnect integrations' },
        { status: 403 }
      )
    }

    // Revoke tokens
    const oauthService = createOAuthService(supabase)
    await oauthService.revokeTokens(tenantId, locationId || undefined)

    return NextResponse.json({
      success: true,
      message: 'Integration disconnected successfully',
    })
  } catch (error) {
    console.error('OAuth revoke error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    )
  }
}
