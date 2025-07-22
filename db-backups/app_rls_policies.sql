-- Enable RLS and add policies for frontend access to custom tables

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "Allow user to read own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Allow user to update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

-- user_profiles policies
CREATE POLICY "Allow user to read own user_profile"
  ON public.user_profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Allow user to update own user_profile"
  ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid());

-- projects policies
CREATE POLICY "Allow user to manage own projects"
  ON public.projects
  FOR ALL
  USING (owner_id = auth.uid());

-- pipelines policies
CREATE POLICY "Allow user to manage own pipelines"
  ON public.pipelines
  FOR ALL
  USING (owner_id = auth.uid());

-- training_sessions policies
CREATE POLICY "Allow user to manage own training_sessions"
  ON public.training_sessions
  FOR ALL
  USING (owner_id = auth.uid());

-- model_versions policies
CREATE POLICY "Allow user to manage own model_versions"
  ON public.model_versions
  FOR ALL
  USING (owner_id = auth.uid());

-- deployments policies
CREATE POLICY "Allow user to manage own deployments"
  ON public.deployments
  FOR ALL
  USING (owner_id = auth.uid());

-- datasets policies
CREATE POLICY "Allow user to manage own datasets"
  ON public.datasets
  FOR ALL
  USING (owner_id = auth.uid());

-- experiments policies
CREATE POLICY "Allow user to manage own experiments"
  ON public.experiments
  FOR ALL
  USING (owner_id = auth.uid());

-- contact_messages: allow anyone to insert (for public contact form)
CREATE POLICY "Allow anyone to insert contact messages"
  ON public.contact_messages
  FOR INSERT
  WITH CHECK (true);

-- notifications policies
CREATE POLICY "Allow user to read own notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Allow user to update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid());
