-- GHL CRM Seed Data
-- Run with: npx supabase db reset (includes seed);
-- Or manually: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed.sql

-- ============================================
-- LOCATIONS (Business Locations);
-- ============================================
INSERT INTO public.ghl_locations (id, name, email, phone, website, timezone, is_active, address_data) VALUES
  ('loc_001', 'Acme Corp HQ', 'contact@acmecorp.com', '+1-555-0100', 'https://acmecorp.com', 'America/New_York', true, '{"street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001", "country": "US"}'::jsonb),
  ('loc_002', 'Acme Corp West', 'west@acmecorp.com', '+1-555-0200', 'https://acmecorp.com/west', 'America/Los_Angeles', true, '{"street": "456 Market St", "city": "San Francisco", "state": "CA", "zip": "94102", "country": "US"}'::jsonb),
  ('loc_003', 'TechStart Inc', 'hello@techstart.io', '+1-555-0300', 'https://techstart.io', 'America/Chicago', true, '{"street": "789 Innovation Dr", "city": "Austin", "state": "TX", "zip": "78701", "country": "US"}'::jsonb);


-- ============================================
-- USERS (Team Members);
-- ============================================
INSERT INTO public.ghl_users (id, location_id, name, email, phone, role, is_active) VALUES
  ('usr_001', 'loc_001', 'John Smith', 'john@acmecorp.com', '+1-555-1001', 'admin', true),
  ('usr_002', 'loc_001', 'Sarah Johnson', 'sarah@acmecorp.com', '+1-555-1002', 'sales', true),
  ('usr_003', 'loc_001', 'Mike Williams', 'mike@acmecorp.com', '+1-555-1003', 'sales', true),
  ('usr_004', 'loc_002', 'Emily Davis', 'emily@acmecorp.com', '+1-555-1004', 'manager', true),
  ('usr_005', 'loc_003', 'Alex Chen', 'alex@techstart.io', '+1-555-1005', 'admin', true);


-- ============================================
-- PIPELINES (Sales Pipelines);
-- ============================================
INSERT INTO public.ghl_pipelines (id, location_id, name, show_in_funnel, show_in_pie_chart) VALUES
  ('pipe_001', 'loc_001', 'Sales Pipeline', true, true),
  ('pipe_002', 'loc_001', 'Enterprise Deals', true, true),
  ('pipe_003', 'loc_002', 'West Coast Pipeline', true, true),
  ('pipe_004', 'loc_003', 'Startup Pipeline', true, false);


-- ============================================
-- PIPELINE STAGES
-- ============================================
INSERT INTO public.ghl_pipeline_stages (id, pipeline_id, location_id, name, position, probability) VALUES
  -- Sales Pipeline stages
  ('stage_001', 'pipe_001', 'loc_001', 'Lead', 0, 10),
  ('stage_002', 'pipe_001', 'loc_001', 'Qualified', 1, 25),
  ('stage_003', 'pipe_001', 'loc_001', 'Proposal', 2, 50),
  ('stage_004', 'pipe_001', 'loc_001', 'Negotiation', 3, 75),
  ('stage_005', 'pipe_001', 'loc_001', 'Won', 4, 100),
  ('stage_006', 'pipe_001', 'loc_001', 'Lost', 5, 0),
  -- Enterprise Deals stages
  ('stage_007', 'pipe_002', 'loc_001', 'Discovery', 0, 10),
  ('stage_008', 'pipe_002', 'loc_001', 'Demo Scheduled', 1, 30),
  ('stage_009', 'pipe_002', 'loc_001', 'POC', 2, 50),
  ('stage_010', 'pipe_002', 'loc_001', 'Contract Review', 3, 80),
  ('stage_011', 'pipe_002', 'loc_001', 'Closed Won', 4, 100),
  -- West Coast Pipeline stages
  ('stage_012', 'pipe_003', 'loc_002', 'New Lead', 0, 10),
  ('stage_013', 'pipe_003', 'loc_002', 'Contacted', 1, 25),
  ('stage_014', 'pipe_003', 'loc_002', 'Meeting Set', 2, 40),
  ('stage_015', 'pipe_003', 'loc_002', 'Proposal Sent', 3, 60),
  ('stage_016', 'pipe_003', 'loc_002', 'Closed', 4, 100);


