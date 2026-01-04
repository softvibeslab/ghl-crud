-- GHL CRUD Schema Migration
-- Based on GoHighLevel API V2 Architecture Document
-- Creates all master tables with RLS policies

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. GHL LOCATIONS (Root Entity)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    website TEXT,
    address_data JSONB DEFAULT '{}'::jsonb,
    timezone TEXT DEFAULT 'America/New_York',
    settings JSONB DEFAULT '{}'::jsonb,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_locations_name ON public.ghl_locations(name);
CREATE INDEX idx_locations_active ON public.ghl_locations(is_active);

-- ============================================
-- 2. GHL PIPELINES
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_pipelines (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    show_in_funnel BOOLEAN DEFAULT true,
    show_in_pie_chart BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipelines_location ON public.ghl_pipelines(location_id);

-- ============================================
-- 3. GHL PIPELINE STAGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_pipeline_stages (
    id TEXT NOT NULL,
    pipeline_id TEXT NOT NULL REFERENCES public.ghl_pipelines(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    probability DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (pipeline_id, id)
);

CREATE INDEX idx_stages_pipeline ON public.ghl_pipeline_stages(pipeline_id);
CREATE INDEX idx_stages_location ON public.ghl_pipeline_stages(location_id);

-- ============================================
-- 4. GHL CONTACTS (Core Entity)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_contacts (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    name TEXT GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED,
    email TEXT,
    phone TEXT,
    secondary_email TEXT,
    company_name TEXT,
    date_of_birth DATE,
    tags TEXT[] DEFAULT '{}',
    type TEXT DEFAULT 'lead',
    dnd BOOLEAN DEFAULT false,
    dnd_settings JSONB DEFAULT '{}'::jsonb,
    assigned_to TEXT,
    source TEXT,
    address_data JSONB DEFAULT '{}'::jsonb,
    custom_fields JSONB DEFAULT '[]'::jsonb,
    custom_attributes JSONB DEFAULT '{}'::jsonb,
    attribution_data JSONB DEFAULT '{}'::jsonb,
    date_added TIMESTAMPTZ DEFAULT NOW(),
    date_updated TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ,
    raw_data JSONB,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(first_name, '')), 'A') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(last_name, '')), 'A') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(email, '')), 'B') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(company_name, '')), 'C')
    ) STORED,
    is_deleted BOOLEAN DEFAULT false
);

CREATE INDEX idx_contacts_location ON public.ghl_contacts(location_id);
CREATE INDEX idx_contacts_email ON public.ghl_contacts(email);
CREATE INDEX idx_contacts_phone ON public.ghl_contacts(phone);
CREATE INDEX idx_contacts_tags ON public.ghl_contacts USING GIN(tags);
CREATE INDEX idx_contacts_custom_attr ON public.ghl_contacts USING GIN(custom_attributes);
CREATE INDEX idx_contacts_search ON public.ghl_contacts USING GIN(search_vector);
CREATE INDEX idx_contacts_type ON public.ghl_contacts(type);
CREATE INDEX idx_contacts_assigned ON public.ghl_contacts(assigned_to);

-- ============================================
-- 5. GHL OPPORTUNITIES
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_opportunities (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    contact_id TEXT REFERENCES public.ghl_contacts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'abandoned')),
    pipeline_id TEXT NOT NULL,
    pipeline_stage_id TEXT NOT NULL,
    monetary_value DECIMAL(15, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    assigned_to TEXT,
    source TEXT,
    loss_reason TEXT,
    custom_fields JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    CONSTRAINT fk_opportunity_stage FOREIGN KEY (pipeline_id, pipeline_stage_id)
        REFERENCES public.ghl_pipeline_stages(pipeline_id, id) ON DELETE SET NULL
);

CREATE INDEX idx_opportunities_location ON public.ghl_opportunities(location_id);
CREATE INDEX idx_opportunities_contact ON public.ghl_opportunities(contact_id);
CREATE INDEX idx_opportunities_pipeline ON public.ghl_opportunities(pipeline_id);
CREATE INDEX idx_opportunities_stage ON public.ghl_opportunities(pipeline_stage_id);
CREATE INDEX idx_opportunities_status ON public.ghl_opportunities(status);
CREATE INDEX idx_opportunities_assigned ON public.ghl_opportunities(assigned_to);
CREATE INDEX idx_opportunities_value ON public.ghl_opportunities(monetary_value);

