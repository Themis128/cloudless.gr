#!/bin/bash

# Supabase Reset Script with Seeding Options
# Usage: ./reset.sh [--seed] [--no-seed]

SEED_AFTER_RESET=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --seed)
      SEED_AFTER_RESET=true
      shift
      ;;
    --no-seed)
      SEED_AFTER_RESET=false
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./reset.sh [--seed] [--no-seed]"
      exit 1
      ;;
  esac
done

echo "🔄 Supabase Reset Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  WARNING: This will remove all containers and container data!"
echo "This action cannot be undone!"
echo ""
if [ "$SEED_AFTER_RESET" = true ]; then
  echo "🌱 Database will be seeded with test users after reset."
else
  echo "🚫 Database will NOT be seeded (--no-seed flag used)."
fi
echo ""
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo    # Move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Operation cancelled."
    exit 1
fi

echo "🛑 Stopping and removing all containers..."
docker compose -f docker-compose.yml -f ./dev/docker-compose.dev.yml down -v --remove-orphans

echo "🧹 Cleaning up bind-mounted directories..."
BIND_MOUNTS=(
  "./volumes/db/data"
)

for DIR in "${BIND_MOUNTS[@]}"; do  if [ -d "$DIR" ]; then
    echo "🗑️  Deleting $DIR..."
    rm -rf "$DIR"
  else
    echo "📁 Directory $DIR does not exist. Skipping..."
  fi
done

echo "🔧 Resetting .env file..."
if [ -f ".env" ]; then
  echo "🗑️  Removing existing .env file..."
  rm -f .env
else
  echo "📄 No .env file found. Skipping..."
fi

if [ -f ".env.example" ]; then
  echo "📋 Copying .env.example to .env..."
  cp .env.example .env
else
  echo "❌ .env.example file not found. Skipping .env reset step..."
fi

echo "✅ Cleanup complete!"

# Start containers again
echo ""
echo "🚀 Starting fresh Supabase containers..."
docker compose -f docker-compose.yml -f ./dev/docker-compose.dev.yml up -d

if [ $? -eq 0 ]; then
  echo "✅ Containers started successfully!"
  
  # Wait for services to be ready
  echo "⏳ Waiting for services to be ready..."
  sleep 10
  
  # Seed database if requested
  if [ "$SEED_AFTER_RESET" = true ]; then
    echo ""
    echo "🌱 Seeding database with test users..."
    cd ..
    if command -v node &> /dev/null; then
      node scripts/seed-database.js
      if [ $? -eq 0 ]; then
        echo "✅ Database seeding completed!"
      else
        echo "❌ Database seeding failed. You can run it manually:"
        echo "   node scripts/seed-database.js"
      fi
    else
      echo "❌ Node.js not found. Cannot run seeding script."
      echo "Please install Node.js or run seeding manually."
    fi
    cd docker
  fi
    echo ""
  echo "🎉 Reset and setup complete!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🌐 Access Points:"
  echo "  • Supabase Studio: http://localhost:54323"
  echo "  • API Endpoint: http://localhost:8000"  
  echo "  • Database: localhost:5432"
  
  if [ "$SEED_AFTER_RESET" = true ]; then
    echo ""
    echo "👥 Seeded Users (if seeding succeeded):"
    echo "  🛡️  baltzakis.themis@gmail.com (admin)"
    echo "  🛡️  john.doe@example.com (admin)"
    echo "  🛂 jane.smith@example.com (moderator)"
    echo "  👤 bob.wilson@example.com (user)"
    echo "  👤 alice.johnson@example.com (user)"
  fi
  
else
  echo "❌ Failed to start containers!"
  exit 1
fi