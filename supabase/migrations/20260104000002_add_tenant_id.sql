-- Add tenant_id to existing GHL tables
-- Phase 1: Foundation - Multi-tenant Support
-- Created: 2026-01-04

-- ============================================
-- ADD TENANT_ID TO ALL GHL TABLES
-- ============================================

-- 1. GHL Locations
ALTER TABLE public.ghl_locations
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_locations_tenant ON public.ghl_locations(tenant_id);

-- 2. GHL Pipelines
ALTER TABLE public.ghl_pipelines
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_pipelines_tenant ON public.ghl_pipelines(tenant_id);

-- 3. GHL Pipeline Stages
ALTER TABLE public.ghl_pipeline_stages
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_pipeline_stages_tenant ON public.ghl_pipeline_stages(tenant_id);

-- 4. GHL Contacts
ALTER TABLE public.ghl_contacts
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_contacts_tenant ON public.ghl_contacts(tenant_id);

-- 5. GHL Opportunities
ALTER TABLE public.ghl_opportunities
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_opportunities_tenant ON public.ghl_opportunities(tenant_id);

-- 6. GHL Workflows
ALTER TABLE public.ghl_workflows
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_workflows_tenant ON public.ghl_workflows(tenant_id);

-- 7. GHL Conversations
ALTER TABLE public.ghl_conversations
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_conversations_tenant ON public.ghl_conversations(tenant_id);

-- 8. GHL Messages
ALTER TABLE public.ghl_messages
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_messages_tenant ON public.ghl_messages(tenant_id);

-- 9. GHL Calendars
ALTER TABLE public.ghl_calendars
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_calendars_tenant ON public.ghl_calendars(tenant_id);

-- 10. GHL Appointments
ALTER TABLE public.ghl_appointments
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_appointments_tenant ON public.ghl_appointments(tenant_id);

-- 11. GHL Invoices
ALTER TABLE public.ghl_invoices
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_invoices_tenant ON public.ghl_invoices(tenant_id);

-- 12. GHL Products
ALTER TABLE public.ghl_products
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_products_tenant ON public.ghl_products(tenant_id);

-- 13. GHL Users
ALTER TABLE public.ghl_users
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_users_tenant ON public.ghl_users(tenant_id);

-- 14. GHL Sync Log
ALTER TABLE public.ghl_sync_log
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ghl_sync_log_tenant ON public.ghl_sync_log(tenant_id);

-- ============================================
-- HELPER FUNCTION: Get tenant_id from location
-- ============================================
CREATE OR REPLACE FUNCTION public.get_tenant_id_from_location(p_location_id TEXT)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id FROM public.ghl_locations
        WHERE id = p_location_id
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_tenant_id_from_location IS 'Get tenant_id for a given GHL location_id';

-- ============================================
-- TRIGGER: Auto-set tenant_id from location
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set if tenant_id is NULL and location_id exists
    IF NEW.tenant_id IS NULL AND NEW.location_id IS NOT NULL THEN
        NEW.tenant_id := public.get_tenant_id_from_location(NEW.location_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply auto-set trigger to tables with location_id
CREATE TRIGGER auto_set_tenant_contacts BEFORE INSERT OR UPDATE ON public.ghl_contacts
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_opportunities BEFORE INSERT OR UPDATE ON public.ghl_opportunities
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_pipelines BEFORE INSERT OR UPDATE ON public.ghl_pipelines
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_stages BEFORE INSERT OR UPDATE ON public.ghl_pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_workflows BEFORE INSERT OR UPDATE ON public.ghl_workflows
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_conversations BEFORE INSERT OR UPDATE ON public.ghl_conversations
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_messages BEFORE INSERT OR UPDATE ON public.ghl_messages
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_calendars BEFORE INSERT OR UPDATE ON public.ghl_calendars
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_appointments BEFORE INSERT OR UPDATE ON public.ghl_appointments
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_invoices BEFORE INSERT OR UPDATE ON public.ghl_invoices
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_products BEFORE INSERT OR UPDATE ON public.ghl_products
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_users BEFORE INSERT OR UPDATE ON public.ghl_users
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER auto_set_tenant_sync_log BEFORE INSERT OR UPDATE ON public.ghl_sync_log
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();
