/**
 * GHL OAuth Callback Endpoint
 * GET /api/auth/ghl/callback
 *
 * Handles OAuth callback from GoHighLevel Marketplace
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOAuthService } from '@/lib/ghl/oauth.service'
import { createSyncService } from '@/lib/ghl/sync.service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Get OAuth parameters
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=${encodeURIComponent(errorDescription || error)}`,
        request.url
      )
    )
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=missing_code', request.url)
    )
  }

  try {
    // Get current user's tenant from state
    // State format: tenantId:randomNonce
    const [tenantId] = (state || '').split(':')
    if (!tenantId) {
      throw new Error('Invalid state parameter')
    }

    // Create Supabase client
    const supabase = await createClient()

    // Verify user has access to this tenant
    const { data: user, error: userError } = await supabase
      .from('dashboard_users')
      .select('id, tenant_id, role')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
      .single()

    if (userError || !user) {
      throw new Error('Unauthorized access to tenant')
    }

    // Only admins can connect OAuth
    if (user.role !== 'admin') {
      throw new Error('Only admins can connect GHL integrations')
    }

    // Exchange code for tokens
    const oauthService = createOAuthService(supabase)
    const tokenResponse = await oauthService.exchangeCodeForTokens(code)

    // Store tokens
    const storedToken = await oauthService.storeTokens(tenantId, tokenResponse)

    if (!storedToken) {
      throw new Error('Failed to store OAuth tokens')
    }

    // If this is a location-level token, trigger initial sync
    if (tokenResponse.locationId) {
      const syncService = createSyncService(supabase)

      // Start initial sync in the background
      // Don't await - let it run asynchronously
      syncService
        .initialSync(tenantId, tokenResponse.locationId)
        .then((results) => {
          console.log('Initial sync completed:', results)
        })
        .catch((error) => {
          console.error('Initial sync failed:', error)
        })
    }

    // Redirect to success page
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?success=connected&location=${tokenResponse.locationId || 'company'}`,
        request.url
      )
    )
  } catch (error) {
    console.error('OAuth callback error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    )
  }
}
