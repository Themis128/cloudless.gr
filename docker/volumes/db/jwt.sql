-- Set custom JWT configuration for Supabase
\set jwt_secret 'eOvlpJPRGfQkptMLRFSfCPerPR5MkrekkpIuLqXd'
\set jwt_exp `echo "${JWT_EXP:-3600}"`

-- Configure database settings
ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwt_secret';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';

-- Verify the settings
SELECT 'JWT Configuration Set:' as status;
SHOW "app.settings.jwt_secret";
SHOW "app.settings.jwt_exp";
