-- =========================================================================
-- สคริปต์ฐานข้อมูลระบบบริหารจัดการงานโครงการกองช่าง (Supabase PostgreSQL)
-- Engineering Division Project Management Database Schema
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ตารางข้อมูลโปรไฟล์ผู้ใช้งานและสิทธิ์ (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  position TEXT,
  department TEXT DEFAULT 'กองช่าง',
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ตารางหลักข้อมูลโครงการ (projects)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_code TEXT UNIQUE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  name TEXT NOT NULL,
  budget_category TEXT NOT NULL CHECK (budget_category IN ('เงินสะสม', 'งบประมาณรายจ่าย', 'เงินอุดหนุนเฉพาะกิจ', 'เงินอุดหนุนทั่วไป', 'เงินกู้/งบกลาง', 'เงินบริจาค/อื่นๆ')),
  meeting_session TEXT,
  approval_year INTEGER,
  approved_budget NUMERIC(15,2) NOT NULL DEFAULT 0,
  description TEXT,
  location TEXT,
  responsible_person TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'procurement_tor', 'contracted', 'in_progress', 'delivered', 'inspected', 'completed', 'overdue')),
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ตารางข้อมูลการจัดทำ TOR และราคากลาง (project_tor)
CREATE TABLE IF NOT EXISTS public.project_tor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  tor_order_no TEXT,
  tor_order_date DATE,
  tor_author TEXT,
  tor_date DATE,
  ref_price_date DATE,
  ref_price NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ตารางคณะกรรมการต่างๆ (project_committees)
CREATE TABLE IF NOT EXISTS public.project_committees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  committee_type TEXT NOT NULL CHECK (committee_type IN ('tor', 'inspection', 'supervisor')),
  name TEXT NOT NULL,
  position TEXT,
  role TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ตารางข้อมูลคำสั่งควบคุมงานและตรวจรับงาน (project_orders)
CREATE TABLE IF NOT EXISTS public.project_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  order_no TEXT,
  order_date DATE,
  supervisor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ตารางข้อมูลสัญญาจ้าง (project_contracts)
CREATE TABLE IF NOT EXISTS public.project_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  contract_no TEXT UNIQUE NOT NULL,
  contract_date DATE,
  contract_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  contractor_name TEXT NOT NULL,
  contractor_tax_id VARCHAR(13),
  contractor_contact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ตารางแจ้งเข้าทำงานและความคืบหน้า (project_progress)
CREATE TABLE IF NOT EXISTS public.project_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  book_no TEXT,
  book_date DATE,
  actual_work_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ตารางการส่งมอบงานแต่ละงวด (project_deliveries)
CREATE TABLE IF NOT EXISTS public.project_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  installment INTEGER NOT NULL DEFAULT 1,
  book_no TEXT,
  book_date DATE,
  actual_delivery_date DATE,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ตารางการตรวจรับงาน (project_inspections)
CREATE TABLE IF NOT EXISTS public.project_inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  installment INTEGER NOT NULL DEFAULT 1,
  inspection_date DATE,
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'need_revision')),
  details TEXT,
  inspector_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ตารางการจัดทำฎีกาและการเบิกจ่ายเงิน (project_disbursements)
CREATE TABLE IF NOT EXISTS public.project_disbursements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  installment INTEGER NOT NULL DEFAULT 1,
  disbursement_date DATE,
  petition_no TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  check_no TEXT,
  transfer_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ตารางการเบิกค่าตอบแทนคณะกรรมการ (project_remunerations)
CREATE TABLE IF NOT EXISTS public.project_remunerations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  remuneration_type TEXT NOT NULL CHECK (remuneration_type IN ('tor', 'supervisor', 'inspection')),
  title TEXT NOT NULL,
  payee_name TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  withdraw_date DATE,
  petition_no TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ตารางเอกสารแนบ (project_attachments)
CREATE TABLE IF NOT EXISTS public.project_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  category TEXT NOT NULL CHECK (category IN ('tor', 'order', 'contract', 'notice', 'delivery', 'inspection', 'disbursement', 'remuneration', 'other')),
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_fiscal_year ON public.projects(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(budget_category);
CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON public.project_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_no ON public.project_contracts(contract_no);
CREATE INDEX IF NOT EXISTS idx_attachments_project_id ON public.project_attachments(project_id);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on projects" ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow staff and admin insert on projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'staff'))
  );

CREATE POLICY "Allow staff and admin update on projects" ON public.projects
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'staff'))
  );

CREATE POLICY "Allow only admin delete on projects" ON public.projects
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role = 'admin')
  );
