GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;

GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO postgres;

GRANT ALL ON FUNCTION public.clear_reset_token(user_email text) TO anon;
GRANT ALL ON FUNCTION public.clear_reset_token(user_email text) TO authenticated;

GRANT ALL ON FUNCTION public.clear_reset_token(user_email text) TO service_role;


--
-- Name: FUNCTION generate_reset_token(user_email text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_reset_token(user_email text) TO anon;

GRANT ALL ON FUNCTION public.generate_reset_token(user_email text) TO authenticated;
GRANT ALL ON FUNCTION public.generate_reset_token(user_email text) TO service_role;

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_updated_at() TO anon;

GRANT ALL ON FUNCTION public.handle_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.handle_updated_at() TO service_role;

GRANT ALL ON FUNCTION public.handle_user_update() TO anon;
GRANT ALL ON FUNCTION public.handle_user_update() TO authenticated;

GRANT ALL ON FUNCTION public.handle_user_update() TO service_role;


--
-- Name: FUNCTION increment_failed_login(user_email text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.increment_failed_login(user_email text) TO anon;

GRANT ALL ON FUNCTION public.increment_failed_login(user_email text) TO authenticated;
GRANT ALL ON FUNCTION public.increment_failed_login(user_email text) TO service_role;

GRANT ALL ON FUNCTION public.is_account_locked(user_email text) TO anon;
GRANT ALL ON FUNCTION public.is_account_locked(user_email text) TO authenticated;

GRANT ALL ON FUNCTION public.is_account_locked(user_email text) TO service_role;


--
-- Name: FUNCTION is_admin(user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin(user_id uuid) TO anon;

GRANT ALL ON FUNCTION public.is_admin(user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_admin(user_id uuid) TO service_role;

GRANT ALL ON FUNCTION public.is_user_locked(user_email text) TO anon;
GRANT ALL ON FUNCTION public.is_user_locked(user_email text) TO authenticated;

GRANT ALL ON FUNCTION public.is_user_locked(user_email text) TO service_role;


--
-- Name: FUNCTION now_greek(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.now_greek() TO anon;

GRANT ALL ON FUNCTION public.now_greek() TO authenticated;
GRANT ALL ON FUNCTION public.now_greek() TO service_role;

GRANT ALL ON FUNCTION public.reset_failed_login(user_email text) TO anon;
GRANT ALL ON FUNCTION public.reset_failed_login(user_email text) TO authenticated;

GRANT ALL ON FUNCTION public.reset_failed_login(user_email text) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;

GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;

GRANT ALL ON FUNCTION public.to_greek_time(input_timestamp timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.to_greek_time(input_timestamp timestamp with time zone) TO authenticated;

GRANT ALL ON FUNCTION public.to_greek_time(input_timestamp timestamp with time zone) TO service_role;


--
-- Name: FUNCTION verify_reset_token(token text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.verify_reset_token(token text) TO anon;

GRANT ALL ON FUNCTION public.verify_reset_token(token text) TO authenticated;
GRANT ALL ON FUNCTION public.verify_reset_token(token text) TO service_role;

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;

GRANT ALL ON FUNCTION supabase_functions.http_request() TO anon;
GRANT ALL ON FUNCTION supabase_functions.http_request() TO authenticated;

GRANT ALL ON FUNCTION supabase_functions.http_request() TO service_role;
GRANT ALL ON FUNCTION supabase_functions.http_request() TO postgres;

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;

SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.flow_state TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.identities TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.instances TO postgres;

GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.refresh_tokens TO postgres;

GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT ALL ON TABLE auth.schema_migrations TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.schema_migrations TO postgres;

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.sessions TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.users TO postgres;

GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;

GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;
RESET SESSION AUTHORIZATION;

GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;


--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE public.analytics_pipelines TO anon;
GRANT ALL ON TABLE public.analytics_pipelines TO authenticated;

GRANT ALL ON TABLE public.analytics_pipelines TO service_role;


--
-- Name: TABLE contact_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contact_messages TO anon;

GRANT ALL ON TABLE public.contact_messages TO authenticated;
GRANT ALL ON TABLE public.contact_messages TO service_role;

GRANT ALL ON SEQUENCE public.contact_messages_id_seq TO anon;
GRANT ALL ON SEQUENCE public.contact_messages_id_seq TO authenticated;

GRANT ALL ON SEQUENCE public.contact_messages_id_seq TO service_role;


--
-- Name: TABLE data_sources; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.data_sources TO anon;

GRANT ALL ON TABLE public.data_sources TO authenticated;
GRANT ALL ON TABLE public.data_sources TO service_role;

GRANT ALL ON TABLE public.deployments TO anon;
GRANT ALL ON TABLE public.deployments TO authenticated;

GRANT ALL ON TABLE public.deployments TO service_role;


--
-- Name: TABLE model_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.model_versions TO anon;

GRANT ALL ON TABLE public.model_versions TO authenticated;
GRANT ALL ON TABLE public.model_versions TO service_role;

GRANT ALL ON TABLE public.pipeline_executions TO anon;
GRANT ALL ON TABLE public.pipeline_executions TO authenticated;

GRANT ALL ON TABLE public.pipeline_executions TO service_role;


--
-- Name: TABLE pipeline_step_executions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pipeline_step_executions TO anon;

GRANT ALL ON TABLE public.pipeline_step_executions TO authenticated;
GRANT ALL ON TABLE public.pipeline_step_executions TO service_role;

GRANT ALL ON TABLE public.pipeline_steps TO anon;
GRANT ALL ON TABLE public.pipeline_steps TO authenticated;

GRANT ALL ON TABLE public.pipeline_steps TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;

GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

GRANT ALL ON TABLE public.projects TO anon;
GRANT ALL ON TABLE public.projects TO authenticated;

GRANT ALL ON TABLE public.projects TO service_role;


--
-- Name: TABLE training_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.training_sessions TO anon;

GRANT ALL ON TABLE public.training_sessions TO authenticated;
GRANT ALL ON TABLE public.training_sessions TO service_role;

GRANT ALL ON TABLE public.userinfo TO anon;
GRANT ALL ON TABLE public.userinfo TO authenticated;

GRANT ALL ON TABLE public.userinfo TO service_role;


--
-- Name: TABLE validation_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.validation_rules TO anon;

GRANT ALL ON TABLE public.validation_rules TO authenticated;
GRANT ALL ON TABLE public.validation_rules TO service_role;

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;

GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;

GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.schema_migrations TO postgres;

GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;
GRANT SELECT ON TABLE realtime.schema_migrations TO anon;
