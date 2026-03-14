
-- VFS hedef ülkeleri tablosu
CREATE TABLE public.vfs_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  flag text NOT NULL DEFAULT '',
  code text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vfs_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to vfs_countries" ON public.vfs_countries FOR ALL TO public USING (true) WITH CHECK (true);

-- Bot ayarları tablosu (proxy ülkesi vb.)
CREATE TABLE public.bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  label text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to bot_settings" ON public.bot_settings FOR ALL TO public USING (true) WITH CHECK (true);

-- Varsayılan ülkeleri ekle
INSERT INTO public.vfs_countries (value, label, flag, code, sort_order) VALUES
  ('france', 'Fransa', '🇫🇷', 'fra', 1),
  ('netherlands', 'Hollanda', '🇳🇱', 'nld', 2),
  ('denmark', 'Danimarka', '🇩🇰', 'dnk', 3);

-- Varsayılan bot ayarları
INSERT INTO public.bot_settings (key, value, label) VALUES
  ('proxy_country', 'TR', 'Proxy Ülkesi'),
  ('proxy_host', 'core-residential.evomi-proxy.com', 'Proxy Host'),
  ('proxy_port', '1001', 'Proxy Port');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vfs_countries;
