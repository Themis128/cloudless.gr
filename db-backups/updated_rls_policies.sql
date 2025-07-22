-- Drop existing policies
DROP POLICY IF EXISTS "Allow user to read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow user to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow user to read own user_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow user to update own user_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow user to manage own projects" ON public.projects;
DROP POLICY IF EXISTS "Allow user to manage own pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Allow user to manage own training_sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Allow user to manage own model_versions" ON public.model_versions;
DROP POLICY IF EXISTS "Allow user to manage own deployments" ON public.deployments;
DROP POLICY IF EXISTS "Allow user to manage own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Allow user to manage own experiments" ON public.experiments;
DROP POLICY IF EXISTS "Allow anyone to insert contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow user to read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow user to update own notifications" ON public.notifications;

-- Enable RLS on all tables
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

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Allow admins full access to profiles"
  ON public.profiles
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to read own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Allow users to update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- User profiles policies with admin access
CREATE POLICY "Allow admins full access to user_profiles"
  ON public.user_profiles
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to read own user_profile"
  ON public.user_profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Allow users to update own user_profile"
  ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Projects policies with admin access and team sharing
CREATE POLICY "Allow admins full access to projects"
  ON public.projects
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to manage own projects"
  ON public.projects
  FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Allow team members to access shared projects"
  ON public.projects
  FOR SELECT
  USING (
    id IN (
      SELECT project_id 
      FROM public.project_members 
      WHERE user_id = auth.uid()
    )
  );

-- Pipelines policies with admin access
CREATE POLICY "Allow admins full access to pipelines"
  ON public.pipelines
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to manage own pipelines"
  ON public.pipelines
  FOR ALL
  USING (owner_id = auth.uid());

-- Training sessions policies with admin access
CREATE POLICY "Allow admins full access to training_sessions"
  ON public.training_sessions
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to manage own training_sessions"
  ON public.training_sessions
  FOR ALL
  USING (owner_id = auth.uid());

-- Model versions policies with admin access
CREATE POLICY "Allow admins full access to model_versions"
  ON public.model_versions
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to manage own model_versions"
  ON public.model_versions
  FOR ALL
  USING (owner_id = auth.uid());

-- Deployments policies with admin access
CREATE POLICY "Allow admins full access to deployments"
  ON public.deployments
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to manage own deployments"
  ON public.deployments
  FOR ALL
  USING (owner_id = auth.uid());

-- Datasets policies with admin access and sharing
CREATE POLICY "Allow admins full access to datasets"
  ON public.datasets
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to manage own datasets"
  ON public.datasets
  FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Allow users to access shared datasets"
  ON public.datasets
  FOR SELECT
  USING (is_public = true OR owner_id = auth.uid());

-- Experiments policies with admin access
CREATE POLICY "Allow admins full access to experiments"
  ON public.experiments
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to manage own experiments"
  ON public.experiments
  FOR ALL
  USING (owner_id = auth.uid());

-- Contact messages policies
CREATE POLICY "Allow admins to manage contact messages"
  ON public.contact_messages
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow anyone to insert contact messages"
  ON public.contact_messages
  FOR INSERT
  WITH CHECK (true);

-- Notifications policies with admin access
CREATE POLICY "Allow admins full access to notifications"
  ON public.notifications
  FOR ALL
  USING (is_admin());

CREATE POLICY "Allow users to read own notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Allow users to update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add indexes to improve RLS policy performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_is_active ON public.profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_owner_id ON public.pipelines(owner_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_owner_id ON public.training_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_owner_id ON public.model_versions(owner_id);
CREATE INDEX IF NOT EXISTS idx_deployments_owner_id ON public.deployments(owner_id);
CREATE INDEX IF NOT EXISTS idx_datasets_owner_id_is_public ON public.datasets(owner_id, is_public);
CREATE INDEX IF NOT EXISTS idx_experiments_owner_id ON public.experiments(owner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
