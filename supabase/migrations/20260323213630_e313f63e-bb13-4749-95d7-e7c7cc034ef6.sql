CREATE TABLE public.quiz_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'google',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  fail_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to quiz_accounts" ON public.quiz_accounts FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TRIGGER update_quiz_accounts_updated_at BEFORE UPDATE ON public.quiz_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();