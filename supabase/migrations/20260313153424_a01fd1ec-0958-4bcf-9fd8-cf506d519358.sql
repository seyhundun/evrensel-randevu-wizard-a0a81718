ALTER TABLE public.vfs_accounts
  ADD COLUMN IF NOT EXISTS captcha_waiting_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS captcha_manual_approved boolean DEFAULT false;