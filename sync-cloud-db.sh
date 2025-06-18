# Cloud Supabase Sync Script
# Replace these with your actual cloud database credentials

# Your cloud project details
CLOUD_PROJECT_REF="oflctqligzouzshimuqh"
CLOUD_DB_HOST="db.${CLOUD_PROJECT_REF}.supabase.co"
CLOUD_DB_PORT="5432"
CLOUD_DB_NAME="postgres"
CLOUD_DB_USER="postgres"

# You'll need to get the password from your Supabase dashboard:
# Go to Settings -> Database -> Connection parameters
# CLOUD_DB_PASSWORD="your-cloud-db-password"

echo "To get your cloud database password:"
echo "1. Go to https://supabase.com/dashboard/project/${CLOUD_PROJECT_REF}"
echo "2. Go to Settings -> Database"
echo "3. Copy the password from Connection parameters"
echo ""
echo "Then run these commands:"
echo ""
echo "# Dump cloud schema"
echo "pg_dump -h ${CLOUD_DB_HOST} -p ${CLOUD_DB_PORT} -U ${CLOUD_DB_USER} -d ${CLOUD_DB_NAME} --schema-only > cloud_schema.sql"
echo ""
echo "# Dump cloud data (optional)"
echo "pg_dump -h ${CLOUD_DB_HOST} -p ${CLOUD_DB_PORT} -U ${CLOUD_DB_USER} -d ${CLOUD_DB_NAME} --data-only > cloud_data.sql"
echo ""
echo "# Apply to local database"
echo "docker exec -i supabase-db psql -U postgres -d postgres < cloud_schema.sql"
echo "docker exec -i supabase-db psql -U postgres -d postgres < cloud_data.sql"
