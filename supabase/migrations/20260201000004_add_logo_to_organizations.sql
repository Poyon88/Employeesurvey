-- Add logo_url to organizations table
ALTER TABLE organizations ADD COLUMN logo_url TEXT;

-- Create a public storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users with admin/hr_management role to upload logos
CREATE POLICY "logos_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND (SELECT public.get_user_role()) IN ('admin', 'hr_management'));

-- Allow anyone to read logos (public bucket)
CREATE POLICY "logos_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'logos');

-- Allow admin/hr_management to delete logos
CREATE POLICY "logos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND (SELECT public.get_user_role()) IN ('admin', 'hr_management'));
