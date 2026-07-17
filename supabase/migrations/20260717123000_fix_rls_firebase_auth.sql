-- Helper function to get the current Firebase user UID as text
CREATE OR REPLACE FUNCTION public.auth_uid()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
$$;

-- Drop old UUID-based policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Faculty manage own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Faculty manage own questions" ON public.questions;
DROP POLICY IF EXISTS "Faculty delete own session participants" ON public.participants;

-- Recreate policies with the new public.auth_uid() text helper (without forcing "TO authenticated")
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (public.auth_uid() = user_id);

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (public.auth_uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (public.auth_uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (public.auth_uid() = id);

CREATE POLICY "Faculty manage own sessions" ON public.sessions FOR ALL
  USING (public.auth_uid() = creator_id) WITH CHECK (public.auth_uid() = creator_id);

CREATE POLICY "Faculty manage own questions" ON public.questions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.creator_id = public.auth_uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.creator_id = public.auth_uid()));

CREATE POLICY "Faculty delete own session participants" ON public.participants FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.creator_id = public.auth_uid()));
