CREATE TABLE public.idata_city_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  office_name text NOT NULL,
  office_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city, office_value)
);

ALTER TABLE public.idata_city_offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to idata_city_offices" ON public.idata_city_offices FOR ALL TO public USING (true) WITH CHECK (true);

INSERT INTO public.idata_city_offices (city, office_name, office_value) VALUES
  ('Adana', 'Adana Ofis', 'adana'),
  ('Adana', 'Antalya Ofis', 'antalya'),
  ('Adana', 'İzmir Ofis', 'izmir'),
  ('Afyonkarahisar', 'Adana Ofis', 'adana'),
  ('Afyonkarahisar', 'Antalya Ofis', 'antalya'),
  ('Afyonkarahisar', 'İzmir Ofis', 'izmir'),
  ('Ankara', 'Ankara Ofis', 'ankara'),
  ('Ankara', 'Gaziantep Ofis', 'gaziantep');

ALTER PUBLICATION supabase_realtime ADD TABLE public.idata_city_offices;