# SonarQube Cloud Configuration

This document explains the SonarQube Cloud setup for the CloudlessGR project with the `application` branch configured as the main branch.

## 🔧 Configuration Files

### `sonar-project.properties`

Main SonarQube configuration file that defines:

- **Project Key**: `Themis128_cloudless.gr`
- **Organization**: `themis128`
- **Main Branch**: `application` (configured via `sonar.branch.name`)
- **Source inclusions/exclusions**
- **Test patterns**
- **TypeScript and Vue.js specific settings**

### `.github/workflows/sonarcloud.yml`

GitHub Actions workflow that:

- Triggers on push to `application` branch
- Triggers on pull requests targeting `application` branch
- Runs ESLint, TypeScript checks, and tests
- Performs SonarCloud analysis

### VS Code Settings

SonarLint extension configured to connect to SonarQube Cloud:

```json
"sonarlint.connectedMode.project": {
  "connectionId": "sonarcloud",
  "projectKey": "Themis128_cloudless.gr"
}
```

## 🚀 Setup Instructions

### 1. SonarQube Cloud Setup

1. Go to [SonarCloud](https://sonarcloud.io/)
2. Sign in with your GitHub account
3. Create organization `themis128`
4. Import the repository `Themis128/cloudless.gr`
5. Set `application` as the main branch in project settings

### 2. GitHub Secrets

You need to add the following secrets to your GitHub repository for the SonarCloud workflow to function:

#### Required Secrets:

1. **`SONAR_TOKEN`** (REQUIRED - Must be added manually)

   - Go to [SonarCloud](https://sonarcloud.io/)
   - Click on your profile picture → My Account → Security
   - Generate a new token with a descriptive name (e.g., "GitHub Actions - cloudless.gr")
   - Copy the generated token
   - Go to your GitHub repository: `https://github.com/Themis128/cloudless.gr`
   - Navigate to: Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SONAR_TOKEN`
   - Value: Paste the token from SonarCloud
   - Click "Add secret"

2. **`GITHUB_TOKEN`** (Automatically provided)
   - This token is automatically provided by GitHub Actions
   - No manual configuration required
   - Used for pull request analysis and repository access

#### Step-by-Step GitHub Secret Setup:

1. **Access Repository Settings:**

   ```
   https://github.com/Themis128/cloudless.gr/settings/secrets/actions
   ```

2. **Add SONAR_TOKEN:**

   - Click "New repository secret"
   - Name: `SONAR_TOKEN`
   - Value: [Your SonarCloud token]
   - Click "Add secret"

3. **Verify Setup:**
   - The secret should appear in the list as `SONAR_TOKEN`
   - You can see when it was created but not the value (for security)

### 3. VS Code SonarLint Extension

1. Install the SonarLint extension
2. Connect to SonarCloud:
   - Open Command Palette (`Ctrl+Shift+P`)
   - Run: "SonarLint: Add SonarQube/SonarCloud Connection"
   - Choose "SonarCloud"
   - Enter token and organization details

## 📊 Branch Strategy

### Main Branch: `application`

- All quality gates and analysis are configured for the `application` branch
- Pull requests are analyzed against this branch
- New feature branches should be created from and merged into `application`

### Quality Gates

- **Maintainability Rating**: A
- **Reliability Rating**: A
- **Security Rating**: A
- **Coverage**: > 80% (when tests are added)
- **Duplicated Lines**: < 3%

## 🔍 Analysis Scope

### Included Files

- TypeScript files (`**/*.ts`, `**/*.tsx`)
- JavaScript files (`**/*.js`, `**/*.jsx`)
- Vue.js files (`**/*.vue`)
- Configuration files (`**/*.json`, `**/*.yaml`, `**/*.yml`)

### Excluded Files

- Node modules (`**/node_modules/**`)
- Build outputs (`**/dist/**`, `**/.nuxt/**`, `**/.output/**`)
- Docker files (`**/docker/**`)
- PowerShell scripts (`**/scripts/**/*.ps1`)
- Test coverage reports (`**/coverage/**`)

## 🛠️ NPM Scripts

### `npm run sonar`

Runs SonarQube analysis locally (requires sonar-scanner CLI)

### `npm run typecheck`

Runs TypeScript type checking (used in CI)

## 📈 Continuous Integration

The GitHub Actions workflow automatically:

1. Installs dependencies
2. Runs linting (`npm run lint`)
3. Performs type checking (`npx tsc --noEmit`)
4. Executes tests (if available)
5. Uploads results to SonarCloud

## 🔗 Links

- **SonarCloud Project**: https://sonarcloud.io/project/overview?id=Themis128_cloudless.gr
- **GitHub Repository**: https://github.com/Themis128/cloudless.gr
- **Quality Gate**: View in SonarCloud dashboard

## 📝 Notes

- The configuration prioritizes the `application` branch as the main development branch
- All quality metrics and branch protection rules are based on this branch
- Feature branches will be compared against `application` in pull request analysis
- The setup is optimized for the Nuxt 3 + TypeScript + Vue.js technology stack
