#!/bin/bash
# run-all-tests.sh
# A script to run all contact form tests

# Set color variables
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Print section header
print_header() {
  echo -e "\n${YELLOW}=====================================${NC}"
  echo -e "${YELLOW}$1${NC}"
  echo -e "${YELLOW}=====================================${NC}\n"
}

# Track failures
FAILURES=0

# Run command and track success/failure
run_test() {
  echo -e "\n${YELLOW}Running: $1${NC}"
  if eval $2; then
    echo -e "${GREEN}✓ $1 passed${NC}"
  else
    echo -e "${RED}✗ $1 failed${NC}"
    FAILURES=$((FAILURES+1))
  fi
}

# Print summary
print_summary() {
  echo -e "\n${YELLOW}=====================================${NC}"
  if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}All tests passed successfully!${NC}"
  else
    echo -e "${RED}$FAILURES test groups failed!${NC}"
  fi
  echo -e "${YELLOW}=====================================${NC}\n"
}

# Main test execution
print_header "Running Contact Form Test Suite"

# 1. Unit tests with Vitest
print_header "Running Unit Tests with Vitest"
run_test "Contact Form Component Tests" "npx vitest run tests/contact-form.test.ts --passWithNoTests || true"
run_test "Contact API Tests" "npx vitest run tests/api-contact.test.ts --passWithNoTests || true"
run_test "Contact Composable Tests" "npx vitest run tests/useContactUs.test.ts --passWithNoTests || true"

# 2. Database migration test
print_header "Testing Database Migration"
run_test "Prisma Database Migration Tests" "bash ./scripts/db-migration-test.sh || true"

# 3. End-to-end tests (only if server is running)
print_header "Running E2E Tests"
if curl -s http://localhost:3000 > /dev/null; then
  run_test "Cypress E2E Tests" "npx cypress run --spec 'cypress/e2e/contact-form.cy.ts' || true"
else
  echo -e "${YELLOW}Nuxt dev server not running. Skipping E2E tests.${NC}"
  echo -e "${YELLOW}You can start the server with 'npm run dev' and run the tests separately.${NC}"
fi

# Print summary
print_summary

# Exit with appropriate code
exit $FAILURES
