# GitHub Secrets Setup - Quick Reference

## 🔑 Required Secrets for SonarCloud Workflow

### SONAR_TOKEN (Required - Manual Setup)

1. **Generate SonarCloud Token:**

   - Go to [SonarCloud](https://sonarcloud.io/)
   - Click profile picture → My Account → Security
   - Click "Generate Tokens"
   - Name: `GitHub Actions - cloudless.gr`
   - Type: `User Token`
   - Click "Generate"
   - **Copy the token immediately** (you won't see it again)

2. **Add to GitHub Repository:**
   - Go to: `https://github.com/Themis128/cloudless.gr/settings/secrets/actions`
   - Click "New repository secret"
   - Name: `SONAR_TOKEN`
   - Value: [Paste your SonarCloud token]
   - Click "Add secret"

### GITHUB_TOKEN (Automatic)

- ✅ Automatically provided by GitHub Actions
- ✅ No manual setup required
- ✅ Used in the workflow for repository access

## 🚀 Quick Setup Links

- **SonarCloud Security**: https://sonarcloud.io/account/security
- **GitHub Secrets**: https://github.com/Themis128/cloudless.gr/settings/secrets/actions
- **SonarCloud Project**: https://sonarcloud.io/project/overview?id=Themis128_cloudless.gr

## ✅ Verification

After adding the `SONAR_TOKEN` secret:

1. Push a commit to the `application` branch
2. Check the Actions tab in your GitHub repository
3. The "SonarQube Cloud Analysis" workflow should run successfully
4. Visit your SonarCloud project to see the analysis results

## 🔍 Troubleshooting

### Common Issues:

1. **Invalid SONAR_TOKEN Error:**

   - Regenerate the token in SonarCloud
   - Make sure you copied the entire token
   - Update the GitHub secret with the new token

2. **Workflow Not Triggering:**

   - Ensure you're pushing to the `application` branch
   - Check that the workflow file is in `.github/workflows/sonarcloud.yml`

3. **Permission Denied:**
   - Verify the SonarCloud token has the correct permissions
   - Check that the GitHub repository is correctly linked to SonarCloud

## 📞 Need Help?

- Check the [SONARQUBE_SETUP.md](./SONARQUBE_SETUP.md) for detailed configuration
- Review the GitHub Actions logs for specific error messages
- Consult SonarCloud documentation for token issues
