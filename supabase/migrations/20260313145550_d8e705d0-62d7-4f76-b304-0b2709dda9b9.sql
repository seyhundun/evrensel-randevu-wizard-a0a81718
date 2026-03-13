ALTER TABLE public.tracking_configs ADD COLUMN IF NOT EXISTS cf_retry_requested boolean NOT NULL DEFAULT false;
ALTER TABLE public.tracking_configs ADD COLUMN IF NOT EXISTS cf_blocked_since timestamp with time zone DEFAULT NULL;
ALTER TABLE public.tracking_configs ADD COLUMN IF NOT EXISTS cf_blocked_ip text DEFAULT NULL;