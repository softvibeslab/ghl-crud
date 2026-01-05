/**
 * GHL API Client
 * Rate-limited client for GoHighLevel API with automatic token refresh
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { GHLOAuthService, createOAuthService } from './oauth.service'

// Note: Using 'any' for Supabase client until migrations are applied and types regenerated

// API Configuration
const GHL_API_CONFIG = {
  baseUrl: 'https://services.leadconnectorhq.com',
  version: '2021-07-28',
  rateLimitBurst: 100, // 100 requests per 10 seconds
  rateLimitWindow: 10000, // 10 seconds in ms
  dailyLimit: 200000, // 200k requests per day
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
}

// Rate limiter state (per location)
interface RateLimitState {
  requests: number[]
  dailyCount: number
  dailyResetAt: Date
}

// API Response types
export interface GHLApiResponse<T> {
  data: T | null
  error: string | null
  status: number
  rateLimitRemaining?: number
}

export interface GHLPaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    startAfter?: string
    startAfterId?: string
  }
}

// API Client class
export class GHLApiClient {
  private supabase: SupabaseClient<any>
  private oauthService: GHLOAuthService
  private tenantId: string
  private locationId?: string
  private rateLimitState: Map<string, RateLimitState> = new Map()

  // API key mode (alternative to OAuth)
  private apiKey?: string
  private useApiKey: boolean = false

  constructor(
    supabase: SupabaseClient<any>,
    tenantId: string,
    options?: {
      locationId?: string
      apiKey?: string
    }
  ) {
    this.supabase = supabase
    this.oauthService = createOAuthService(supabase)
    this.tenantId = tenantId
    this.locationId = options?.locationId

    if (options?.apiKey) {
      this.apiKey = options.apiKey
      this.useApiKey = true
    }
  }

  /**
   * Get authorization headers
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: GHL_API_CONFIG.version,
    }

    if (this.useApiKey && this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    } else {
      const token = await this.oauthService.getValidToken(this.tenantId, this.locationId)
      if (!token) {
        throw new Error('No valid OAuth token available')
      }
      headers['Authorization'] = `Bearer ${token.accessToken}`
    }

    return headers
  }

  /**
   * Check and update rate limit
   */
  private checkRateLimit(key: string): boolean {
    const now = Date.now()
    let state = this.rateLimitState.get(key)

    if (!state) {
      state = {
        requests: [],
        dailyCount: 0,
        dailyResetAt: new Date(now + 24 * 60 * 60 * 1000),
      }
      this.rateLimitState.set(key, state)
    }

    // Reset daily count if needed
    if (now > state.dailyResetAt.getTime()) {
      state.dailyCount = 0
      state.dailyResetAt = new Date(now + 24 * 60 * 60 * 1000)
    }

    // Check daily limit
    if (state.dailyCount >= GHL_API_CONFIG.dailyLimit) {
      return false
    }

    // Remove old requests from window
    state.requests = state.requests.filter(
      (timestamp) => now - timestamp < GHL_API_CONFIG.rateLimitWindow
    )

    // Check burst limit
    if (state.requests.length >= GHL_API_CONFIG.rateLimitBurst) {
      return false
    }

    // Add current request
    state.requests.push(now)
    state.dailyCount++

    return true
  }

  /**
   * Wait for rate limit to clear
   */
  private async waitForRateLimit(key: string): Promise<void> {
    const state = this.rateLimitState.get(key)
    if (!state || state.requests.length === 0) return

    const oldestRequest = Math.min(...state.requests)
    const waitTime = GHL_API_CONFIG.rateLimitWindow - (Date.now() - oldestRequest)

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }

  /**
   * Make an API request with rate limiting and retries
   */
  private async request<T>(
    method: string,
    endpoint: string,
    options?: {
      body?: Record<string, unknown>
      params?: Record<string, string>
    }
  ): Promise<GHLApiResponse<T>> {
    const rateLimitKey = this.locationId || this.tenantId

    // Check rate limit
    if (!this.checkRateLimit(rateLimitKey)) {
      await this.waitForRateLimit(rateLimitKey)
    }

    // Build URL
    let url = `${GHL_API_CONFIG.baseUrl}${endpoint}`
    if (options?.params) {
      const searchParams = new URLSearchParams(options.params)
      url += `?${searchParams.toString()}`
    }

    // Retry logic
    let lastError: Error | null = null
    for (let attempt = 0; attempt < GHL_API_CONFIG.retryAttempts; attempt++) {
      try {
        const headers = await this.getAuthHeaders()

        const fetchOptions: RequestInit = {
          method,
          headers,
        }

        if (options?.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
          fetchOptions.body = JSON.stringify(options.body)
        }

        const response = await fetch(url, fetchOptions)

        // Parse rate limit headers
        const rateLimitRemaining = parseInt(
          response.headers.get('X-RateLimit-Remaining') || '100',
          10
        )

        // Handle response
        if (response.ok) {
          const data = await response.json()
          return {
            data,
            error: null,
            status: response.status,
            rateLimitRemaining,
          }
        }

        // Handle errors
        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(response.headers.get('Retry-After') || '10', 10)
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
          continue
        }

        if (response.status === 401) {
          // Token expired - will be refreshed on next attempt
          continue
        }

        const errorText = await response.text()
        return {
          data: null,
          error: errorText,
          status: response.status,
          rateLimitRemaining,
        }
      } catch (error) {
        lastError = error as Error
        // Wait before retry
        await new Promise((resolve) =>
          setTimeout(resolve, GHL_API_CONFIG.retryDelay * (attempt + 1))
        )
      }
    }

    return {
      data: null,
      error: lastError?.message || 'Request failed after retries',
      status: 0,
    }
  }

  // ============================================
  // CONTACTS API
  // ============================================

  async getContacts(params: {
    locationId: string
    limit?: number
    skip?: number
    query?: string
    startAfter?: string
    startAfterId?: string
  }): Promise<GHLApiResponse<GHLPaginatedResponse<unknown>>> {
    return this.request('GET', '/contacts/', {
      params: {
        locationId: params.locationId,
        limit: String(params.limit || 20),
        skip: String(params.skip || 0),
        ...(params.query && { query: params.query }),
        ...(params.startAfter && { startAfter: params.startAfter }),
        ...(params.startAfterId && { startAfterId: params.startAfterId }),
      },
    })
  }

  async getContact(contactId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', `/contacts/${contactId}`)
  }

  async createContact(data: Record<string, unknown>): Promise<GHLApiResponse<unknown>> {
    return this.request('POST', '/contacts/', { body: data })
  }

  async updateContact(
    contactId: string,
    data: Record<string, unknown>
  ): Promise<GHLApiResponse<unknown>> {
    return this.request('PUT', `/contacts/${contactId}`, { body: data })
  }

  async deleteContact(contactId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('DELETE', `/contacts/${contactId}`)
  }

  // ============================================
  // OPPORTUNITIES API
  // ============================================

  async getOpportunities(params: {
    locationId: string
    pipelineId?: string
    stageId?: string
    status?: string
    limit?: number
    skip?: number
    startAfter?: string
    startAfterId?: string
  }): Promise<GHLApiResponse<GHLPaginatedResponse<unknown>>> {
    return this.request('GET', '/opportunities/search', {
      params: {
        location_id: params.locationId,
        ...(params.pipelineId && { pipeline_id: params.pipelineId }),
        ...(params.stageId && { pipeline_stage_id: params.stageId }),
        ...(params.status && { status: params.status }),
        limit: String(params.limit || 20),
        skip: String(params.skip || 0),
        ...(params.startAfter && { startAfter: params.startAfter }),
        ...(params.startAfterId && { startAfterId: params.startAfterId }),
      },
    })
  }

  async getOpportunity(opportunityId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', `/opportunities/${opportunityId}`)
  }

  async createOpportunity(data: Record<string, unknown>): Promise<GHLApiResponse<unknown>> {
    return this.request('POST', '/opportunities/', { body: data })
  }

  async updateOpportunity(
    opportunityId: string,
    data: Record<string, unknown>
  ): Promise<GHLApiResponse<unknown>> {
    return this.request('PUT', `/opportunities/${opportunityId}`, { body: data })
  }

  async updateOpportunityStatus(
    opportunityId: string,
    status: string
  ): Promise<GHLApiResponse<unknown>> {
    return this.request('PUT', `/opportunities/${opportunityId}/status`, {
      body: { status },
    })
  }

  async deleteOpportunity(opportunityId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('DELETE', `/opportunities/${opportunityId}`)
  }

  // ============================================
  // PIPELINES API
  // ============================================

  async getPipelines(locationId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', '/opportunities/pipelines', {
      params: { locationId },
    })
  }

  // ============================================
  // CALENDARS API
  // ============================================

  async getCalendars(locationId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', '/calendars/', {
      params: { locationId },
    })
  }

  async getCalendarEvents(params: {
    locationId: string
    calendarId?: string
    startDate?: string
    endDate?: string
    startTime?: string
    endTime?: string
  }): Promise<GHLApiResponse<unknown>> {
    const startDateValue = params.startDate || params.startTime
    const endDateValue = params.endDate || params.endTime
    return this.request('GET', '/calendars/events', {
      params: {
        locationId: params.locationId,
        ...(params.calendarId && { calendarId: params.calendarId }),
        ...(startDateValue && { startDate: startDateValue }),
        ...(endDateValue && { endDate: endDateValue }),
      },
    })
  }

  async createAppointment(data: Record<string, unknown>): Promise<GHLApiResponse<unknown>> {
    return this.request('POST', '/calendars/events/appointments', { body: data })
  }

  async updateAppointment(
    eventId: string,
    data: Record<string, unknown>
  ): Promise<GHLApiResponse<unknown>> {
    return this.request('PUT', `/calendars/events/appointments/${eventId}`, { body: data })
  }

  async deleteCalendarEvent(eventId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('DELETE', `/calendars/events/${eventId}`)
  }

  // ============================================
  // CONVERSATIONS API
  // ============================================

  async getConversations(params: {
    locationId: string
    contactId?: string
    limit?: number
    skip?: number
  }): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', '/conversations/', {
      params: {
        locationId: params.locationId,
        ...(params.contactId && { contactId: params.contactId }),
        limit: String(params.limit || 20),
        skip: String(params.skip || 0),
      },
    })
  }

  async getMessages(
    conversationId: string,
    params?: { limit?: number }
  ): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', `/conversations/${conversationId}/messages`, {
      params: {
        limit: String(params?.limit || 50),
      },
    })
  }

  async sendMessage(data: Record<string, unknown>): Promise<GHLApiResponse<unknown>> {
    return this.request('POST', '/conversations/messages', { body: data })
  }

  // ============================================
  // INVOICES API
  // ============================================

  async getInvoices(params: {
    locationId: string
    status?: string
    limit?: number
    skip?: number
  }): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', '/invoices/', {
      params: {
        altId: params.locationId,
        altType: 'location',
        ...(params.status && { status: params.status }),
        limit: String(params.limit || 20),
        skip: String(params.skip || 0),
      },
    })
  }

  async getInvoice(invoiceId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', `/invoices/${invoiceId}`)
  }

  async createInvoice(data: Record<string, unknown>): Promise<GHLApiResponse<unknown>> {
    return this.request('POST', '/invoices/', { body: data })
  }

  async updateInvoice(
    invoiceId: string,
    data: Record<string, unknown>
  ): Promise<GHLApiResponse<unknown>> {
    return this.request('PUT', `/invoices/${invoiceId}`, { body: data })
  }

  async sendInvoice(invoiceId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('POST', `/invoices/${invoiceId}/send`)
  }

  async voidInvoice(invoiceId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('POST', `/invoices/${invoiceId}/void`)
  }

  // ============================================
  // PRODUCTS API
  // ============================================

  async getProducts(locationId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', '/products/', {
      params: { locationId },
    })
  }

  async getProduct(productId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', `/products/${productId}`)
  }

  // ============================================
  // USERS API
  // ============================================

  async getUsers(locationId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', '/users/', {
      params: { locationId },
    })
  }

  async getUser(userId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', `/users/${userId}`)
  }

  // ============================================
  // LOCATIONS API
  // ============================================

  async getLocations(companyId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', '/locations/', {
      params: { companyId },
    })
  }

  async getLocation(locationId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', `/locations/${locationId}`)
  }

  // ============================================
  // WORKFLOWS API
  // ============================================

  async getWorkflows(locationId: string): Promise<GHLApiResponse<unknown>> {
    return this.request('GET', '/workflows/', {
      params: { locationId },
    })
  }
}

// Factory function
export function createGHLApiClient(
  supabase: SupabaseClient<any>,
  tenantId: string,
  options?: {
    locationId?: string
    apiKey?: string
  }
): GHLApiClient {
  return new GHLApiClient(supabase, tenantId, options)
}
