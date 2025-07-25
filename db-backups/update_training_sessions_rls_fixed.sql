-- Drop existing policy
DROP POLICY IF EXISTS "Allow user to manage own training_sessions" ON public.training_sessions;

-- Create new policy that checks both ownership and project access
CREATE POLICY "Allow user to manage own training_sessions and project"
  ON public.training_sessions
  FOR ALL
  USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = training_sessions.project_id 
      AND p.owner_id = auth.uid()
    )
  );
