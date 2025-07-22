#!/bin/bash

# Setup script for migrating to Prisma Postgres
# This script helps you set up Prisma Postgres for your project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}🚀 Prisma Postgres Setup Script${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}💡 $1${NC}"
}

print_header

print_step "Step 1: Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

print_success "Node.js is installed: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "npm is installed: $(npm --version)"

echo ""
print_step "Step 2: Instructions for setting up Prisma Postgres..."

echo ""
print_info "To complete the setup, you need to:"
echo ""
echo "1. 🌐 Go to https://console.prisma.io/"
echo "2. 📝 Sign up or log in to your account"
echo "3. 🆕 Create a new project (e.g., 'my-app-db')"
echo "4. 🗄️  In the Prisma Postgres section, click 'Get started'"
echo "5. 🌍 Select a region closest to you"
echo "6. ⏳ Wait for the database status to change to 'CONNECTED'"
echo "7. 📋 Copy the DATABASE_URL and DIRECT_URL from the console"
echo ""

print_warning "Press Enter when you have your DATABASE_URL and DIRECT_URL ready..."
read -r

echo ""
print_step "Step 3: Setting up environment variables..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_info "Creating .env file from template..."
    cp env.example .env
    print_success ".env file created"
else
    print_info ".env file already exists"
fi

echo ""
print_info "Please update your .env file with your Prisma Postgres credentials:"
echo ""
echo "DATABASE_URL=\"prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY\""
echo "DIRECT_URL=\"postgresql://username:password@host:port/database?sslmode=require\""
echo ""
print_warning "Press Enter when you have updated your .env file..."
read -r

echo ""
print_step "Step 4: Generating Prisma client..."

if npm run prisma:generate; then
    print_success "Prisma client generated successfully"
else
    print_error "Failed to generate Prisma client"
    exit 1
fi

echo ""
print_step "Step 5: Running database migration..."

if npm run prisma:migrate:deploy; then
    print_success "Database migration completed successfully"
else
    print_error "Database migration failed"
    print_info "You might need to run: npx prisma migrate dev --name init"
    exit 1
fi

echo ""
print_step "Step 6: Seeding database with sample data..."

if npm run prisma:seed; then
    print_success "Database seeded successfully"
else
    print_warning "Database seeding failed, but you can continue without sample data"
fi

echo ""
print_step "Step 7: Testing the setup..."

# Test the health endpoint
echo "Testing Prisma connection..."
if node -e "
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();
prisma.\$queryRaw\`SELECT 1 as test\`.then(result => {
  console.log('✅ Database connection successful');
  prisma.\$disconnect();
}).catch(error => {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1);
});
"; then
    print_success "Prisma Postgres connection is working!"
else
    print_error "Prisma Postgres connection failed"
    exit 1
fi

echo ""
print_step "🎉 Setup Complete!"

echo ""
print_success "Your Prisma Postgres backend is now ready!"
echo ""
print_info "Next steps:"
echo "• Start your development server: npm run dev"
echo "• Test the health endpoint: curl http://localhost:3000/api/prisma/health"
echo "• Explore your data: npx prisma studio"
echo "• View your project in Prisma Console: https://console.prisma.io/"
echo ""
print_info "API Endpoints available:"
echo "• GET /api/prisma/health - Health check"
echo "• GET /api/prisma/projects - List projects"
echo "• POST /api/prisma/projects - Create project"
echo "• GET /api/prisma/todos - List todos"
echo "• POST /api/prisma/todos - Create todo"
echo ""
print_info "Benefits of Prisma Postgres:"
echo "• 🚀 Built-in connection pooling via Prisma Accelerate"
echo "• ⚡ Query result caching for better performance"
echo "• 🔒 Secure managed PostgreSQL database"
echo "• 📊 Query insights and monitoring"
echo "• 🌍 Global edge locations for low latency"
echo ""

print_success "Happy coding! 🎯"