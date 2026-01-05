/**
 * GHL OAuth Service
 * Handles OAuth 2.0 authentication flow for GoHighLevel Marketplace
 */

import { SupabaseClient } from '@supabase/supabase-js'

// Note: Using 'any' for Supabase client until migrations are applied and types regenerated
// After running migrations, regenerate types with: pnpm supabase gen types typescript --local

// OAuth Configuration
const GHL_OAUTH_CONFIG = {
  authorizationUrl: 'https://marketplace.gohighlevel.com/oauth/chooselocation',
  tokenUrl: 'https://services.leadconnectorhq.com/oauth/token',
  apiBaseUrl: 'https://services.leadconnectorhq.com',
  apiVersion: '2021-07-28',
}

// OAuth Scopes required for full CRM access
export const GHL_OAUTH_SCOPES = [
  'contacts.readonly',
  'contacts.write',
  'opportunities.readonly',
  'opportunities.write',
  'calendars.readonly',
  'calendars.write',
  'calendars/events.readonly',
  'calendars/events.write',
  'conversations.readonly',
  'conversations.write',
  'conversations/message.readonly',
  'conversations/message.write',
  'invoices.readonly',
  'invoices.write',
  'products.readonly',
  'products.write',
  'users.readonly',
  'users.write',
  'locations.readonly',
  'workflows.readonly',
] as const

export type GHLOAuthScope = (typeof GHL_OAUTH_SCOPES)[number]

// Token types
export interface GHLTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
  userType: 'Company' | 'Location'
  companyId?: string
  locationId?: string
}

export interface GHLOAuthToken {
  id: string
  tenantId: string
  locationId: string | null
  companyId: string | null
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresAt: Date
  scopes: string[]
  userType: 'Company' | 'Location'
  isValid: boolean
  lastRefreshedAt: Date | null
}

// Service implementation
export class GHLOAuthService {
  private supabase: SupabaseClient<any>
  private clientId: string
  private clientSecret: string
  private redirectUri: string

  constructor(supabase: SupabaseClient<any>) {
    this.supabase = supabase
    this.clientId = process.env.GHL_CLIENT_ID || ''
    this.clientSecret = process.env.GHL_CLIENT_SECRET || ''
    this.redirectUri = process.env.GHL_REDIRECT_URI || ''

    if (!this.clientId || !this.clientSecret) {
      console.warn('GHL OAuth credentials not configured')
    }
  }

  /**
   * Generate the OAuth authorization URL
   */
  getAuthorizationUrl(state: string, scopes: GHLOAuthScope[] = [...GHL_OAUTH_SCOPES]): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
    })

    return `${GHL_OAUTH_CONFIG.authorizationUrl}?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GHLTokenResponse> {
    const response = await fetch(GHL_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OAuth token exchange failed: ${error}`)
    }

    return response.json()
  }

  /**
   * Refresh an expired access token
   */
  async refreshAccessToken(refreshToken: string): Promise<GHLTokenResponse> {
    const response = await fetch(GHL_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OAuth token refresh failed: ${error}`)
    }

    return response.json()
  }

  /**
   * Store tokens in the database
   */
  async storeTokens(
    tenantId: string,
    tokenResponse: GHLTokenResponse
  ): Promise<GHLOAuthToken | null> {
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    const { data, error } = await this.supabase
      .from('ghl_oauth_tokens')
      .upsert(
        {
          tenant_id: tenantId,
          location_id: tokenResponse.locationId || null,
          company_id: tokenResponse.companyId || null,
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
          token_type: tokenResponse.token_type,
          expires_at: expiresAt.toISOString(),
          scopes: tokenResponse.scope.split(' '),
          user_type: tokenResponse.userType,
          is_valid: true,
          last_refreshed_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,location_id',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Failed to store OAuth tokens:', error)
      return null
    }

    return this.mapToGHLOAuthToken(data)
  }

  /**
   * Get valid token for a location (auto-refresh if needed)
   */
  async getValidToken(
    tenantId: string,
    locationId?: string
  ): Promise<GHLOAuthToken | null> {
    // Query for token
    let query = this.supabase
      .from('ghl_oauth_tokens')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_valid', true)

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query.single()

    if (error || !data) {
      console.error('No valid token found:', error)
      return null
    }

    const token = this.mapToGHLOAuthToken(data)

    // Check if token is expired or about to expire (within 5 minutes)
    const expirationBuffer = 5 * 60 * 1000 // 5 minutes
    if (token.expiresAt.getTime() - Date.now() < expirationBuffer) {
      // Refresh the token
      try {
        const newTokenResponse = await this.refreshAccessToken(token.refreshToken)
        const updatedToken = await this.storeTokens(tenantId, newTokenResponse)
        return updatedToken
      } catch (error) {
        console.error('Failed to refresh token:', error)
        // Mark token as invalid
        await this.invalidateToken(token.id)
        return null
      }
    }

    return token
  }

  /**
   * Invalidate a token (mark as invalid in database)
   */
  async invalidateToken(tokenId: string): Promise<void> {
    await this.supabase
      .from('ghl_oauth_tokens')
      .update({ is_valid: false })
      .eq('id', tokenId)
  }

  /**
   * Revoke tokens for a location
   */
  async revokeTokens(tenantId: string, locationId?: string): Promise<void> {
    let query = this.supabase
      .from('ghl_oauth_tokens')
      .delete()
      .eq('tenant_id', tenantId)

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    await query
  }

  /**
   * Get all tokens for a tenant
   */
  async getTokensForTenant(tenantId: string): Promise<GHLOAuthToken[]> {
    const { data, error } = await this.supabase
      .from('ghl_oauth_tokens')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to get tokens:', error)
      return []
    }

    return data.map(this.mapToGHLOAuthToken)
  }

  /**
   * Check if a location is connected
   */
  async isLocationConnected(tenantId: string, locationId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('ghl_oauth_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('location_id', locationId)
      .eq('is_valid', true)

    return !error && (count ?? 0) > 0
  }

  // Private helper to map database row to typed object
  private mapToGHLOAuthToken(row: Record<string, unknown>): GHLOAuthToken {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      locationId: row.location_id as string | null,
      companyId: row.company_id as string | null,
      accessToken: row.access_token as string,
      refreshToken: row.refresh_token as string,
      tokenType: row.token_type as string,
      expiresAt: new Date(row.expires_at as string),
      scopes: row.scopes as string[],
      userType: row.user_type as 'Company' | 'Location',
      isValid: row.is_valid as boolean,
      lastRefreshedAt: row.last_refreshed_at
        ? new Date(row.last_refreshed_at as string)
        : null,
    }
  }
}

// Factory function
export function createOAuthService(supabase: SupabaseClient<any>): GHLOAuthService {
  return new GHLOAuthService(supabase)
}
