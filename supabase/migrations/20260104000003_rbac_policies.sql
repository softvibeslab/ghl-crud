-- RBAC Policies Migration
-- Phase 1: Foundation - Row Level Security with Role-Based Access
-- Created: 2026-01-04

-- ============================================
-- HELPER FUNCTIONS FOR RBAC
-- ============================================

-- Get current user's dashboard profile
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE (
    user_id UUID,
    tenant_id UUID,
    role TEXT,
    ghl_user_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        du.id as user_id,
        du.tenant_id,
        du.role,
        du.ghl_user_id
    FROM public.dashboard_users du
    WHERE du.auth_user_id = auth.uid()
    AND du.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM public.dashboard_users
        WHERE auth_user_id = auth.uid()
        AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id FROM public.dashboard_users
        WHERE auth_user_id = auth.uid()
        AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's dashboard_user_id
CREATE OR REPLACE FUNCTION public.get_current_dashboard_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM public.dashboard_users
        WHERE auth_user_id = auth.uid()
        AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's GHL user ID
CREATE OR REPLACE FUNCTION public.get_current_ghl_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT ghl_user_id FROM public.dashboard_users
        WHERE auth_user_id = auth.uid()
        AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has access to a specific location
CREATE OR REPLACE FUNCTION public.user_has_location_access(p_location_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role TEXT;
    v_user_id UUID;
BEGIN
    SELECT role, id INTO v_user_role, v_user_id
    FROM public.dashboard_users
    WHERE auth_user_id = auth.uid()
    AND is_active = true;

    -- No user found
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admin has access to all locations in their tenant
    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Manager/Agent check location assignments
    RETURN EXISTS (
        SELECT 1 FROM public.user_location_assignments
        WHERE user_id = v_user_id
        AND location_id = p_location_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user can access a record based on assignment
CREATE OR REPLACE FUNCTION public.user_can_access_record(
    p_assigned_to TEXT,
    p_location_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role TEXT;
    v_user_id UUID;
    v_ghl_user_id TEXT;
BEGIN
    SELECT role, id, ghl_user_id INTO v_user_role, v_user_id, v_ghl_user_id
    FROM public.dashboard_users
    WHERE auth_user_id = auth.uid()
    AND is_active = true;

    -- No user found
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admin has full access
    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Manager: check location OR team assignment
    IF v_user_role = 'manager' THEN
        RETURN (
            -- Location-based access
            EXISTS (
                SELECT 1 FROM public.user_location_assignments
                WHERE user_id = v_user_id
                AND location_id = p_location_id
            )
            OR
            -- Team-based access (records assigned to agents in manager's team)
            EXISTS (
                SELECT 1 FROM public.manager_team_assignments mta
                JOIN public.dashboard_users du ON du.id = mta.agent_id
                WHERE mta.manager_id = v_user_id
                AND du.ghl_user_id = p_assigned_to
            )
            OR
            -- Records assigned to the manager themselves
            p_assigned_to = v_ghl_user_id
            OR
            -- Unassigned records in accessible locations
            (p_assigned_to IS NULL AND EXISTS (
                SELECT 1 FROM public.user_location_assignments
                WHERE user_id = v_user_id
                AND location_id = p_location_id
            ))
        );
    END IF;

    -- Agent: only own records
    IF v_user_role = 'agent' THEN
        RETURN p_assigned_to = v_ghl_user_id;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'admin' FROM public.dashboard_users
        WHERE auth_user_id = auth.uid()
        AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- DROP EXISTING POLICIES ON GHL TABLES
-- ============================================

-- Contacts
DROP POLICY IF EXISTS "Users can view contacts" ON public.ghl_contacts;
DROP POLICY IF EXISTS "Users can manage contacts" ON public.ghl_contacts;

-- Opportunities
DROP POLICY IF EXISTS "Users can view opportunities" ON public.ghl_opportunities;
DROP POLICY IF EXISTS "Users can manage opportunities" ON public.ghl_opportunities;

-- Pipelines
DROP POLICY IF EXISTS "Users can view pipelines" ON public.ghl_pipelines;
DROP POLICY IF EXISTS "Users can manage pipelines" ON public.ghl_pipelines;

-- Pipeline Stages
DROP POLICY IF EXISTS "Users can view pipeline stages" ON public.ghl_pipeline_stages;
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON public.ghl_pipeline_stages;

-- Workflows
DROP POLICY IF EXISTS "Users can view workflows" ON public.ghl_workflows;
DROP POLICY IF EXISTS "Users can manage workflows" ON public.ghl_workflows;

-- Conversations
DROP POLICY IF EXISTS "Users can view conversations" ON public.ghl_conversations;
DROP POLICY IF EXISTS "Users can manage conversations" ON public.ghl_conversations;

-- Messages
DROP POLICY IF EXISTS "Users can view messages" ON public.ghl_messages;
DROP POLICY IF EXISTS "Users can manage messages" ON public.ghl_messages;

-- Calendars
DROP POLICY IF EXISTS "Users can view calendars" ON public.ghl_calendars;
DROP POLICY IF EXISTS "Users can manage calendars" ON public.ghl_calendars;

-- Appointments
DROP POLICY IF EXISTS "Users can view appointments" ON public.ghl_appointments;
DROP POLICY IF EXISTS "Users can manage appointments" ON public.ghl_appointments;

-- Invoices
DROP POLICY IF EXISTS "Users can view invoices" ON public.ghl_invoices;
DROP POLICY IF EXISTS "Users can manage invoices" ON public.ghl_invoices;

-- Products
DROP POLICY IF EXISTS "Users can view products" ON public.ghl_products;
DROP POLICY IF EXISTS "Users can manage products" ON public.ghl_products;

-- Users
DROP POLICY IF EXISTS "Users can view team users" ON public.ghl_users;
DROP POLICY IF EXISTS "Users can manage team users" ON public.ghl_users;

-- Locations
DROP POLICY IF EXISTS "Users can view their location data" ON public.ghl_locations;
DROP POLICY IF EXISTS "Users can manage their location data" ON public.ghl_locations;

-- Sync Log
DROP POLICY IF EXISTS "Users can view sync log" ON public.ghl_sync_log;
DROP POLICY IF EXISTS "Users can manage sync log" ON public.ghl_sync_log;

-- ============================================
-- NEW RBAC POLICIES: CONTACTS
-- ============================================

CREATE POLICY "contacts_select" ON public.ghl_contacts
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_can_access_record(assigned_to, location_id)
    );

CREATE POLICY "contacts_insert" ON public.ghl_contacts
    FOR INSERT WITH CHECK (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "contacts_update" ON public.ghl_contacts
    FOR UPDATE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_can_access_record(assigned_to, location_id)
    );

CREATE POLICY "contacts_delete" ON public.ghl_contacts
    FOR DELETE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- ============================================
-- NEW RBAC POLICIES: OPPORTUNITIES
-- ============================================

CREATE POLICY "opportunities_select" ON public.ghl_opportunities
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_can_access_record(assigned_to, location_id)
    );

CREATE POLICY "opportunities_insert" ON public.ghl_opportunities
    FOR INSERT WITH CHECK (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "opportunities_update" ON public.ghl_opportunities
    FOR UPDATE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_can_access_record(assigned_to, location_id)
    );

CREATE POLICY "opportunities_delete" ON public.ghl_opportunities
    FOR DELETE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- ============================================
-- NEW RBAC POLICIES: APPOINTMENTS
-- ============================================

CREATE POLICY "appointments_select" ON public.ghl_appointments
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_can_access_record(assigned_user_id, location_id)
    );

CREATE POLICY "appointments_insert" ON public.ghl_appointments
    FOR INSERT WITH CHECK (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "appointments_update" ON public.ghl_appointments
    FOR UPDATE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_can_access_record(assigned_user_id, location_id)
    );

CREATE POLICY "appointments_delete" ON public.ghl_appointments
    FOR DELETE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- ============================================
-- NEW RBAC POLICIES: CONVERSATIONS
-- ============================================

CREATE POLICY "conversations_select" ON public.ghl_conversations
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_can_access_record(assigned_to, location_id)
    );

CREATE POLICY "conversations_insert" ON public.ghl_conversations
    FOR INSERT WITH CHECK (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "conversations_update" ON public.ghl_conversations
    FOR UPDATE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_can_access_record(assigned_to, location_id)
    );

CREATE POLICY "conversations_delete" ON public.ghl_conversations
    FOR DELETE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- ============================================
-- NEW RBAC POLICIES: MESSAGES
-- ============================================

CREATE POLICY "messages_select" ON public.ghl_messages
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.ghl_conversations c
            WHERE c.id = ghl_messages.conversation_id
            AND public.user_can_access_record(c.assigned_to, c.location_id)
        )
    );

