-- Security Helper for Firebase Auth
CREATE OR REPLACE FUNCTION public.auth_uid()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::json->>'sub', ''),
    nullif(current_setting('request.headers', true)::json->>'x-firebase-uid', '')
  )::text;
$$;

-- Role enum + user_roles
CREATE TYPE public.app_role AS ENUM ('faculty', 'admin');

-- Profiles (id is TEXT for Firebase)
CREATE TABLE public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated, anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (public.auth_uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (public.auth_uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (public.auth_uid() = id);

-- Note: We REMOVED the `handle_new_user()` trigger on `auth.users` because Firebase users are not in Supabase `auth.users`. 
-- The React frontend (auth.tsx) handles inserting the profile manually on first login!

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'faculty',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated, anon;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (public.auth_uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id text, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Sessions
CREATE TYPE public.session_status AS ENUM ('draft', 'live', 'ended');

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  creator_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.session_status NOT NULL DEFAULT 'draft',
  current_question_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated, anon;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Faculty manage own sessions" ON public.sessions FOR ALL 
  USING (public.auth_uid() = creator_id) WITH CHECK (public.auth_uid() = creator_id);

-- Questions
CREATE TYPE public.question_type AS ENUM ('wordcloud', 'poll', 'quiz');

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  type public.question_type NOT NULL,
  title TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated, anon;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Faculty manage own questions" ON public.questions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.creator_id = public.auth_uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.creator_id = public.auth_uid()));

ALTER TABLE public.sessions ADD CONSTRAINT sessions_current_question_fk
  FOREIGN KEY (current_question_id) REFERENCES public.questions(id) ON DELETE SET NULL;

-- Participants
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated, anon;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join a session" ON public.participants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.status IN ('live','draft'))
);
CREATE POLICY "Faculty delete own session participants" ON public.participants FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.creator_id = public.auth_uid()));

-- Responses
CREATE TABLE public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses TO authenticated, anon;
GRANT ALL ON public.responses TO service_role;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view responses" ON public.responses FOR SELECT USING (true);
CREATE POLICY "Anyone submit response" ON public.responses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.questions q JOIN public.sessions s ON s.id = q.session_id
          WHERE q.id = question_id AND s.status = 'live')
);

-- Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;
