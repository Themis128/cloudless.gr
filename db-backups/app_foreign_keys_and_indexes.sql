-- Foreign Keys

-- projects.owner_id → profiles.id
ALTER TABLE public.projects
  ADD CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- pipelines.project_id → projects.id
ALTER TABLE public.pipelines
  ADD CONSTRAINT fk_pipelines_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- pipelines.owner_id → profiles.id
ALTER TABLE public.pipelines
  ADD CONSTRAINT fk_pipelines_owner FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- training_sessions.project_id → projects.id
ALTER TABLE public.training_sessions
  ADD CONSTRAINT fk_training_sessions_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- training_sessions.owner_id → profiles.id
ALTER TABLE public.training_sessions
  ADD CONSTRAINT fk_training_sessions_owner FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- model_versions.project_id → projects.id
ALTER TABLE public.model_versions
  ADD CONSTRAINT fk_model_versions_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- model_versions.training_session_id → training_sessions.id
ALTER TABLE public.model_versions
  ADD CONSTRAINT fk_model_versions_training_session FOREIGN KEY (training_session_id) REFERENCES public.training_sessions(id) ON DELETE SET NULL;

-- model_versions.owner_id → profiles.id
ALTER TABLE public.model_versions
  ADD CONSTRAINT fk_model_versions_owner FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- deployments.project_id → projects.id
ALTER TABLE public.deployments
  ADD CONSTRAINT fk_deployments_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- deployments.model_version_id → model_versions.id
ALTER TABLE public.deployments
  ADD CONSTRAINT fk_deployments_model_version FOREIGN KEY (model_version_id) REFERENCES public.model_versions(id) ON DELETE CASCADE;

-- deployments.owner_id → profiles.id
ALTER TABLE public.deployments
  ADD CONSTRAINT fk_deployments_owner FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- datasets.project_id → projects.id
ALTER TABLE public.datasets
  ADD CONSTRAINT fk_datasets_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- datasets.owner_id → profiles.id
ALTER TABLE public.datasets
  ADD CONSTRAINT fk_datasets_owner FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- experiments.training_session_id → training_sessions.id
ALTER TABLE public.experiments
  ADD CONSTRAINT fk_experiments_training_session FOREIGN KEY (training_session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE;

-- experiments.owner_id → profiles.id
ALTER TABLE public.experiments
  ADD CONSTRAINT fk_experiments_owner FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- notifications.user_id → profiles.id
ALTER TABLE public.notifications
  ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Indexes

CREATE INDEX idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX idx_pipelines_project_id ON public.pipelines(project_id);
CREATE INDEX idx_pipelines_owner_id ON public.pipelines(owner_id);
CREATE INDEX idx_training_sessions_project_id ON public.training_sessions(project_id);
CREATE INDEX idx_training_sessions_owner_id ON public.training_sessions(owner_id);
CREATE INDEX idx_model_versions_project_id ON public.model_versions(project_id);
CREATE INDEX idx_model_versions_training_session_id ON public.model_versions(training_session_id);
CREATE INDEX idx_model_versions_owner_id ON public.model_versions(owner_id);
CREATE INDEX idx_deployments_project_id ON public.deployments(project_id);
CREATE INDEX idx_deployments_model_version_id ON public.deployments(model_version_id);
CREATE INDEX idx_deployments_owner_id ON public.deployments(owner_id);
CREATE INDEX idx_datasets_project_id ON public.datasets(project_id);
CREATE INDEX idx_datasets_owner_id ON public.datasets(owner_id);
CREATE INDEX idx_experiments_training_session_id ON public.experiments(training_session_id);
CREATE INDEX idx_experiments_owner_id ON public.experiments(owner_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
