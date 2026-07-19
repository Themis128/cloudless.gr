# Cline + Playwright MCP - Fine-Tuning Commands for cloudless.gr

## Prerequisites

Ensure Playwright MCP servers are running:

```bash
docker compose -f playwright-mcp-docker-compose.yml --profile playwright up -d
```

Check status:
```bash
docker compose -f playwright-mcp-docker-compose.yml ps
```

---

## SECTION 1: PERFORMANCE OPTIMIZATION

### Analyze Page Load Performance
```
Analyze the home page load performance and identify bottlenecks. 
Use Playwright to:
1. Navigate to http://localhost:4000
2. Measure Core Web Vitals (LCP, FID, CLS)
3. Get console logs to find performance warnings
4. Suggest optimizations
```

### Test API Response Times
```
Check the API endpoint response times for /api/search endpoint.
Use Playwright to:
1. Perform GET request to http://localhost:4000/api/search?q=test
2. Assert response time is under 500ms
3. Validate JSON response structure
4. Report findings
```

### Monitor JavaScript Execution
```
Find and analyze all JavaScript execution issues on the dashboard.
Use Playwright to:
1. Navigate to http://localhost:4000/dashboard
2. Capture all console errors and warnings
3. Execute performance.now() to measure timings
4. Suggest code optimizations
```

### Identify Memory Leaks
```
Detect potential memory leaks in the application.
Use Playwright to:
1. Navigate through multiple pages
2. Monitor console for memory warnings
3. Check for unhandled promise rejections
4. Suggest memory management improvements
```

---

## SECTION 2: USER INTERACTION TESTING

### Test Login Flow
```
Test the complete login flow and identify UX issues.
Use Playwright to:
1. Navigate to http://localhost:4000/login
2. Fill username field with test@example.com
3. Fill password field with testpass123
4. Click login button
5. Wait for redirect to dashboard
6. Take screenshot
7. Capture any errors
```

### Test Checkout Process
```
Automate and test the entire checkout flow.
Use Playwright to:
1. Navigate to http://localhost:4000/checkout
2. Fill in customer information
3. Fill in payment details
4. Click submit
5. Verify success message
6. Check API calls during submission
7. Report any form validation issues
```

### Test Form Submissions
```
Validate all form inputs on the contact page.
Use Playwright to:
1. Navigate to http://localhost:4000/contact
2. Test empty form submission
3. Test invalid email format
4. Test valid submission
5. Verify success notification
6. Check API request
7. Suggest form improvements
```

### Test Search Functionality
```
Generate comprehensive tests for the search feature.
Use Playwright to:
1. Navigate to http://localhost:4000
2. Find search input
3. Type various search queries
4. Verify results load
5. Check pagination
6. Analyze response time
7. Identify slow queries
```

### Test Drag and Drop
```
Test all drag-and-drop interactions in the app.
Use Playwright to:
1. Find draggable elements
2. Drag to target locations
3. Verify drop behavior
4. Test animation smoothness
5. Check undo/redo functionality
6. Report any glitches
```

---

## SECTION 3: RESPONSIVE DESIGN TESTING

### Test Mobile Responsiveness
```
Test responsive design on mobile devices.
Use Playwright with mobile-chrome project:
1. Emulate Pixel 5 (412x915)
2. Navigate to http://localhost:4000
3. Capture screenshots at key pages
4. Test menu navigation
5. Test form inputs on mobile
6. Check touch interactions
7. Report layout issues
```

### Test iPhone Compatibility
```
Test on iPhone 12 emulation.
Use Playwright with mobile-safari project:
1. Emulate iPhone 12 (390x844)
2. Test all critical user flows
3. Check button sizes for touch
4. Verify scrolling performance
5. Test modal dismissal
6. Report iOS-specific issues
```

### Test Tablet Layout
```
Validate tablet responsiveness (iPad size).
Use Playwright:
1. Set viewport to 768x1024 (iPad)
2. Navigate through all pages
3. Check navigation layout
4. Test sidebar behavior
5. Verify image sizing
6. Suggest layout improvements
```

### Test Desktop Breakpoints
```
Verify all desktop breakpoints (1920x1080).
Use Playwright:
1. Set viewport to 1920x1080
2. Check full-width layouts
3. Test multi-column layouts
4. Verify header/footer
5. Take comparison screenshots
6. Report any overflow issues
```

---

