-- RBAC Schema Migration
-- Phase 1: Foundation - Role-Based Access Control Tables
-- Created: 2026-01-04

-- ============================================
-- 1. TENANTS TABLE (Multi-tenant Support)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    ghl_agency_id TEXT,
    api_mode TEXT DEFAULT 'oauth' CHECK (api_mode IN ('agency', 'location', 'oauth')),
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_agency ON public.tenants(ghl_agency_id);
CREATE INDEX idx_tenants_active ON public.tenants(is_active) WHERE is_active = true;

COMMENT ON TABLE public.tenants IS 'Multi-tenant organizations using the dashboard';
COMMENT ON COLUMN public.tenants.api_mode IS 'GHL API authentication mode: agency, location, or oauth';

-- ============================================
-- 2. DASHBOARD USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dashboard_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ghl_user_id TEXT,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'agent')),
    avatar_url TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    preferences JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_dashboard_users_tenant ON public.dashboard_users(tenant_id);
CREATE INDEX idx_dashboard_users_auth ON public.dashboard_users(auth_user_id);
CREATE INDEX idx_dashboard_users_role ON public.dashboard_users(role);
CREATE INDEX idx_dashboard_users_ghl ON public.dashboard_users(ghl_user_id);
CREATE INDEX idx_dashboard_users_email ON public.dashboard_users(email);
CREATE INDEX idx_dashboard_users_active ON public.dashboard_users(is_active) WHERE is_active = true;

COMMENT ON TABLE public.dashboard_users IS 'Dashboard users with role-based access control';
COMMENT ON COLUMN public.dashboard_users.role IS 'User role: admin (full access), manager (location/team access), agent (own data only)';

-- ============================================
-- 3. USER LOCATION ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_location_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.dashboard_users(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    access_level TEXT DEFAULT 'full' CHECK (access_level IN ('full', 'read_only')),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, location_id)
);

CREATE INDEX idx_user_locations_user ON public.user_location_assignments(user_id);
CREATE INDEX idx_user_locations_location ON public.user_location_assignments(location_id);
CREATE INDEX idx_user_locations_primary ON public.user_location_assignments(user_id) WHERE is_primary = true;

COMMENT ON TABLE public.user_location_assignments IS 'Assigns users to GHL locations they can access';
COMMENT ON COLUMN public.user_location_assignments.is_primary IS 'Primary location for the user (default context)';

-- ============================================
-- 4. MANAGER TEAM ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.manager_team_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    manager_id UUID NOT NULL REFERENCES public.dashboard_users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.dashboard_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(manager_id, agent_id),
    CHECK (manager_id != agent_id)
);

CREATE INDEX idx_manager_team_manager ON public.manager_team_assignments(manager_id);
CREATE INDEX idx_manager_team_agent ON public.manager_team_assignments(agent_id);

COMMENT ON TABLE public.manager_team_assignments IS 'Assigns agents to managers for team-based access control';

-- ============================================
-- 5. GHL OAUTH TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_oauth_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    location_id TEXT REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    company_id TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    user_type TEXT DEFAULT 'Location' CHECK (user_type IN ('Company', 'Location')),
    is_valid BOOLEAN DEFAULT true,
    last_refreshed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oauth_tokens_tenant ON public.ghl_oauth_tokens(tenant_id);
CREATE INDEX idx_oauth_tokens_location ON public.ghl_oauth_tokens(location_id);
CREATE INDEX idx_oauth_tokens_company ON public.ghl_oauth_tokens(company_id);
CREATE INDEX idx_oauth_tokens_expires ON public.ghl_oauth_tokens(expires_at);
CREATE INDEX idx_oauth_tokens_valid ON public.ghl_oauth_tokens(is_valid) WHERE is_valid = true;

COMMENT ON TABLE public.ghl_oauth_tokens IS 'GHL OAuth tokens for API access (tokens should be encrypted)';
COMMENT ON COLUMN public.ghl_oauth_tokens.user_type IS 'GHL OAuth user type: Company (agency) or Location';

