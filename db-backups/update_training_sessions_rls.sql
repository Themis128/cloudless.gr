-- Drop existing policy
DROP POLICY IF EXISTS "Allow user to manage own training_sessions" ON public.training_sessions;

-- Create new policy that checks both ownership and project access
CREATE POLICY "Allow user to manage own training_sessions and project"
  ON public.training_sessions
  FOR ALL
  USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.model_versions mv 
      WHERE mv.id = training_sessions.model_version_id 
      AND mv.owner_id = auth.uid()
    )
  );

-- Add index to improve policy performance
CREATE INDEX IF NOT EXISTS idx_training_sessions_model_version_id 
  ON public.training_sessions(model_version_id);