## SECTION 4: API CONTRACT TESTING

### Validate All API Endpoints
```
Test all API endpoints for correct responses.
Use Playwright HTTP methods:
1. GET /api/users - validate response schema
2. POST /api/users - test create operation
3. PATCH /api/users/{id} - test update
4. DELETE /api/users/{id} - test deletion
5. Check status codes (200, 201, 400, 404)
6. Validate response times
7. Generate API test report
```

### Test Error Handling
```
Validate error handling for all API endpoints.
Use Playwright:
1. Test invalid request body
2. Test missing authentication
3. Test missing required fields
4. Verify error messages
5. Check HTTP status codes
6. Validate error response format
7. Suggest improvements
```

### Test Rate Limiting
```
Verify rate limiting is working correctly.
Use Playwright:
1. Send rapid GET requests to /api/search
2. Capture 429 Too Many Requests response
3. Check rate-limit headers
4. Verify retry-after header
5. Test with different endpoints
6. Report rate limit configuration
```

### Test Data Validation
```
Test API data validation on POST/PATCH requests.
Use Playwright:
1. Send request with missing fields
2. Send request with invalid types
3. Send request with oversized data
4. Verify validation error messages
5. Check error response format
6. Test edge cases
```

---

## SECTION 5: ERROR & EXCEPTION TRACKING

### Find All JavaScript Errors
```
Identify all JavaScript errors across the application.
Use Playwright:
1. Navigate to each page/feature
2. Capture console errors
3. Filter by error type
4. Get stack traces
5. Identify error patterns
6. Prioritize critical errors
```

### Monitor Network Errors
```
Detect network-related errors and failures.
Use Playwright:
1. Monitor failed network requests
2. Track 5xx server errors
3. Check CORS errors
4. Identify slow endpoints
5. Capture error details
6. Suggest improvements
```

### Track Unhandled Promises
```
Find unhandled promise rejections.
Use Playwright:
1. Interact with async operations
2. Capture console warnings
3. Search for "unhandled rejection"
4. Get promise rejection reasons
5. Identify missing error handlers
6. Suggest fixes
```

---

## SECTION 6: ACCESSIBILITY TESTING

### Test Keyboard Navigation
```
Validate keyboard navigation works everywhere.
Use Playwright:
1. Press Tab to navigate elements
2. Press Enter to activate buttons
3. Press Space for checkboxes
4. Press Escape for modals
5. Check focus indicators
6. Verify tab order
```

### Check ARIA Labels
```
Validate all interactive elements have proper ARIA labels.
Use Playwright to:
1. Get page HTML
2. Search for elements without aria-label
3. Check aria-labelledby attributes
4. Verify button descriptions
5. Check form labels
6. Report accessibility issues
```

### Test Screen Reader Compatibility
```
Verify screen reader support.
Use Playwright to:
1. Get all semantic HTML
2. Check heading hierarchy
3. Verify list structures
4. Check image alt text
5. Validate form labels
6. Test landmark regions
```

### Test Color Contrast
```
Check color contrast ratios.
Use Playwright to:
1. Extract all text colors
2. Extract background colors
3. Calculate contrast ratios
4. Check WCAG compliance
5. Identify low contrast areas
6. Suggest color changes
```

---

## SECTION 7: FORM VALIDATION TESTING

### Test Email Validation
```
Validate email input field behavior.
Use Playwright to:
1. Fill with invalid emails: test@, @test.com, test
2. Fill with valid email: test@example.com
3. Check error messages
4. Verify field styling
5. Test pattern matching
```

### Test Password Field
```
Validate password requirements and behavior.
Use Playwright to:
1. Test short passwords
2. Test without uppercase
3. Test without numbers
4. Test without special chars
5. Test show/hide toggle
6. Verify strength indicator
```

### Test Required Fields
```
Validate all required fields enforcement.
Use Playwright to:
1. Submit form with empty fields
2. Verify required field errors
3. Check error message styling
4. Test field re-validation
5. Check form-level validation
```

### Test File Upload
```
Validate file upload functionality.
Use Playwright to:
1. Upload valid file type
2. Upload invalid file type
3. Upload oversized file
4. Check file size limits
5. Verify upload progress
6. Confirm uploaded file
```

---

## SECTION 8: BROWSER COMPATIBILITY TESTING