-- ============================================
-- CONTACTS (Leads/Customers);
-- ============================================
INSERT INTO public.ghl_contacts (id, location_id, first_name, last_name, email, phone, company_name, type, tags, assigned_to, source, address_data) VALUES
  -- Location 1 Contacts
  ('cont_001', 'loc_001', 'Alice', 'Anderson', 'alice@example.com', '+1-555-2001', 'Anderson & Co', 'customer', ARRAY['vip', 'enterprise'], 'usr_002', 'website', '{"city": "Boston", "state": "MA"}'::jsonb),
  ('cont_002', 'loc_001', 'Bob', 'Brown', 'bob@startup.io', '+1-555-2002', 'Startup.io', 'lead', ARRAY['tech', 'saas'], 'usr_002', 'referral', '{"city": "Seattle", "state": "WA"}'::jsonb),
  ('cont_003', 'loc_001', 'Carol', 'Clark', 'carol@bigcorp.com', '+1-555-2003', 'BigCorp Inc', 'customer', ARRAY['enterprise', 'annual'], 'usr_003', 'trade_show', '{"city": "Chicago", "state": "IL"}'::jsonb),
  ('cont_004', 'loc_001', 'David', 'Davis', 'david@consulting.com', '+1-555-2004', 'Davis Consulting', 'lead', ARRAY['consulting'], 'usr_003', 'cold_call', '{"city": "Miami", "state": "FL"}'::jsonb),
  ('cont_005', 'loc_001', 'Emma', 'Evans', 'emma@techfirm.com', '+1-555-2005', 'TechFirm LLC', 'prospect', ARRAY['tech', 'startup'], 'usr_002', 'linkedin', '{"city": "Denver", "state": "CO"}'::jsonb),
  ('cont_006', 'loc_001', 'Frank', 'Foster', 'frank@manufacturing.com', '+1-555-2006', 'Foster Manufacturing', 'customer', ARRAY['manufacturing', 'b2b'], 'usr_003', 'website', '{"city": "Detroit", "state": "MI"}'::jsonb),
  ('cont_007', 'loc_001', 'Grace', 'Garcia', 'grace@retail.com', '+1-555-2007', 'Garcia Retail', 'lead', ARRAY['retail', 'smb'], 'usr_002', 'facebook', '{"city": "Phoenix", "state": "AZ"}'::jsonb),
  ('cont_008', 'loc_001', 'Henry', 'Harris', 'henry@finance.com', '+1-555-2008', 'Harris Financial', 'prospect', ARRAY['finance', 'enterprise'], 'usr_003', 'referral', '{"city": "Atlanta", "state": "GA"}'::jsonb),
  -- Location 2 Contacts
  ('cont_009', 'loc_002', 'Ivy', 'Ingram', 'ivy@westtech.com', '+1-555-2009', 'WestTech Solutions', 'customer', ARRAY['tech', 'vip'], 'usr_004', 'website', '{"city": "San Jose", "state": "CA"}'::jsonb),
  ('cont_010', 'loc_002', 'Jack', 'Johnson', 'jack@bayarea.co', '+1-555-2010', 'Bay Area Co', 'lead', ARRAY['startup'], 'usr_004', 'linkedin', '{"city": "Oakland", "state": "CA"}'::jsonb),
  ('cont_011', 'loc_002', 'Kate', 'King', 'kate@pacificbiz.com', '+1-555-2011', 'Pacific Business', 'customer', ARRAY['b2b', 'annual'], 'usr_004', 'trade_show', '{"city": "Portland", "state": "OR"}'::jsonb),
  ('cont_012', 'loc_002', 'Leo', 'Lopez', 'leo@socal.io', '+1-555-2012', 'SoCal Innovations', 'prospect', ARRAY['tech', 'saas'], 'usr_004', 'website', '{"city": "Los Angeles", "state": "CA"}'::jsonb),
  -- Location 3 Contacts
  ('cont_013', 'loc_003', 'Maya', 'Martinez', 'maya@austintech.com', '+1-555-2013', 'Austin Tech Hub', 'customer', ARRAY['tech', 'local'], 'usr_005', 'referral', '{"city": "Austin", "state": "TX"}'::jsonb),
  ('cont_014', 'loc_003', 'Noah', 'Nelson', 'noah@startupgrind.com', '+1-555-2014', 'Startup Grind', 'lead', ARRAY['startup', 'events'], 'usr_005', 'event', '{"city": "Dallas", "state": "TX"}'::jsonb),
  ('cont_015', 'loc_003', 'Olivia', 'Owen', 'olivia@texasvc.com', '+1-555-2015', 'Texas VC Partners', 'prospect', ARRAY['finance', 'vc'], 'usr_005', 'linkedin', '{"city": "Houston", "state": "TX"}'::jsonb);