CREATE POLICY "messages_insert" ON public.ghl_messages
    FOR INSERT WITH CHECK (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "messages_update" ON public.ghl_messages
    FOR UPDATE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

CREATE POLICY "messages_delete" ON public.ghl_messages
    FOR DELETE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- ============================================
-- NEW RBAC POLICIES: INVOICES
-- ============================================

CREATE POLICY "invoices_select" ON public.ghl_invoices
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND (
            public.get_current_user_role() IN ('admin', 'manager')
            OR EXISTS (
                SELECT 1 FROM public.ghl_contacts c
                WHERE c.id = ghl_invoices.contact_id
                AND c.assigned_to = public.get_current_ghl_user_id()
            )
        )
    );

CREATE POLICY "invoices_insert" ON public.ghl_invoices
    FOR INSERT WITH CHECK (
        tenant_id = public.get_current_tenant_id()
        AND public.get_current_user_role() IN ('admin', 'manager')
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "invoices_update" ON public.ghl_invoices
    FOR UPDATE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.get_current_user_role() IN ('admin', 'manager')
    );

CREATE POLICY "invoices_delete" ON public.ghl_invoices
    FOR DELETE USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- ============================================
-- NEW RBAC POLICIES: READ-ONLY ENTITIES
-- (Pipelines, Pipeline Stages, Workflows, Calendars, Products)
-- ============================================