### Test on Chrome
```
Run full test suite on Chromium/Chrome.
Use Playwright chromium project:
npx playwright test --project=chromium
```

### Test on Firefox
```
Run full test suite on Firefox.
Use Playwright firefox project:
npx playwright test --project=firefox
```

### Test on Safari
```
Run full test suite on WebKit/Safari.
Use Playwright webkit project:
npx playwright test --project=webkit
```

### Test Cross-Browser
```
Run tests on all browsers simultaneously.
Use Playwright all projects:
npx playwright test --config=playwright-mcp.config.ts
```

---

## SECTION 9: SECURITY TESTING

### Test Authentication
```
Validate authentication mechanisms.
Use Playwright to:
1. Test login with invalid credentials
2. Test session expiration
3. Test token refresh
4. Verify logout functionality
5. Check redirect to login
```

### Test Authorization
```
Verify authorization rules.
Use Playwright to:
1. Access admin-only pages as user
2. Verify 403 Forbidden response
3. Test role-based access
4. Check permission enforcement
5. Verify feature access controls
```

### Test XSS Prevention
```
Check for XSS vulnerabilities.
Use Playwright to:
1. Submit form with <script> tag
2. Submit with event handlers
3. Check HTML escaping
4. Verify safe rendering
5. Test all input fields
```

---

## SECTION 10: VISUAL REGRESSION TESTING

### Capture Page Screenshots
```
Take screenshots for visual baseline.
Use Playwright to:
1. Navigate to each page
2. Capture full page screenshot
3. Capture above-fold area
4. Capture specific components
5. Store as baseline
```

### Test Theme Changes
```
Compare light and dark theme rendering.
Use Playwright to:
1. Toggle dark mode
2. Capture screenshots
3. Toggle light mode
4. Capture screenshots
5. Compare visual differences
6. Report any inconsistencies
```

### Compare Component Variants
```
Verify component consistency across pages.
Use Playwright to:
1. Find all buttons on page
2. Capture each button
3. Find all cards on page
4. Capture each card
5. Compare for consistency
6. Identify style mismatches
```

---

## SECTION 11: PERFORMANCE PROFILING

### Analyze Network Performance
```
Detailed network performance analysis.
Use Playwright to:
1. Navigate page
2. Capture all network requests
3. Analyze request sizes
4. Check request timing
5. Identify slow resources
6. Suggest optimization
```

### Test Image Optimization
```
Verify images are properly optimized.
Use Playwright to:
1. Get all images on page
2. Check image formats (WebP, JPEG)
3. Check image sizes
4. Test lazy loading
5. Verify responsive images
```

### Test CSS Performance
```
Check CSS delivery and parsing.
Use Playwright to:
1. Get all stylesheets
2. Check CSS file sizes
3. Verify critical CSS
4. Test font loading
5. Check for unused CSS
```

---

## QUICK COMMAND REFERENCE

### START SERVICES
```bash
docker compose -f playwright-mcp-docker-compose.yml --profile playwright up -d
```

### CHECK STATUS
```bash
docker compose -f playwright-mcp-docker-compose.yml ps
```

### RUN TESTS
```bash
npx playwright test --config=playwright-mcp.config.ts
npx playwright test --project=chromium
npx playwright test --debug
```

### VIEW REPORT
```bash
npx playwright show-report
```

### STOP SERVICES
```bash
docker compose -f playwright-mcp-docker-compose.yml down
```

---

## HOW TO USE IN CLINE

1. **Open Cline**: VS Code → Cline Extension (Ctrl+Shift+M)

2. **Copy any command from sections above**

3. **Paste into Cline chat**

4. **Cline will**:
   - Use Playwright MCP servers
   - Execute 32 automation tools
   - Analyze your app
   - Capture screenshots/logs
   - Provide recommendations

5. **Review suggestions** and implement fixes

6. **Re-run tests** to validate improvements

---

## WORKFLOW EXAMPLE

1. Open Cline
2. Request: "Analyze the login page performance"
3. Cline uses Playwright MCP to:
   - Navigate to login page
   - Measure load time
   - Capture console logs
   - Test form interaction
   - Suggest optimizations
4. Implement suggestions
5. Request: "Verify login performance improvements"
6. Cline re-tests and confirms improvements

---

Status: Ready to Use
Location: /home/tbaltzakis/cloudless.gr
Platform: WSL2 Ubuntu 24.04 + Docker
Date: 2026-07-18

