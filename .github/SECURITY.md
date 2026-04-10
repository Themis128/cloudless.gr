# Security Policy

## Supported Versions

This project is actively maintained on the `main` branch only.

| Version       | Supported          |
| ------------- | ------------------ |
| `main`        | :white_check_mark: |
| Older commits | :x:                |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Use one of these private channels:

1. **Preferred:** [GitHub private vulnerability reporting](https://github.com/Themis128/cloudless.gr/security/advisories/new)
2. **Fallback:** Email `security@cloudless.gr` with subject `[Security] <brief description>`

### What to include

- Clear description of the vulnerability and impacted component
- Steps to reproduce or proof-of-concept
- Estimated impact and exploitability
- Affected file(s), route(s), or dependency
- Your contact details for follow-up

## Response Targets

| Step                        | Target timeline              |
| --------------------------- | ---------------------------- |
| Initial acknowledgment      | 48 hours                     |
| Triage and severity rating  | 5 business days              |
| Critical / High remediation | 7 days (or immediate hotfix) |
| Medium / Low remediation    | Next planned release cycle   |

## Disclosure Policy

- Keep findings private until a fix is released and deployed
- Coordinated (responsible) disclosure is supported and appreciated
- Reporters will be credited in the release notes unless they prefer anonymity

## Ongoing Security Practices

- Weekly Dependabot alerts for npm and GitHub Actions dependencies
- Monthly automated `pnpm audit` via scheduled workflow
- CodeQL SAST scanning on every push to `main` and every PR
- Secrets isolated in AWS SSM Parameter Store — no plaintext secrets in code
- OIDC-based keyless AWS authentication in GitHub Actions
- Secret scanning and push protection enabled on the repository
