ALTER TABLE public.idata_accounts ADD COLUMN IF NOT EXISTS imap_host text DEFAULT 'imap.gmail.com';
ALTER TABLE public.idata_accounts ADD COLUMN IF NOT EXISTS imap_password text DEFAULT NULL;