-- ============================================
-- OPPORTUNITIES (Deals);
-- ============================================
INSERT INTO public.ghl_opportunities (id, location_id, pipeline_id, pipeline_stage_id, contact_id, name, monetary_value, status, assigned_to) VALUES
  -- Sales Pipeline Opportunities
  ('opp_001', 'loc_001', 'pipe_001', 'stage_005', 'cont_001', 'Anderson Enterprise Deal', 125000.00, 'won', 'usr_002'),
  ('opp_002', 'loc_001', 'pipe_001', 'stage_004', 'cont_003', 'BigCorp Annual Contract', 85000.00, 'open', 'usr_003'),
  ('opp_003', 'loc_001', 'pipe_001', 'stage_003', 'cont_002', 'Startup.io SaaS Package', 24000.00, 'open', 'usr_002'),
  ('opp_004', 'loc_001', 'pipe_001', 'stage_002', 'cont_005', 'TechFirm Pilot Program', 15000.00, 'open', 'usr_002'),
  ('opp_005', 'loc_001', 'pipe_001', 'stage_001', 'cont_007', 'Garcia Retail Initial', 8500.00, 'open', 'usr_002'),
  ('opp_006', 'loc_001', 'pipe_001', 'stage_006', 'cont_004', 'Davis Consulting Lost', 35000.00, 'lost', 'usr_003'),
  -- Enterprise Pipeline Opportunities
  ('opp_007', 'loc_001', 'pipe_002', 'stage_010', 'cont_006', 'Foster Manufacturing Enterprise', 250000.00, 'open', 'usr_003'),
  ('opp_008', 'loc_001', 'pipe_002', 'stage_009', 'cont_008', 'Harris Financial POC', 175000.00, 'open', 'usr_003'),
  -- West Coast Pipeline Opportunities
  ('opp_009', 'loc_002', 'pipe_003', 'stage_016', 'cont_009', 'WestTech Solutions Deal', 95000.00, 'won', 'usr_004'),
  ('opp_010', 'loc_002', 'pipe_003', 'stage_015', 'cont_011', 'Pacific Business Renewal', 55000.00, 'open', 'usr_004'),
  ('opp_011', 'loc_002', 'pipe_003', 'stage_014', 'cont_010', 'Bay Area Startup Package', 18000.00, 'open', 'usr_004'),
  ('opp_012', 'loc_002', 'pipe_003', 'stage_012', 'cont_012', 'SoCal New Lead', 42000.00, 'open', 'usr_004');


-- ============================================
-- CALENDARS
-- ============================================
INSERT INTO public.ghl_calendars (id, location_id, name, description, is_active) VALUES
  ('cal_001', 'loc_001', 'Sales Team Calendar', 'Main calendar for sales team meetings', true),
  ('cal_002', 'loc_001', 'Demo Calendar', 'Product demonstrations', true),
  ('cal_003', 'loc_002', 'West Coast Sales', 'West coast team calendar', true),
  ('cal_004', 'loc_003', 'TechStart Meetings', 'All company meetings', true);