-- Locations: Tenant + location access
CREATE POLICY "locations_select" ON public.ghl_locations
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(id)
    );

CREATE POLICY "locations_manage" ON public.ghl_locations
    FOR ALL USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- Pipelines: Read for all, write for admin
CREATE POLICY "pipelines_select" ON public.ghl_pipelines
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "pipelines_manage" ON public.ghl_pipelines
    FOR ALL USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- Pipeline Stages: Read for all, write for admin
CREATE POLICY "pipeline_stages_select" ON public.ghl_pipeline_stages
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "pipeline_stages_manage" ON public.ghl_pipeline_stages
    FOR ALL USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- Workflows: Read for all, write for admin
CREATE POLICY "workflows_select" ON public.ghl_workflows
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "workflows_manage" ON public.ghl_workflows
    FOR ALL USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- Calendars: Read for all with location access, write for admin
CREATE POLICY "calendars_select" ON public.ghl_calendars
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "calendars_manage" ON public.ghl_calendars
    FOR ALL USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- Products: Read for all, write for admin
CREATE POLICY "products_select" ON public.ghl_products
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.user_has_location_access(location_id)
    );

CREATE POLICY "products_manage" ON public.ghl_products
    FOR ALL USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- GHL Users: Read for all, write for admin
CREATE POLICY "ghl_users_select" ON public.ghl_users
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND (
            public.get_current_user_role() IN ('admin', 'manager')
            OR id = public.get_current_ghl_user_id()
        )
    );

CREATE POLICY "ghl_users_manage" ON public.ghl_users
    FOR ALL USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- Sync Log: Admin only
CREATE POLICY "sync_log_select" ON public.ghl_sync_log
    FOR SELECT USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

CREATE POLICY "sync_log_manage" ON public.ghl_sync_log
    FOR ALL USING (
        tenant_id = public.get_current_tenant_id()
        AND public.is_current_user_admin()
    );

-- ============================================
-- SERVICE ROLE BYPASS FOR SYNC OPERATIONS
-- ============================================
-- Note: The service role (used by webhooks/sync) bypasses RLS automatically.
-- This is by design - sync operations need full access to write data.
