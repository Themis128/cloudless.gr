    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);

ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);

ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);

ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);

ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);

ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);

ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);

ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: analytics_pipelines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analytics_pipelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    name character varying(255) NOT NULL,
    description text,
    version character varying(50) DEFAULT '1.0.0'::character varying,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT analytics_pipelines_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'archived'::character varying, 'failed'::character varying])::text[])))
);

ALTER TABLE public.analytics_pipelines OWNER TO postgres;

--
-- Name: TABLE analytics_pipelines; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.analytics_pipelines IS 'Stores analytics pipeline configurations for the pipeline builder';

CREATE TABLE public.contact_messages (
    id bigint NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.contact_messages OWNER TO postgres;

--
-- Name: contact_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contact_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.data_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    name character varying(255) NOT NULL,
    source_type character varying(50) NOT NULL,
    connection_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    schema_info jsonb,
    sample_data jsonb,
    is_active boolean DEFAULT true,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT data_sources_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['file'::character varying, 'database'::character varying, 'api'::character varying, 'cloud'::character varying])::text[])))
);

ALTER TABLE public.data_sources OWNER TO postgres;

--
-- Name: TABLE data_sources; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.data_sources IS 'Data source configurations for pipeline inputs';

CREATE TABLE public.deployments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_version_id uuid,
    name text NOT NULL,
    status text,
    endpoint_url text,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT deployments_status_check CHECK ((status = ANY (ARRAY['deploying'::text, 'running'::text, 'stopped'::text, 'failed'::text])))
);

ALTER TABLE public.deployments OWNER TO postgres;

--
-- Name: model_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    training_session_id uuid,
    version text NOT NULL,
    model_path text,
    metrics jsonb DEFAULT '{}'::jsonb,
    is_deployed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.model_versions OWNER TO postgres;

--
-- Name: pipeline_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_seconds integer,
    logs text,
    error_message text,
    results jsonb,
    executed_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pipeline_executions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);

ALTER TABLE public.pipeline_executions OWNER TO postgres;

--
-- Name: TABLE pipeline_executions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pipeline_executions IS 'Execution history and results of pipeline runs';

CREATE TABLE public.pipeline_step_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid,
    step_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_seconds integer,
    input_data jsonb,
    output_data jsonb,
    error_message text,
    logs text,
    CONSTRAINT pipeline_step_executions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'skipped'::character varying])::text[])))
);

ALTER TABLE public.pipeline_step_executions OWNER TO postgres;

--
-- Name: pipeline_steps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid,
    step_type character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "position" integer NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_configured boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pipeline_steps_step_type_check CHECK (((step_type)::text = ANY ((ARRAY['DataInput'::character varying, 'DataValidation'::character varying, 'SmartProcessing'::character varying, 'MLAnalytics'::character varying, 'Visualization'::character varying, 'ReportGeneration'::character varying])::text[])))
);

ALTER TABLE public.pipeline_steps OWNER TO postgres;

--
-- Name: TABLE pipeline_steps; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pipeline_steps IS 'Individual steps within analytics pipelines';

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email text,
    full_name text,
    avatar_url text,
    email_verified boolean DEFAULT false,
    last_login timestamp with time zone,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    reset_token text,
    reset_token_expires timestamp with time zone,
    email_verification_token text,
    is_active boolean DEFAULT true,
    CONSTRAINT check_failed_login_attempts_positive CHECK ((failed_login_attempts >= 0)),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'user'::text])))
);

ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.email_verified; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.email_verified IS 'Whether the user has verified their email address';

COMMENT ON COLUMN public.profiles.last_login IS 'Timestamp of the last successful login';


--
-- Name: COLUMN profiles.failed_login_attempts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.failed_login_attempts IS 'Number of consecutive failed login attempts';

COMMENT ON COLUMN public.profiles.locked_until IS 'Timestamp until which the account is locked due to failed login attempts';


--
-- Name: COLUMN profiles.reset_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.reset_token IS 'Token for password reset requests';

COMMENT ON COLUMN public.profiles.reset_token_expires IS 'Expiration timestamp for the reset token';


--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    type text,
    framework text,
    config jsonb DEFAULT '{}'::jsonb,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'draft'::character varying,
    CONSTRAINT projects_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'training'::character varying, 'deployed'::character varying, 'completed'::character varying, 'error'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT projects_type_check CHECK ((type = ANY (ARRAY['cv'::text, 'nlp'::text, 'regression'::text, 'recommendation'::text, 'time-series'::text, 'custom'::text])))
);

ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: COLUMN projects.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.projects.status IS 'Current status of the project for UI display';

CREATE TABLE public.training_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    name text NOT NULL,
    status text,
    config jsonb DEFAULT '{}'::jsonb,
    metrics jsonb DEFAULT '{}'::jsonb,
    logs text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT training_sessions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);

ALTER TABLE public.training_sessions OWNER TO postgres;

--
-- Name: userinfo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.userinfo (
    id uuid NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.userinfo OWNER TO postgres;

--
-- Name: validation_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.validation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_id uuid,
    rule_type character varying(100) NOT NULL,
    field_name character varying(255),
    rule_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT validation_rules_rule_type_check CHECK (((rule_type)::text = ANY ((ARRAY['required'::character varying, 'data_type'::character varying, 'range'::character varying, 'pattern'::character varying, 'custom'::character varying])::text[])))
);

ALTER TABLE public.validation_rules OWNER TO postgres;

--
-- Name: TABLE validation_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.validation_rules IS 'Validation rules for pipeline steps';

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);

ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);

ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