-- ============================================
-- 6. GHL WORKFLOWS
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_workflows (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    version INTEGER DEFAULT 1,
    trigger_types TEXT[] DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflows_location ON public.ghl_workflows(location_id);
CREATE INDEX idx_workflows_status ON public.ghl_workflows(status);

-- ============================================
-- 7. GHL CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_conversations (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    contact_id TEXT REFERENCES public.ghl_contacts(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'sms',
    channel TEXT,
    unread_count INTEGER DEFAULT 0,
    last_message_body TEXT,
    last_message_type TEXT,
    last_message_date TIMESTAMPTZ,
    assigned_to TEXT,
    starred BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    inbox_status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_location ON public.ghl_conversations(location_id);
CREATE INDEX idx_conversations_contact ON public.ghl_conversations(contact_id);
CREATE INDEX idx_conversations_type ON public.ghl_conversations(type);
CREATE INDEX idx_conversations_unread ON public.ghl_conversations(unread_count) WHERE unread_count > 0;
CREATE INDEX idx_conversations_last_activity ON public.ghl_conversations(last_message_date DESC);

-- ============================================
-- 8. GHL MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.ghl_conversations(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    contact_id TEXT REFERENCES public.ghl_contacts(id) ON DELETE SET NULL,
    body TEXT,
    message_type TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status TEXT DEFAULT 'pending',
    content_type TEXT DEFAULT 'text/plain',
    attachments JSONB DEFAULT '[]'::jsonb,
    meta_data JSONB DEFAULT '{}'::jsonb,
    source TEXT,
    user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON public.ghl_messages(conversation_id);
CREATE INDEX idx_messages_location ON public.ghl_messages(location_id);
CREATE INDEX idx_messages_contact ON public.ghl_messages(contact_id);
CREATE INDEX idx_messages_conversation_date ON public.ghl_messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_direction ON public.ghl_messages(direction);
CREATE INDEX idx_messages_type ON public.ghl_messages(message_type);

-- ============================================
-- 9. GHL CALENDARS
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_calendars (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT,
    widget_slug TEXT,
    calendar_type TEXT DEFAULT 'round_robin',
    team_members JSONB DEFAULT '[]'::jsonb,
    event_type TEXT,
    slot_duration INTEGER DEFAULT 30,
    slot_buffer INTEGER DEFAULT 0,
    availability JSONB DEFAULT '{}'::jsonb,
    notifications JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendars_location ON public.ghl_calendars(location_id);
CREATE INDEX idx_calendars_active ON public.ghl_calendars(is_active);

-- ============================================
-- 10. GHL APPOINTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_appointments (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    contact_id TEXT REFERENCES public.ghl_contacts(id) ON DELETE SET NULL,
    calendar_id TEXT REFERENCES public.ghl_calendars(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'showed', 'noshow', 'invalid')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone TEXT DEFAULT 'America/New_York',
    assigned_user_id TEXT,
    appointment_type TEXT,
    notes TEXT,
    address TEXT,
    google_event_id TEXT,
    appointment_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_location ON public.ghl_appointments(location_id);
CREATE INDEX idx_appointments_contact ON public.ghl_appointments(contact_id);
CREATE INDEX idx_appointments_calendar ON public.ghl_appointments(calendar_id);
CREATE INDEX idx_appointments_start ON public.ghl_appointments(start_time);
CREATE INDEX idx_appointments_status ON public.ghl_appointments(status);
CREATE INDEX idx_appointments_assigned ON public.ghl_appointments(assigned_user_id);
CREATE INDEX idx_appointments_date_range ON public.ghl_appointments(start_time, end_time);

-- ============================================
-- 11. GHL INVOICES
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_invoices (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    contact_id TEXT REFERENCES public.ghl_contacts(id) ON DELETE SET NULL,
    invoice_number TEXT,
    name TEXT,
    title TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void', 'partially_paid')),
    due_date DATE,
    issue_date DATE DEFAULT CURRENT_DATE,
    amount_due DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    discount DECIMAL(15, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    items JSONB DEFAULT '[]'::jsonb,
    business_details JSONB DEFAULT '{}'::jsonb,
    payment_terms TEXT,
    notes TEXT,
    sent_to JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_location ON public.ghl_invoices(location_id);
CREATE INDEX idx_invoices_contact ON public.ghl_invoices(contact_id);
CREATE INDEX idx_invoices_status ON public.ghl_invoices(status);
CREATE INDEX idx_invoices_due_date ON public.ghl_invoices(due_date);
CREATE INDEX idx_invoices_number ON public.ghl_invoices(invoice_number);

-- ============================================
-- 12. GHL PRODUCTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_products (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    product_type TEXT DEFAULT 'DIGITAL',
    price DECIMAL(15, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    image_url TEXT,
    available_in_store BOOLEAN DEFAULT true,
    statement_descriptor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_location ON public.ghl_products(location_id);
CREATE INDEX idx_products_type ON public.ghl_products(product_type);

-- ============================================
-- 13. GHL USERS (Team Members)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_users (
    id TEXT PRIMARY KEY,
    location_id TEXT REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'user',
    permissions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_location ON public.ghl_users(location_id);
CREATE INDEX idx_users_email ON public.ghl_users(email);
CREATE INDEX idx_users_active ON public.ghl_users(is_active);

-- ============================================
-- 14. SYNC LOG (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ghl_sync_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    location_id TEXT REFERENCES public.ghl_locations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'sync')),
    payload JSONB,
    source TEXT DEFAULT 'webhook',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_location ON public.ghl_sync_log(location_id);
CREATE INDEX idx_sync_log_entity ON public.ghl_sync_log(entity_type, entity_id);
CREATE INDEX idx_sync_log_created ON public.ghl_sync_log(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.ghl_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_sync_log ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (service role bypasses RLS)
-- These policies allow authenticated users to manage their own location's data

CREATE POLICY "Users can view their location data" ON public.ghl_locations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their location data" ON public.ghl_locations
    FOR ALL USING (auth.role() = 'authenticated');

-- Contacts policies
CREATE POLICY "Users can view contacts" ON public.ghl_contacts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage contacts" ON public.ghl_contacts
    FOR ALL USING (auth.role() = 'authenticated');

-- Opportunities policies
CREATE POLICY "Users can view opportunities" ON public.ghl_opportunities
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage opportunities" ON public.ghl_opportunities
    FOR ALL USING (auth.role() = 'authenticated');

-- Similar policies for all other tables
CREATE POLICY "Users can view pipelines" ON public.ghl_pipelines
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage pipelines" ON public.ghl_pipelines
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view pipeline stages" ON public.ghl_pipeline_stages
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage pipeline stages" ON public.ghl_pipeline_stages
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view workflows" ON public.ghl_workflows
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage workflows" ON public.ghl_workflows
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view conversations" ON public.ghl_conversations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage conversations" ON public.ghl_conversations
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view messages" ON public.ghl_messages
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage messages" ON public.ghl_messages
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view calendars" ON public.ghl_calendars
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage calendars" ON public.ghl_calendars
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view appointments" ON public.ghl_appointments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage appointments" ON public.ghl_appointments
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view invoices" ON public.ghl_invoices
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage invoices" ON public.ghl_invoices
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view products" ON public.ghl_products
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage products" ON public.ghl_products
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view team users" ON public.ghl_users
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage team users" ON public.ghl_users
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view sync log" ON public.ghl_sync_log
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage sync log" ON public.ghl_sync_log
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables
CREATE TRIGGER update_ghl_locations_updated_at BEFORE UPDATE ON public.ghl_locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_contacts_updated_at BEFORE UPDATE ON public.ghl_contacts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_opportunities_updated_at BEFORE UPDATE ON public.ghl_opportunities
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_pipelines_updated_at BEFORE UPDATE ON public.ghl_pipelines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_pipeline_stages_updated_at BEFORE UPDATE ON public.ghl_pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_workflows_updated_at BEFORE UPDATE ON public.ghl_workflows
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_conversations_updated_at BEFORE UPDATE ON public.ghl_conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_calendars_updated_at BEFORE UPDATE ON public.ghl_calendars
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_appointments_updated_at BEFORE UPDATE ON public.ghl_appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_invoices_updated_at BEFORE UPDATE ON public.ghl_invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_products_updated_at BEFORE UPDATE ON public.ghl_products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ghl_users_updated_at BEFORE UPDATE ON public.ghl_users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
