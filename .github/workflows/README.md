# 🧪 GitHub Workflows - Testing Suite

This directory contains comprehensive GitHub workflows for testing the Cloudless Wizard application functionality.

## 📋 Available Workflows

### 1. **API Testing** (`api-testing.yml`)
Comprehensive testing of all API endpoints and functionality.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual dispatch

**Tests:**
- ✅ API Index and documentation endpoints
- ✅ Authentication (login/register)
- ✅ Bot management (CRUD operations)
- ✅ Bot chat functionality
- ✅ Analytics dashboard
- ✅ Webhook registration
- ✅ Error handling and validation

**Node.js Versions:** 18, 20

---

### 2. **LLM & Model Testing** (`llm-model-testing.yml`)
Testing of AI/ML model functionality and LLM integrations.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual dispatch

**Tests:**
- ✅ Model creation (text classification, sentiment analysis)
- ✅ Model listing and filtering
- ✅ Model training process
- ✅ Model status monitoring
- ✅ Model predictions
- ✅ Model updates and deletion
- ✅ LLM integration endpoints
- ✅ Error handling

**Node.js Versions:** 18, 20

---

### 3. **Pipeline Testing** (`pipeline-testing.yml`)
Testing of data pipeline functionality and execution.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual dispatch

**Tests:**
- ✅ Pipeline creation (data processing, ETL)
- ✅ Pipeline listing and filtering
- ✅ Pipeline execution
- ✅ Pipeline status monitoring
- ✅ Pipeline scheduling
- ✅ Pipeline validation
- ✅ Pipeline cloning and deletion
- ✅ Performance monitoring
- ✅ Error handling

**Node.js Versions:** 18, 20

---

### 4. **Bot Testing** (`bot-testing.yml`)
Comprehensive testing of bot functionality and interactions.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual dispatch

**Tests:**
- ✅ Bot creation (customer support, developer assistant, data analyst, content writer)
- ✅ Bot listing and filtering
- ✅ Bot configuration updates
- ✅ Bot activation and deployment
- ✅ Bot chat interactions
- ✅ Conversation history
- ✅ Bot testing functionality
- ✅ Bot cloning and deletion
- ✅ Performance monitoring
- ✅ Error handling

**Node.js Versions:** 18, 20

---

### 5. **Test Summary & Report** (`test-summary.yml`)
Generates comprehensive test reports and summaries.

**Triggers:**
- Automatically runs after completion of any test workflow
- Creates detailed test reports
- Uploads test artifacts
- Creates GitHub issues for failed tests
- Comments on pull requests with test results

## 🚀 How to Use

### Running Tests Manually

1. **Go to Actions tab** in your GitHub repository
2. **Select the workflow** you want to run
3. **Click "Run workflow"**
4. **Choose branch** and click "Run workflow"

### Running All Tests

To run all tests, you can trigger them manually or push to the `main` or `develop` branches:

```bash
# Push to trigger all tests
git push origin main

# Or create a pull request
git checkout -b feature/test-updates
git push origin feature/test-updates
# Create PR to main branch
```

### Viewing Test Results

1. **Go to Actions tab** in your GitHub repository
2. **Click on the workflow run** you want to view
3. **Review the test results** and logs
4. **Download artifacts** if available

## 📊 Test Coverage

### API Endpoints Tested
- `GET /api/v1` - API index
- `GET /api/health` - Health check
- `GET /api/v1/docs` - API documentation
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/bots` - List bots
- `POST /api/v1/bots` - Create bot
- `POST /api/v1/bots/{id}/chat` - Bot chat
- `GET /api/v1/analytics/dashboard` - Analytics
- `POST /api/v1/webhooks/register` - Webhook registration

### Bot Types Tested
- Customer Support Bot
- Developer Assistant Bot
- Data Analyst Bot
- Content Writer Bot

### Model Types Tested
- Text Classification Model
- Sentiment Analysis Model

### Pipeline Types Tested
- Data Processing Pipeline
- ETL Pipeline

## 🔧 Configuration

### Environment Variables

The workflows automatically set up test environment variables:

```bash
NUXT_HOST=localhost
NUXT_PORT=3000
JWT_SECRET=test-secret-key
OPENAI_API_KEY=test-key
ANTHROPIC_API_KEY=test-key
REDIS_URL=redis://localhost:6379
```

### Test Data

Each workflow creates test users and data:
- **API Testing:** `test@example.com`
- **LLM Testing:** `llm-test@example.com`
- **Pipeline Testing:** `pipeline-test@example.com`
- **Bot Testing:** `bot-test@example.com`

## 📈 Test Reports

### Automatic Report Generation

After each test run, a comprehensive report is generated including:

- **Test Coverage Summary**
- **Component Status**
- **Detailed Test Results**
- **Next Steps Recommendations**
- **Environment Information**

### Report Locations

- **GitHub Actions:** View in the Actions tab
- **Artifacts:** Download test summary files
- **Issues:** Automatic issue creation for failed tests
- **Pull Requests:** Automatic comments with test results

## 🐛 Troubleshooting

### Common Issues

1. **Tests Failing Due to Missing Endpoints**
   - Some tests may fail if endpoints are not yet implemented
   - This is expected and noted in the test output
   - Tests are designed to be forward-compatible

2. **Authentication Issues**
   - Tests create their own test users
   - Each workflow uses separate test accounts
   - No conflicts between different test runs

3. **Database Connection Issues**
   - Tests use test environment configuration
   - Supabase connection is mocked for testing
   - No production data is affected

### Debugging Failed Tests

1. **Check the workflow logs** for detailed error messages
2. **Review the test summary** for specific failure points
3. **Verify endpoint implementation** if tests fail
4. **Check environment configuration** if setup fails

## 🔄 Continuous Integration

### Branch Protection

Recommended branch protection rules:

```yaml
# .github/branch-protection.yml
branches:
  - name: main
    protection:
      required_status_checks:
        contexts:
          - "API Testing"
          - "LLM & Model Testing"
          - "Pipeline Testing"
          - "Bot Testing"
      required_pull_request_reviews:
        required_approving_review_count: 1
      enforce_admins: false
```

### Pre-commit Hooks

Consider adding pre-commit hooks for local testing:

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running local tests..."
npm run test:api
npm run test:llm
npm run test:pipeline
npm run test:bot
```

## 📚 Best Practices

### Writing New Tests

1. **Follow the existing pattern** in the workflow files
2. **Use descriptive test names** and comments
3. **Include error handling** for edge cases
4. **Test both success and failure scenarios**
5. **Use proper authentication** for protected endpoints

### Maintaining Tests

1. **Update tests** when adding new endpoints
2. **Keep test data** separate from production
3. **Regularly review** test coverage
4. **Monitor test performance** and optimize if needed

### Test Data Management

1. **Use unique test accounts** for each workflow
2. **Clean up test data** after tests complete
3. **Avoid conflicts** between parallel test runs
4. **Use realistic test data** that represents production scenarios

## 🎯 Next Steps

### Immediate Actions

1. **Review existing workflows** and understand the test structure
2. **Run tests manually** to verify everything works
3. **Set up branch protection** rules if not already configured
4. **Monitor test results** for the first few runs

### Future Enhancements

1. **Add performance testing** workflows
2. **Implement load testing** for high-traffic scenarios
3. **Add security testing** workflows
4. **Create deployment testing** workflows
5. **Add visual regression testing** for UI components

---

**Happy Testing! 🧪✨**

For questions or issues with the test workflows, please create an issue in the repository. 