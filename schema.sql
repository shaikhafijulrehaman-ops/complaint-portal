-- ==========================================
-- Supabase PostgreSQL Database Schema Setup
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Create student_accounts table
CREATE TABLE IF NOT EXISTS student_accounts (
    email VARCHAR(255) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    tos_accepted BOOLEAN DEFAULT FALSE,
    tos_accepted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on student_accounts
ALTER TABLE student_accounts ENABLE ROW LEVEL SECURITY;

-- Define RLS Policies for student_accounts
DROP POLICY IF EXISTS "Enable read/write for all" ON student_accounts;
CREATE POLICY "Enable read/write for all" 
ON student_accounts FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);


-- 2. Create complaints table
CREATE TABLE IF NOT EXISTS complaints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    complaint_id VARCHAR(50) NOT NULL UNIQUE,
    student_email VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    complaint_type VARCHAR(150) NOT NULL,
    bus_number VARCHAR(50),
    bus_route VARCHAR(255),
    description TEXT NOT NULL,
    attachment_url TEXT,
    status VARCHAR(50) DEFAULT 'Submitted',
    assigned_department VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    resolution_notes TEXT
);

-- Enable RLS on complaints
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Define RLS Policies for complaints
DROP POLICY IF EXISTS "Enable insert for all" ON complaints;
DROP POLICY IF EXISTS "Enable select for all" ON complaints;

CREATE POLICY "Enable insert for all" 
ON complaints FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Enable select for all" 
ON complaints FOR SELECT 
TO anon, authenticated 
USING (true);
