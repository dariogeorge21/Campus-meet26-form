-- ==============================================================================
-- Supabase Database Schema: Complete Consolidated Setup
-- Project:   ORAH 2026 — CCT Event Management
-- File:      supabase/supabase_schema.sql
-- Description:
--   Consolidated single schema file containing all required types, tables,
--   constraints, indexes, triggers, Row Level Security (RLS) policies, and
--   initial seed data for the CCT registration platform.
--
-- Apply via:
--   - Supabase Dashboard → SQL Editor → Paste & Run
--   - Supabase CLI: supabase db reset / supabase db push
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 1: EXTENSIONS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 2: CUSTOM ENUM TYPES
-- ──────────────────────────────────────────────────────────────────────────────

-- Event registration status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
        CREATE TYPE event_status AS ENUM ('ACCEPTING', 'CLOSED');
    END IF;
END $$;

-- Registration origin channel
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_type') THEN
        CREATE TYPE registration_type AS ENUM ('ONLINE', 'OFFLINE');
    END IF;
END $$;


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 3: TABLES
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Events Table
-- Stores top-level event information, registration status, and capacity limits.
CREATE TABLE IF NOT EXISTS events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name             text NOT NULL,
    slug             text NOT NULL UNIQUE,          -- URL-safe identifier (e.g. 'orah-2026')
    description      text,
    location         text,
    event_date       timestamptz,
    status           event_status NOT NULL DEFAULT 'ACCEPTING',
    max_capacity     integer,                      -- NULL represents unlimited capacity
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  events              IS 'Top-level event records for CCT event management.';
COMMENT ON COLUMN events.slug        IS 'URL-friendly unique identifier used by API routes.';
COMMENT ON COLUMN events.status      IS 'ACCEPTING = open for registrations; CLOSED = registration closed.';
COMMENT ON COLUMN events.max_capacity IS 'Optional registration limit. NULL = unlimited.';


-- 2. Users Table
-- Administrative and staff accounts extending Supabase Auth.
CREATE TABLE IF NOT EXISTS users (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id    uuid UNIQUE,                        -- References auth.users(id)
    email      text NOT NULL UNIQUE,
    full_name  text,
    role       text NOT NULL DEFAULT 'admin',      -- 'admin', 'staff', 'volunteer'
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  users          IS 'Internal admin and staff accounts for event management.';
COMMENT ON COLUMN users.auth_id IS 'Supabase Auth UID. Nullable for manually seeded users.';
COMMENT ON COLUMN users.role    IS 'Role identifier for access control (e.g., admin, staff).';


-- 3. Registrations Table
-- Stores participant submissions received via the registration form or on-spot.
CREATE TABLE IF NOT EXISTS registrations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    registration_type registration_type NOT NULL DEFAULT 'ONLINE',

    -- Personal Details
    name              text NOT NULL,
    dob               date NOT NULL,
    phone             text NOT NULL,
    email             text NOT NULL,
    gender            text NOT NULL,               -- 'male' | 'female'

    -- Affiliation & Education / Career
    -- affiliation options: '+2 Passout', 'College', 'Institutes', 'Job Seeking', 'Employed', or custom
    affiliation       text NOT NULL,
    institute         text,                        -- Applicable when affiliation = 'Institutes' or custom
    college           text,                        -- Applicable when affiliation = 'College' or custom
    year_of_study     text,                        -- Applicable when affiliation = 'College' or custom

    -- Community / Church Details
    parish            text NOT NULL,
    diocese           text NOT NULL,
    address           text NOT NULL DEFAULT '',

    -- Submission Status & Timestamps
    confirmed         boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT registrations_unique_email_per_event UNIQUE (event_id, email)
);

