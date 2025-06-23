CREATE INDEX idx_analytics_pipelines_status ON public.analytics_pipelines USING btree (status);


--
-- Name: idx_data_sources_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_data_sources_owner_id ON public.data_sources USING btree (owner_id);

CREATE INDEX idx_data_sources_project_id ON public.data_sources USING btree (project_id);


--
-- Name: idx_data_sources_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_data_sources_type ON public.data_sources USING btree (source_type);

CREATE INDEX idx_deployments_model_version ON public.deployments USING btree (model_version_id);


--
-- Name: idx_model_versions_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_model_versions_project ON public.model_versions USING btree (project_id);

CREATE INDEX idx_pipeline_executions_executed_by ON public.pipeline_executions USING btree (executed_by);


--
-- Name: idx_pipeline_executions_pipeline_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipeline_executions_pipeline_id ON public.pipeline_executions USING btree (pipeline_id);

CREATE INDEX idx_pipeline_executions_status ON public.pipeline_executions USING btree (status);


--
-- Name: idx_pipeline_step_executions_execution_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipeline_step_executions_execution_id ON public.pipeline_step_executions USING btree (execution_id);

CREATE INDEX idx_pipeline_step_executions_step_id ON public.pipeline_step_executions USING btree (step_id);


--
-- Name: idx_pipeline_steps_pipeline_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipeline_steps_pipeline_id ON public.pipeline_steps USING btree (pipeline_id);

CREATE INDEX idx_pipeline_steps_position ON public.pipeline_steps USING btree (pipeline_id, "position");


--
-- Name: idx_pipeline_steps_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipeline_steps_type ON public.pipeline_steps USING btree (step_type);

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);


--
-- Name: idx_profiles_email_verification_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_email_verification_token ON public.profiles USING btree (email_verification_token);

CREATE INDEX idx_profiles_email_verified ON public.profiles USING btree (email_verified);


--
-- Name: idx_profiles_failed_login_attempts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_failed_login_attempts ON public.profiles USING btree (failed_login_attempts);

CREATE INDEX idx_profiles_locked_until ON public.profiles USING btree (locked_until);


--
-- Name: idx_profiles_reset_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_reset_token ON public.profiles USING btree (reset_token);

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_projects_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_owner ON public.projects USING btree (owner_id);

CREATE INDEX idx_projects_status ON public.projects USING btree (status);


--
-- Name: idx_projects_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_type ON public.projects USING btree (type);

CREATE INDEX idx_training_sessions_project ON public.training_sessions USING btree (project_id);


--
-- Name: idx_training_sessions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_sessions_status ON public.training_sessions USING btree (status);

CREATE INDEX idx_userinfo_name ON public.userinfo USING btree (full_name);


--
-- Name: idx_validation_rules_step_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_validation_rules_step_id ON public.validation_rules USING btree (step_id);

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);

CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name);


--
-- Name: supabase_functions_hooks_request_id_idx; Type: INDEX; Schema: supabase_functions; Owner: supabase_functions_admin
--

CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id);

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: users on_auth_user_updated; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER on_auth_user_updated AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: analytics_pipelines set_analytics_pipelines_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_analytics_pipelines_updated_at BEFORE UPDATE ON public.analytics_pipelines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_data_sources_updated_at BEFORE UPDATE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pipeline_steps set_pipeline_steps_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_pipeline_steps_updated_at BEFORE UPDATE ON public.pipeline_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

ALTER TABLE ONLY _realtime.extensions
    ADD CONSTRAINT extensions_tenant_external_id_fkey FOREIGN KEY (tenant_external_id) REFERENCES _realtime.tenants(external_id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.analytics_pipelines
    ADD CONSTRAINT analytics_pipelines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_model_version_id_fkey FOREIGN KEY (model_version_id) REFERENCES public.model_versions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.model_versions
    ADD CONSTRAINT model_versions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.model_versions
    ADD CONSTRAINT model_versions_training_session_id_fkey FOREIGN KEY (training_session_id) REFERENCES public.training_sessions(id);

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT pipeline_executions_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.analytics_pipelines(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pipeline_step_executions
    ADD CONSTRAINT pipeline_step_executions_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.pipeline_executions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pipeline_step_executions
    ADD CONSTRAINT pipeline_step_executions_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.pipeline_steps(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pipeline_steps
    ADD CONSTRAINT pipeline_steps_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.analytics_pipelines(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.validation_rules
    ADD CONSTRAINT validation_rules_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.pipeline_steps(id) ON DELETE CASCADE;

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can access all profiles" ON public.profiles TO service_role USING (true);


--
-- Name: pipeline_executions Users can create pipeline executions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create pipeline executions" ON public.pipeline_executions FOR INSERT WITH CHECK (((auth.uid())::text = (executed_by)::text));

CREATE POLICY "Users can create their own pipelines" ON public.analytics_pipelines FOR INSERT WITH CHECK (((auth.uid())::text = (owner_id)::text));


--
-- Name: analytics_pipelines Users can delete their own pipelines; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own pipelines" ON public.analytics_pipelines FOR DELETE USING (((auth.uid())::text = (owner_id)::text));

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: pipeline_steps Users can manage pipeline steps; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage pipeline steps" ON public.pipeline_steps USING ((EXISTS ( SELECT 1
   FROM public.analytics_pipelines
  WHERE ((analytics_pipelines.id = pipeline_steps.pipeline_id) AND ((analytics_pipelines.owner_id)::text = (auth.uid())::text)))));

CREATE POLICY "Users can manage their data sources" ON public.data_sources USING (((auth.uid())::text = (owner_id)::text));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can update their own pipelines" ON public.analytics_pipelines FOR UPDATE USING (((auth.uid())::text = (owner_id)::text));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));

CREATE POLICY "Users can view pipeline steps" ON public.pipeline_steps FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.analytics_pipelines
  WHERE ((analytics_pipelines.id = pipeline_steps.pipeline_id) AND ((analytics_pipelines.owner_id)::text = (auth.uid())::text)))));

CREATE POLICY "Users can view their data sources" ON public.data_sources FOR SELECT USING (((auth.uid())::text = (owner_id)::text));


--
-- Name: analytics_pipelines Users can view their own pipelines; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own pipelines" ON public.analytics_pipelines FOR SELECT USING (((auth.uid())::text = (owner_id)::text));

CREATE POLICY "Users can view their pipeline executions" ON public.pipeline_executions FOR SELECT USING (((auth.uid())::text = (executed_by)::text));


--
-- Name: analytics_pipelines; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.analytics_pipelines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: deployments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_executions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pipeline_executions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pipeline_step_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_steps; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pipeline_steps ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_user_policy ON public.projects USING ((auth.uid() = owner_id));


--
-- Name: training_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.userinfo ENABLE ROW LEVEL SECURITY;

--
-- Name: validation_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--