-- ============================================
-- APPOINTMENTS
-- ============================================
INSERT INTO public.ghl_appointments (id, location_id, calendar_id, contact_id, title, start_time, end_time, status, notes) VALUES
  ('apt_001', 'loc_001', 'cal_001', 'cont_003', 'BigCorp Contract Review', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '1 hour', 'confirmed', 'Review final contract terms'),
  ('apt_002', 'loc_001', 'cal_002', 'cont_005', 'TechFirm Product Demo', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '45 minutes', 'confirmed', 'Full platform demo'),
  ('apt_003', 'loc_001', 'cal_001', 'cont_008', 'Harris Financial Discovery', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '30 minutes', 'confirmed', 'Initial discovery call'),
  ('apt_004', 'loc_002', 'cal_003', 'cont_011', 'Pacific Business Renewal Talk', NOW() + INTERVAL '4 days', NOW() + INTERVAL '4 days' + INTERVAL '1 hour', 'confirmed', 'Discuss renewal terms'),
  ('apt_005', 'loc_002', 'cal_003', 'cont_010', 'Bay Area Demo', NOW() + INTERVAL '6 days', NOW() + INTERVAL '6 days' + INTERVAL '1 hour', 'confirmed', 'Product walkthrough'),
  ('apt_006', 'loc_003', 'cal_004', 'cont_014', 'Startup Grind Partnership', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '30 minutes', 'confirmed', 'Explore partnership opportunities');


-- ============================================
-- CONVERSATIONS
-- ============================================
INSERT INTO public.ghl_conversations (id, location_id, contact_id, type, inbox_status, unread_count, last_message_date) VALUES
  ('conv_001', 'loc_001', 'cont_001', 'sms', 'open', 0, NOW() - INTERVAL '2 hours'),
  ('conv_002', 'loc_001', 'cont_002', 'email', 'open', 2, NOW() - INTERVAL '30 minutes'),
  ('conv_003', 'loc_001', 'cont_003', 'sms', 'open', 1, NOW() - INTERVAL '1 hour'),
  ('conv_004', 'loc_001', 'cont_005', 'email', 'open', 0, NOW() - INTERVAL '4 hours'),
  ('conv_005', 'loc_002', 'cont_009', 'sms', 'open', 3, NOW() - INTERVAL '15 minutes'),
  ('conv_006', 'loc_002', 'cont_011', 'email', 'open', 0, NOW() - INTERVAL '1 day'),
  ('conv_007', 'loc_003', 'cont_013', 'sms', 'open', 1, NOW() - INTERVAL '45 minutes');


-- ============================================
-- MESSAGES
-- ============================================
INSERT INTO public.ghl_messages (id, location_id, conversation_id, contact_id, message_type, direction, body, status, created_at) VALUES
  ('msg_001', 'loc_001', 'conv_001', 'cont_001', 'sms', 'outbound', 'Hi Alice! Just following up on our meeting yesterday. Let me know if you have any questions!', 'delivered', NOW() - INTERVAL '2 hours'),
  ('msg_002', 'loc_001', 'conv_001', 'cont_001', 'sms', 'inbound', 'Thanks! Everything looks great. Well be ready to sign next week.', 'received', NOW() - INTERVAL '2 hours' + INTERVAL '15 minutes'),
  ('msg_003', 'loc_001', 'conv_002', 'cont_002', 'email', 'outbound', 'Hi Bob, Attached is the proposal we discussed. Looking forward to your feedback!', 'delivered', NOW() - INTERVAL '1 day'),
  ('msg_004', 'loc_001', 'conv_002', 'cont_002', 'email', 'inbound', 'Got it! Reviewing with the team now. Will get back to you by EOD.', 'received', NOW() - INTERVAL '30 minutes'),
  ('msg_005', 'loc_001', 'conv_003', 'cont_003', 'sms', 'inbound', 'Can we move the meeting to Thursday instead?', 'received', NOW() - INTERVAL '1 hour'),
  ('msg_006', 'loc_002', 'conv_005', 'cont_009', 'sms', 'inbound', 'Hey! Quick question about the integration - does it support SSO?', 'received', NOW() - INTERVAL '15 minutes'),
  ('msg_007', 'loc_003', 'conv_007', 'cont_013', 'sms', 'outbound', 'Hi Maya! Confirming our meeting for next week. See you then!', 'delivered', NOW() - INTERVAL '45 minutes');


