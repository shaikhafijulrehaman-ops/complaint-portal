import sys
import getpass
try:
    import psycopg2
except ImportError:
    print("Installing psycopg2-binary...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    import psycopg2

def run_migration():
    print("Supabase Database Migration Tool")
    print("Project: glsucmsvtxjppgbmushb")
    print("-" * 40)
    
    password = input("Enter your Supabase database password: ")
    if not password:
        print("Error: Password is required.")
        return

    try:
        conn = psycopg2.connect(
            host="db.glsucmsvtxjppgbmushb.supabase.co",
            database="postgres",
            user="postgres",
            password=password,
            port="5432"
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        # 1. Complaints Table
        print("Checking if 'complaints' table exists...")
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'complaints'
            );
        """)
        exists_complaints = cur.fetchone()[0]
        
        if not exists_complaints:
            print("Table 'complaints' does not exist. Creating table...")
            cur.execute("""
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
            """)
            print("Table 'complaints' created successfully.")
        else:
            print("Table 'complaints' already exists. Verifying columns...")
            columns = [
                ("complaint_id", "VARCHAR(50) UNIQUE"),
                ("assigned_department", "VARCHAR(150)"),
                ("bus_number", "VARCHAR(50)"),
                ("bus_route", "VARCHAR(255)"),
                ("resolution_notes", "TEXT")
            ]
            for col_name, col_type in columns:
                try:
                    cur.execute(f"ALTER TABLE complaints ADD COLUMN {col_name} {col_type};")
                    print(f"Added missing column '{col_name}'.")
                except psycopg2.errors.DuplicateColumn:
                    pass
                except Exception as e:
                    print(f"Verification note on '{col_name}': {e}")
        
        print("Enabling RLS on complaints...")
        cur.execute("ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;")
        
        print("Recreating database security policies for complaints...")
        cur.execute("DROP POLICY IF EXISTS \"Enable insert for authenticated users\" ON complaints;")
        cur.execute("DROP POLICY IF EXISTS \"Students can view their own complaints\" ON complaints;")
        cur.execute("DROP POLICY IF EXISTS \"Admins have full access\" ON complaints;")
        cur.execute("DROP POLICY IF EXISTS \"Enable insert for all\" ON complaints;")
        cur.execute("DROP POLICY IF EXISTS \"Enable select for all\" ON complaints;")
        
        # Policy: Students can insert (allow anon/auth for ease of credentials check)
        cur.execute("""
            CREATE POLICY "Enable insert for all" 
            ON complaints FOR INSERT 
            TO anon, authenticated 
            WITH CHECK (true);
        """)
        # Policy: Users can view all (admins route view logs and students check stats)
        cur.execute("""
            CREATE POLICY "Enable select for all" 
            ON complaints FOR SELECT 
            TO anon, authenticated 
            USING (true);
        """)
        
        # 2. Student Accounts Table
        print("\nChecking if 'student_accounts' table exists...")
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'student_accounts'
            );
        """)
        exists_accounts = cur.fetchone()[0]
        
        if not exists_accounts:
            print("Table 'student_accounts' does not exist. Creating table...")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS student_accounts (
                    email VARCHAR(255) PRIMARY KEY,
                    password VARCHAR(255) NOT NULL,
                    tos_accepted BOOLEAN DEFAULT FALSE,
                    tos_accepted_at TIMESTAMPTZ DEFAULT NOW(),
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            print("Table 'student_accounts' created successfully.")
        
        print("Enabling RLS on student_accounts...")
        cur.execute("ALTER TABLE student_accounts ENABLE ROW LEVEL SECURITY;")
        
        print("Recreating database security policies for student_accounts...")
        cur.execute("DROP POLICY IF EXISTS \"Enable read/write for all\" ON student_accounts;")
        cur.execute("""
            CREATE POLICY "Enable read/write for all" 
            ON student_accounts FOR ALL 
            TO anon, authenticated 
            USING (true) 
            WITH CHECK (true);
        """)
        print("Security policies configured.")
        
        print("\nRefreshing Supabase schema cache...")
        cur.execute("NOTIFY pgrst, 'reload schema';")
        print("Schema cache reload signal sent successfully.")
        
        cur.close()
        conn.close()
        print("-" * 40)
        print("Migration Completed Successfully!")
    except Exception as e:
        print(f"\nError connecting to database: {e}")
        print("Please check your password and try again.")

if __name__ == '__main__':
    run_migration()