COMMENT ON TABLE  registrations               IS 'Individual participant event registrations.';
COMMENT ON COLUMN registrations.affiliation   IS 'Primary participant affiliation (+2 Passout, College, Institutes, Job Seeking, Employed, or custom value).';
COMMENT ON COLUMN registrations.institute     IS 'Institute name if affiliation is Institutes (e.g. IELTS, German, SSC, or custom value).';
COMMENT ON COLUMN registrations.college       IS 'College attended if affiliation is College (e.g. SJCET, ACP, DMC, STC, or custom value).';
COMMENT ON COLUMN registrations.year_of_study IS 'Academic year if affiliation is College (e.g. UG - 1st Year, PG - 2nd Year, or custom value).';
COMMENT ON COLUMN registrations.address       IS 'Residential / mailing address of the participant.';
COMMENT ON COLUMN registrations.confirmed     IS 'Confirmation checkbox signed off by participant upon submission.';


-- 4. Tickets Table
-- Issued tickets for confirmed registrations. Contains token hash for QR code scanning.
CREATE TABLE IF NOT EXISTS tickets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    token_hash      text NOT NULL UNIQUE,          -- Unique SHA-256 verification token
    issued_at       timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  tickets            IS 'QR check-in tokens issued for completed registrations.';
COMMENT ON COLUMN tickets.token_hash IS 'SHA-256 hash used for QR code generation and attendee verification.';


-- 5. Check-ins Table
-- Audit log of ticket check-ins during the event.
CREATE TABLE IF NOT EXISTS check_ins (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id     uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    checked_in_at timestamptz NOT NULL DEFAULT now(),
    checked_in_by text,                            -- Staff identifier, device ID, or user account
    created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  check_ins                IS 'Check-in log entries recorded when tickets are scanned at the venue.';
COMMENT ON COLUMN check_ins.checked_in_by IS 'Identifier of scanning staff member, scanner device, or operator.';


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 4: INDEXES
-- ──────────────────────────────────────────────────────────────────────────────

-- Events lookup
CREATE INDEX IF NOT EXISTS idx_events_slug
    ON events(slug);

-- Registrations lookup by event
CREATE INDEX IF NOT EXISTS idx_registrations_event_id
    ON registrations(event_id);

-- Registrations lookup by email for duplicate checks
CREATE INDEX IF NOT EXISTS idx_registrations_email
    ON registrations(email);

-- Registrations filtering by affiliation
CREATE INDEX IF NOT EXISTS idx_registrations_affiliation
    ON registrations(affiliation);

-- Tickets lookup by registration
CREATE INDEX IF NOT EXISTS idx_tickets_registration_id
    ON tickets(registration_id);

-- Tickets verification by token hash (QR scanner lookups)
CREATE INDEX IF NOT EXISTS idx_tickets_token_hash
    ON tickets(token_hash);

-- Check-ins lookup by ticket
CREATE INDEX IF NOT EXISTS idx_check_ins_ticket_id
    ON check_ins(ticket_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 5: TIMESTAMP UPDATE TRIGGER
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_events ON events;
CREATE TRIGGER set_updated_at_events
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_users ON users;
CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_registrations ON registrations;
CREATE TRIGGER set_updated_at_registrations
    BEFORE UPDATE ON registrations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tickets ON tickets;
CREATE TRIGGER set_updated_at_tickets
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 6: ROW LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────────────────────────────────────────
-- Deny-by-default security model.
-- The Next.js API route connects via SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.

ALTER TABLE events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins     ENABLE ROW LEVEL SECURITY;

-- Allow public read access to events (for frontend status & details)
DROP POLICY IF EXISTS "Public can read events" ON events;
CREATE POLICY "Public can read events"
    ON events
    FOR SELECT
    TO anon, authenticated
    USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 7: SEED DATA (INITIAL EVENT)
-- ──────────────────────────────────────────────────────────────────────────────
-- Default event record for ORAH 2026, required by /api/register

INSERT INTO events (name, slug, description, location, status)
VALUES (
    'ORAH 2026',
    'orah-2026',
    'Campus Meet — ORAH 2026',
    'Pala, Kerala',
    'ACCEPTING'
)
ON CONFLICT (slug) DO NOTHING;