-- ============================================
-- 6. PERMISSION OVERRIDES
-- ============================================
CREATE TABLE IF NOT EXISTS public.permission_overrides (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.dashboard_users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('create', 'read', 'update', 'delete', 'export', 'bulk')),
    is_granted BOOLEAN NOT NULL,
    reason TEXT,
    granted_by UUID REFERENCES public.dashboard_users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entity_type, permission)
);

CREATE INDEX idx_permission_overrides_user ON public.permission_overrides(user_id);
CREATE INDEX idx_permission_overrides_entity ON public.permission_overrides(entity_type);
CREATE INDEX idx_permission_overrides_active ON public.permission_overrides(expires_at)
    WHERE expires_at IS NULL OR expires_at > NOW();

COMMENT ON TABLE public.permission_overrides IS 'Override default role permissions for specific users';

-- ============================================
-- 7. SYNC STATUS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sync_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    last_webhook_at TIMESTAMPTZ,
    last_poll_at TIMESTAMPTZ,
    last_full_sync_at TIMESTAMPTZ,
    next_poll_at TIMESTAMPTZ,
    records_synced INTEGER DEFAULT 0,
    records_pending INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    last_error TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'healthy', 'degraded', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, location_id, entity_type)
);

CREATE INDEX idx_sync_status_tenant ON public.sync_status(tenant_id);
CREATE INDEX idx_sync_status_location ON public.sync_status(location_id);
CREATE INDEX idx_sync_status_entity ON public.sync_status(entity_type);
CREATE INDEX idx_sync_status_status ON public.sync_status(status);
CREATE INDEX idx_sync_status_next_poll ON public.sync_status(next_poll_at) WHERE status != 'error';

COMMENT ON TABLE public.sync_status IS 'Tracks synchronization status per location and entity type';

-- ============================================
-- 8. WEBHOOK EVENTS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    location_id TEXT,
    event_type TEXT NOT NULL,
    event_id TEXT,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_tenant ON public.webhook_events(tenant_id);
CREATE INDEX idx_webhook_events_location ON public.webhook_events(location_id);
CREATE INDEX idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed) WHERE processed = false;
CREATE INDEX idx_webhook_events_created ON public.webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_idempotency ON public.webhook_events(event_id, location_id);

COMMENT ON TABLE public.webhook_events IS 'Log of incoming GHL webhook events for processing and audit';

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp triggers
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dashboard_users_updated_at
    BEFORE UPDATE ON public.dashboard_users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_location_assignments_updated_at
    BEFORE UPDATE ON public.user_location_assignments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_oauth_tokens_updated_at
    BEFORE UPDATE ON public.ghl_oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_permission_overrides_updated_at
    BEFORE UPDATE ON public.permission_overrides
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at
    BEFORE UPDATE ON public.sync_status
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BASIC RLS POLICIES (to be enhanced in next migration)
-- ============================================

-- Tenants: Users can only see their own tenant
CREATE POLICY "tenant_isolation" ON public.tenants
    FOR ALL USING (
        id IN (
            SELECT tenant_id FROM public.dashboard_users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Dashboard users: Users can see users in their tenant
CREATE POLICY "users_tenant_isolation" ON public.dashboard_users
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM public.dashboard_users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Dashboard users: Only admins can manage users
CREATE POLICY "users_admin_manage" ON public.dashboard_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.dashboard_users
            WHERE auth_user_id = auth.uid() AND role = 'admin'
        )
    );

-- OAuth tokens: Only admins can manage tokens
CREATE POLICY "oauth_tokens_admin_only" ON public.ghl_oauth_tokens
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.dashboard_users
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
            AND tenant_id = ghl_oauth_tokens.tenant_id
        )
    );

-- Sync status: Users can view sync status for their tenant
CREATE POLICY "sync_status_tenant_view" ON public.sync_status
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM public.dashboard_users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Webhook events: Admins can view webhook events
CREATE POLICY "webhook_events_admin_view" ON public.webhook_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.dashboard_users
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );
