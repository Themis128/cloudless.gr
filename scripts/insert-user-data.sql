-- Insert user profile and info data
INSERT INTO public.profiles (id, role) 
VALUES ('750226cb-5f6c-4341-a32f-624dfa1408bf', 'user') 
ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role, 
    updated_at = NOW();

INSERT INTO public."user-info" (id, full_name) 
VALUES ('750226cb-5f6c-4341-a32f-624dfa1408bf', 'Themistoklis Baltzakis') 
ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name, 
    updated_at = NOW();
