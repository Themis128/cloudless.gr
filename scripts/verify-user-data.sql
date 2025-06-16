-- Verify user data
SELECT 
    p.id, 
    p.role, 
    p.created_at as profile_created,
    ui.full_name,
    ui.created_at as info_created
FROM public.profiles p 
LEFT JOIN public."user-info" ui ON p.id = ui.id 
WHERE p.id = '750226cb-5f6c-4341-a32f-624dfa1408bf';
