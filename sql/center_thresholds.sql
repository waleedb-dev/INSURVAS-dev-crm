-- ============================================
-- CENTER THRESHOLDS TABLE & POLICIES
-- ============================================

-- Create center_thresholds table
CREATE TABLE IF NOT EXISTS public.center_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  center_name text NOT NULL,
  lead_vendor text NOT NULL,
  tier text NULL DEFAULT 'C'::text,
  daily_transfer_target integer NULL DEFAULT 10,
  daily_sales_target integer NULL DEFAULT 5,
  max_dq_percentage numeric(5, 2) NULL DEFAULT 20.00,
  min_approval_ratio numeric(5, 2) NULL DEFAULT 20.00,
  transfer_weight integer NULL DEFAULT 40,
  approval_ratio_weight integer NULL DEFAULT 35,
  dq_weight integer NULL DEFAULT 25,
  is_active boolean NULL DEFAULT true,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  slack_webhook_url text NULL,
  slack_channel text NULL,
  slack_manager_id text NULL,
  underwriting_threshold integer NULL DEFAULT 5,
  slack_channel_id text NULL,
  CONSTRAINT center_thresholds_pkey PRIMARY KEY (id),
  CONSTRAINT center_thresholds_center_name_key UNIQUE (center_name),
  CONSTRAINT center_thresholds_lead_vendor_key UNIQUE (lead_vendor),
  CONSTRAINT center_thresholds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT center_thresholds_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users (id),
  CONSTRAINT center_thresholds_tier_check CHECK (
    tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])
  )
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_center_thresholds_lead_vendor ON public.center_thresholds USING btree (lead_vendor) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_center_thresholds_tier ON public.center_thresholds USING btree (tier) TABLESPACE pg_default;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_center_thresholds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_center_thresholds_updated_at ON public.center_thresholds;
CREATE TRIGGER set_center_thresholds_updated_at
  BEFORE UPDATE ON public.center_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_center_thresholds_updated_at();

-- ============================================
-- RLS POLICIES FOR SYSTEM_ADMIN
-- ============================================

-- Enable RLS
ALTER TABLE public.center_thresholds ENABLE ROW LEVEL SECURITY;

-- Grant basic permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.center_thresholds TO authenticated;

-- Policy: SELECT for system_admin
DROP POLICY IF EXISTS center_thresholds_select_system_admin ON public.center_thresholds;
CREATE POLICY center_thresholds_select_system_admin
ON public.center_thresholds
FOR SELECT
TO authenticated
USING (public.has_role('system_admin'));

-- Policy: SELECT for publisher_manager
DROP POLICY IF EXISTS center_thresholds_select_publisher_manager ON public.center_thresholds;
CREATE POLICY center_thresholds_select_publisher_manager
ON public.center_thresholds
FOR SELECT
TO authenticated
USING (public.has_role('publisher_manager'));

-- Policy: SELECT for sales_manager
DROP POLICY IF EXISTS center_thresholds_select_sales_manager ON public.center_thresholds;
CREATE POLICY center_thresholds_select_sales_manager
ON public.center_thresholds
FOR SELECT
TO authenticated
USING (public.has_role('sales_manager'));

-- Policy: INSERT for system_admin
DROP POLICY IF EXISTS center_thresholds_insert_system_admin ON public.center_thresholds;
CREATE POLICY center_thresholds_insert_system_admin
ON public.center_thresholds
FOR INSERT
TO authenticated
WITH CHECK (public.has_role('system_admin'));

-- Policy: UPDATE for system_admin
DROP POLICY IF EXISTS center_thresholds_update_system_admin ON public.center_thresholds;
CREATE POLICY center_thresholds_update_system_admin
ON public.center_thresholds
FOR UPDATE
TO authenticated
USING (public.has_role('system_admin'))
WITH CHECK (public.has_role('system_admin'));

-- Policy: UPDATE for publisher_manager
DROP POLICY IF EXISTS center_thresholds_update_publisher_manager ON public.center_thresholds;
CREATE POLICY center_thresholds_update_publisher_manager
ON public.center_thresholds
FOR UPDATE
TO authenticated
USING (public.has_role('publisher_manager'))
WITH CHECK (public.has_role('publisher_manager'));

-- Policy: UPDATE for sales_manager
DROP POLICY IF EXISTS center_thresholds_update_sales_manager ON public.center_thresholds;
CREATE POLICY center_thresholds_update_sales_manager
ON public.center_thresholds
FOR UPDATE
TO authenticated
USING (public.has_role('sales_manager'))
WITH CHECK (public.has_role('sales_manager'));

-- Policy: DELETE for system_admin
DROP POLICY IF EXISTS center_thresholds_delete_system_admin ON public.center_thresholds;
CREATE POLICY center_thresholds_delete_system_admin
ON public.center_thresholds
FOR DELETE
TO authenticated
USING (public.has_role('system_admin'));
