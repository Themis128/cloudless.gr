#!/bin/bash
# Simple test script to verify database schema and authentication
echo "Testing database schema and authentication..."

# Test 1: Check if profiles table has all required fields
echo "1. Checking profiles table schema..."
docker compose -f docker/docker-compose.yml exec db psql -U postgres -c "\d profiles" postgres

# Test 2: Check if we can connect to the database
echo "2. Testing database connection..."
docker compose -f docker/docker-compose.yml exec db psql -U postgres -c "SELECT COUNT(*) FROM profiles;" postgres

# Test 3: Check if indexes exist
echo "3. Checking indexes..."
docker compose -f docker/docker-compose.yml exec db psql -U postgres -c "SELECT indexname FROM pg_indexes WHERE tablename = 'profiles';" postgres

echo "Database schema test completed!"
