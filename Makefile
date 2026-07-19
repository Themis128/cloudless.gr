.PHONY: help gh-aw gh-aw-list gh-aw-run gh-aw-init gh-aw-exec gh-aw-status gh-aw-validate gh-aw-version

# gh-aw - GitHub Advanced Workflows CLI extension
# Run: gh aw --help for full documentation

# Default target
help:
	@echo "Available gh-aw targets:"
	@echo "  gh-aw-list      - List all available workflows"
	@echo "  gh-aw-run       - Run workflow (usage: make gh-aw-run WORKFLOW=<workflow-name> [PARAMS='key=value']"
	@echo "  gh-aw-init      - Initialize gh-aw configuration"
	@echo "  gh-aw-exec      - Execute workflow from file (usage: make gh-aw-exec FILE=<path>)"
	@echo "  gh-aw-status    - Check workflow status"
	@echo "  gh-aw-validate  - Validate workflow file syntax"
	@echo "  gh-aw-version   - Show gh-aw extension version"
	@echo ""
	@echo "Common workflow shortcuts (post-AWS migration):"
	@echo "  workflow-deploy-pi         - Deploy to Pi k3s (GHCR + k3s rollout)"
	@echo "  workflow-deploy-fly        - Deploy Fly.io proxy"
	@echo "  workflow-monitoring-fix    - Fix monitoring node selector"
	@echo "  workflow-k3s-restart       - Restart k3s cluster"
	@echo "  workflow-k3s-app-recover   - Recover k3s application"
	@echo "  workflow-monthly-audit     - Run monthly security audit"
	@echo "  workflow-security-scan     - Run MCP security scan"
	@echo "  workflow-a11y-audit        - Run accessibility audit"
	@echo "  workflow-lighthouse        - Run lighthouse audit"
	@echo "  workflow-cluster-doctor    - Diagnose cluster issues"
	@echo "  workflow-etl-espocrm       - Run EspoCRM ETL to R2"
	@echo ""
	@echo "Development helpers:"
	@echo "  workflow-validate-all      - Validate all workflow files"
	@echo "  workflow-lint            - Lint all workflow YAML files"
	@echo "  workflow-deploy-all        - Sequentially deploy all services"

# Basic gh-aw commands
gh-aw-version:
	gh aw version

gh-aw-init:
	gh aw init

gh-aw-list:
	gh aw list

gh-aw-status:
	gh aw status

# Workflow execution
gh-aw-run:
	@if [ -z "$(WORKFLOW)" ]; then \
		echo "Error: WORKFLOW variable required. Usage: make gh-aw-run WORKFLOW=workflow-name [PARAMS='key=value']"; \
		exit 1; \
	fi
	gh aw run $(WORKFLOW) $(PARAMS)

gh-aw-exec:
	@if [ -z "$(FILE)" ]; then \
		echo "Error: FILE variable required. Usage: make gh-aw-exec FILE=path/to/workflow.yaml"; \
		exit 1; \
	fi
	gh aw exec $(FILE)

gh-aw-validate:
	@if [ -z "$(FILE)" ]; then \
		echo "Error: FILE variable required. Usage: make gh-aw-validate FILE=path/to/workflow.yaml"; \
		exit 1; \
	fi
	gh aw validate $(FILE)

# Common workflow shortcuts for cloudless.gr (remaining after AWS cleanup)
.PHONY: workflow-deploy-pi workflow-deploy-fly workflow-monitoring-fix workflow-k3s-restart workflow-k3s-app-recover \
        workflow-monthly-audit workflow-security-scan workflow-a11y-audit workflow-lighthouse \
        workflow-cluster-doctor workflow-etl-espocrm

workflow-deploy-pi:
	gh aw run deploy-pi

workflow-deploy-fly:
	gh aw run deploy-fly-proxy

workflow-monitoring-fix:
	gh aw run monitoring-node-selector-fix

workflow-k3s-restart:
	gh aw run k3s-restart

workflow-k3s-app-recover:
	gh aw run k3s-app-recover

workflow-monthly-audit:
	gh aw run monthly-security-audit

workflow-security-scan:
	gh aw run mcp-security-scan

workflow-a11y-audit:
	gh aw run a11y-audit

workflow-lighthouse:
	gh aw run lighthouse

workflow-cluster-doctor:
	gh aw run cluster-doctor

workflow-etl-espocrm:
	gh aw run etl-espocrm-to-r2

# Workflow development helpers
.PHONY: workflow-validate-all workflow-lint

workflow-validate-all:
	@for file in .github/workflows/*.yml .github/workflows/*.yaml; do \
		echo "Validating $$file..."; \
		gh aw validate $$file || exit 1; \
	done

workflow-lint:
	actionlint -quiet .github/workflows/*.yml .github/workflows/*.yaml

# Composite workflow targets (post-AWS cleanup)
.PHONY: workflow-deploy-all

workflow-deploy-all:
	gh aw run deploy-pi && gh aw run deploy-fly-proxy