-- ============================================
-- PRODUCTS
-- ============================================
INSERT INTO public.ghl_products (id, location_id, name, description, price, currency, available_in_store) VALUES
  ('prod_001', 'loc_001', 'Starter Plan', 'Basic features for small teams', 99.00, 'USD', true),
  ('prod_002', 'loc_001', 'Professional Plan', 'Advanced features with priority support', 299.00, 'USD', true),
  ('prod_003', 'loc_001', 'Enterprise Plan', 'Full platform with dedicated support', 999.00, 'USD', true),
  ('prod_004', 'loc_001', 'Add-on: Analytics', 'Advanced analytics and reporting', 49.00, 'USD', true),
  ('prod_005', 'loc_001', 'Add-on: Automation', 'Workflow automation features', 79.00, 'USD', true),
  ('prod_006', 'loc_002', 'West Coast Special', 'Regional pricing package', 249.00, 'USD', true),
  ('prod_007', 'loc_003', 'Startup Bundle', 'Special pricing for startups', 149.00, 'USD', true);


-- ============================================
-- INVOICES
-- ============================================
INSERT INTO public.ghl_invoices (id, location_id, contact_id, invoice_number, total_amount, currency, status, due_date) VALUES
  ('inv_001', 'loc_001', 'cont_001', 'INV-2024-001', 125000.00, 'USD', 'paid', NOW() - INTERVAL '30 days'),
  ('inv_002', 'loc_001', 'cont_003', 'INV-2024-002', 85000.00, 'USD', 'sent', NOW() + INTERVAL '15 days'),
  ('inv_003', 'loc_001', 'cont_006', 'INV-2024-003', 45000.00, 'USD', 'paid', NOW() - INTERVAL '45 days'),
  ('inv_004', 'loc_001', 'cont_002', 'INV-2024-004', 12000.00, 'USD', 'sent', NOW() - INTERVAL '5 days'),
  ('inv_005', 'loc_002', 'cont_009', 'INV-2024-005', 95000.00, 'USD', 'paid', NOW() - INTERVAL '20 days'),
  ('inv_006', 'loc_002', 'cont_011', 'INV-2024-006', 55000.00, 'USD', 'sent', NOW() + INTERVAL '10 days'),
  ('inv_007', 'loc_003', 'cont_013', 'INV-2024-007', 35000.00, 'USD', 'sent', NOW() - INTERVAL '10 days');


-- ============================================
-- WORKFLOWS
-- ============================================
INSERT INTO public.ghl_workflows (id, location_id, name, status, trigger_types) VALUES
  ('wf_001', 'loc_001', 'New Lead Welcome', 'published', ARRAY['contact_created']),
  ('wf_002', 'loc_001', 'Follow-up Reminder', 'published', ARRAY['appointment_scheduled']),
  ('wf_003', 'loc_001', 'Deal Won Celebration', 'published', ARRAY['opportunity_won']),
  ('wf_004', 'loc_001', 'Invoice Reminder', 'draft', ARRAY['invoice_overdue']),
  ('wf_005', 'loc_002', 'West Coast Onboarding', 'published', ARRAY['contact_created']),
  ('wf_006', 'loc_003', 'Startup Nurture Sequence', 'published', ARRAY['tag_added']);


-- ============================================
-- SYNC LOG (Audit Trail);
-- ============================================
INSERT INTO public.ghl_sync_log (location_id, entity_type, entity_id, action, payload) VALUES
  ('loc_001', 'contact', 'cont_001', 'create', '{"source": "seed_data"}'::jsonb),
  ('loc_001', 'opportunity', 'opp_001', 'create', '{"source": "seed_data"}'::jsonb),
  ('loc_001', 'opportunity', 'opp_001', 'update', '{"source": "seed_data", "field": "status", "old": "open", "new": "won"}'::jsonb),
  ('loc_002', 'contact', 'cont_009', 'create', '{"source": "seed_data"}'::jsonb);

-- Summary of seeded data:
-- - 3 Locations
-- - 5 Users
-- - 4 Pipelines with 16 stages
-- - 15 Contacts
-- - 12 Opportunities (2 won, 1 lost, 9 open);
-- - 4 Calendars
-- - 6 Appointments
-- - 7 Conversations with 7 messages
-- - 7 Products
-- - 7 Invoices (3 paid, 2 sent, 2 overdue);
-- - 6 Workflows
-- - 4 Sync log entries
