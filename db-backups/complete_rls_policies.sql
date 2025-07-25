-- Enable Row Level Security for all tables
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
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DO $$ 
DECLARE
    tables CURSOR FOR 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public';
BEGIN
    FOR table_record IN tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "profiles_insert_own" ON public.%I', table_record.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "profiles_select_own" ON public.%I', table_record.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "profiles_service_role_all" ON public.%I', table_record.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "profiles_update_own" ON public.%I', table_record.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Allow user to manage own %I" ON public.%I', table_record.tablename, table_record.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Allow admins to manage %I" ON public.%I', table_record.tablename, table_record.tablename);
    END LOOP;
END $$;

-- Profiles policies
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Projects policies
CREATE POLICY "project_select_policy" ON public.projects
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "project_insert_policy" ON public.projects
    FOR INSERT WITH CHECK (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "project_update_policy" ON public.projects
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "project_delete_policy" ON public.projects
    FOR DELETE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Training Sessions policies
CREATE POLICY "training_sessions_select_policy" ON public.training_sessions
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND (
                p.owner_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    );

CREATE POLICY "training_sessions_insert_policy" ON public.training_sessions
    FOR INSERT WITH CHECK (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "training_sessions_update_policy" ON public.training_sessions
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "training_sessions_delete_policy" ON public.training_sessions
    FOR DELETE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Model Versions policies
CREATE POLICY "model_versions_select_policy" ON public.model_versions
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND (
                p.owner_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    );

CREATE POLICY "model_versions_insert_policy" ON public.model_versions
    FOR INSERT WITH CHECK (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "model_versions_update_policy" ON public.model_versions
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "model_versions_delete_policy" ON public.model_versions
    FOR DELETE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Deployments policies
CREATE POLICY "deployments_select_policy" ON public.deployments
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND (
                p.owner_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    );

CREATE POLICY "deployments_insert_policy" ON public.deployments
    FOR INSERT WITH CHECK (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "deployments_update_policy" ON public.deployments
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "deployments_delete_policy" ON public.deployments
    FOR DELETE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Datasets policies
CREATE POLICY "datasets_select_policy" ON public.datasets
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND (
                p.owner_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    );

CREATE POLICY "datasets_insert_policy" ON public.datasets
    FOR INSERT WITH CHECK (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "datasets_update_policy" ON public.datasets
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "datasets_delete_policy" ON public.datasets
    FOR DELETE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Notifications policies
CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "notifications_insert_policy" ON public.notifications
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "notifications_update_policy" ON public.notifications
    FOR UPDATE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Contact Messages policies (public insert, admin-only view)
CREATE POLICY "contact_messages_insert_policy" ON public.contact_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "contact_messages_select_policy" ON public.contact_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Audit Log policies (admin-only)
CREATE POLICY "audit_log_select_policy" ON public.audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "audit_log_insert_policy" ON public.audit_log
    FOR INSERT WITH CHECK (true);  -- Allow system to insert audit logs

-- Create function for checking admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;
