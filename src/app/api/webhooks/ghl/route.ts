/**
 * GHL Webhook Receiver Endpoint
 * POST /api/webhooks/ghl
 *
 * Receives and processes webhook events from GoHighLevel
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createWebhookHandler, type GHLWebhookEvent } from '@/lib/ghl/webhook-handler'
import type { Database } from '@/types/database'

// Use service role for webhook processing (bypasses RLS)
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('X-GHL-Signature') || ''

    // Parse payload
    let payload: GHLWebhookEvent
    try {
      payload = JSON.parse(rawBody)
    } catch {
      console.error('Invalid JSON payload')
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!payload.type || !payload.locationId) {
      console.error('Missing required fields: type or locationId')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create webhook handler
    const handler = createWebhookHandler(supabaseAdmin)

    // Verify signature (if configured)
    if (process.env.GHL_WEBHOOK_SECRET) {
      const isValid = handler.verifySignature(rawBody, signature)
      if (!isValid) {
        console.error('Invalid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    // Process the event
    const result = await handler.processEvent(payload)

    // Log processing time
    const duration = Date.now() - startTime
    console.log(
      `Webhook processed: ${payload.type} for ${payload.locationId} in ${duration}ms`,
      result
    )

    // Return success (GHL expects 200 OK quickly)
    return NextResponse.json({
      success: result.success,
      eventType: result.eventType,
      entityId: result.entityId,
      action: result.action,
      duration,
    })
  } catch (error) {
    console.error('Webhook processing error:', error)

    // Still return 200 to prevent retries for application errors
    // (retries should only happen for network/timeout issues)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/ghl',
    timestamp: new Date().toISOString(),
  })
}
