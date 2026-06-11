#!/usr/bin/env python3
"""
cognito-setup.py — Python-based Cognito credential setup using boto3

This script:
1. Validates AWS credentials (via boto3)
2. Fetches COGNITO_CLIENT_ID and CLIENT_SECRET from SSM
3. Updates .env.local with credentials
4. Tests dev server startup

Usage:
    python3 scripts/cognito-setup.py                 # Full setup
    python3 scripts/cognito-setup.py --dry-run       # Preview
    python3 scripts/cognito-setup.py --skip-verify   # Skip dev test

Requirements:
    pip install boto3 botocore
    AWS credentials via SSO or environment variables
"""

import argparse
import subprocess
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError, NoCredentialsError


class CognitoSetup:
    """Automated Cognito setup using boto3"""

    def __init__(self, dry_run=False, skip_verify=False):
        self.dry_run = dry_run
        self.skip_verify = skip_verify
        self.repo_root = Path(__file__).parent.parent
        self.env_local = self.repo_root / ".env.local"
        self.pool_id = "us-east-1_1Bq3Mpqer"
        self.region = "us-east-1"
        self.ssm_client = None

    def log(self, message: str, level="info"):
        """Log with colored output"""
        colors = {
            "info": "\033[0;36m",  # cyan
            "success": "\033[0;32m",  # green
            "warning": "\033[1;33m",  # yellow
            "error": "\033[0;31m",  # red
        }
        reset = "\033[0m"
        prefix = f"{colors.get(level, '')}[cognito]{reset}"

        symbol = {
            "info": "►",
            "success": "✓",
            "warning": "⚠",
            "error": "✗",
        }.get(level, "")

        print(f"{prefix} {symbol} {message}") if symbol else print(f"{prefix} {message}")

    def check_requirements(self) -> bool:
        """Check Python dependencies"""
        self.log("Checking requirements...")
        try:
            import boto3  # noqa

            self.log("boto3 installed", "success")
            return True
        except ImportError:
            self.log("boto3 not found. Install with: pip install boto3", "error")
            return False

    def validate_credentials(self) -> bool:
        """Validate AWS credentials"""
        self.log("Validating AWS credentials...")
        try:
            sts = boto3.client("sts", region_name=self.region)
            identity = sts.get_caller_identity()
            self.log(f"Authenticated as: {identity['Arn']}", "success")
            return True
        except NoCredentialsError:
            self.log(
                "No AWS credentials found. Run: aws sso login --sso-session cloudless", "error"
            )
            return False
        except ClientError as e:
            self.log(f"Authentication failed: {e}", "error")
            return False

    def fetch_credentials(self) -> dict[str, str] | None:
        """Fetch Cognito credentials from SSM"""
        self.log("Fetching Cognito credentials from SSM...")

        self.ssm_client = boto3.client("ssm", region_name=self.region)

        try:
            # Fetch Client ID
            response = self.ssm_client.get_parameter(Name="/cloudless/production/COGNITO_CLIENT_ID")
            client_id = response["Parameter"]["Value"]
            self.log(f"Client ID: {client_id[:10]}...", "success")
        except ClientError as e:
            if "ParameterNotFound" in str(e):
                self.log("COGNITO_CLIENT_ID not found in SSM", "error")
            else:
                self.log(f"Failed to fetch CLIENT_ID: {e}", "error")
            return None

        # Fetch Client Secret (optional)
        client_secret = ""
        try:
            response = self.ssm_client.get_parameter(
                Name="/cloudless/production/COGNITO_CLIENT_SECRET", WithDecryption=True
            )
            client_secret = response["Parameter"]["Value"]
            self.log(f"Client Secret: {client_secret[:10]}...", "success")
        except ClientError as e:
            if "ParameterNotFound" in str(e):
                self.log("CLIENT_SECRET not found (public client)", "warning")
            else:
                self.log(f"Failed to fetch CLIENT_SECRET: {e}", "warning")

        return {
            "client_id": client_id,
            "client_secret": client_secret,
        }

    def backup_env(self) -> Path | None:
        """Backup existing .env.local"""
        if not self.env_local.exists():
            self.log(".env.local not found, will create new one", "warning")
            return None

        backup_path = self.env_local.with_suffix(f".backup.{int(__import__('time').time())}")
        self.env_local.rename(backup_path)
        self.log(f"Backed up to: {backup_path.name}", "success")
        return backup_path

    def update_env(self, credentials: dict[str, str]) -> bool:
        """Update .env.local with credentials"""
        self.log("Updating .env.local...")

        if self.dry_run:
            self.log("(DRY RUN) Would update:", "warning")
            self.log(f"  NEXT_PUBLIC_COGNITO_CLIENT_ID={credentials['client_id']}", "warning")
            self.log(f"  COGNITO_CLIENT_ID={credentials['client_id']}", "warning")
            if credentials["client_secret"]:
                self.log(
                    f"  COGNITO_CLIENT_SECRET={credentials['client_secret'][:10]}...", "warning"
                )
            return True

        # Backup first
        self.backup_env()

        # Read existing or create new
        if self.env_local.exists():
            content = self.env_local.read_text()
        else:
            content = ""

        # Update credentials
        lines = content.split("\n")
        updated = []
        found_client_id = False
        found_client_secret = False

        for line in lines:
            if line.startswith("NEXT_PUBLIC_COGNITO_CLIENT_ID="):
                updated.append(f"NEXT_PUBLIC_COGNITO_CLIENT_ID={credentials['client_id']}")
                found_client_id = True
            elif line.startswith("COGNITO_CLIENT_ID="):
                updated.append(f"COGNITO_CLIENT_ID={credentials['client_id']}")
            elif line.startswith("COGNITO_CLIENT_SECRET="):
                if credentials["client_secret"]:
                    updated.append(f"COGNITO_CLIENT_SECRET={credentials['client_secret']}")
                else:
                    updated.append("COGNITO_CLIENT_SECRET=")
                found_client_secret = True
            else:
                updated.append(line)

        # Add missing lines
        if not found_client_id:
            updated.append(f"NEXT_PUBLIC_COGNITO_CLIENT_ID={credentials['client_id']}")
            updated.append(f"COGNITO_CLIENT_ID={credentials['client_id']}")
        if not found_client_secret and credentials["client_secret"]:
            updated.append(f"COGNITO_CLIENT_SECRET={credentials['client_secret']}")

        # Write updated content
        self.env_local.write_text("\n".join(updated))
        self.log(".env.local updated", "success")
        return True

    def test_dev_server(self) -> bool:
        """Test dev server startup"""
        self.log("Testing dev server...")

        if self.skip_verify:
            self.log("Skipped (--skip-verify)", "warning")
            return True

        try:
            # Kill existing servers
            subprocess.run(["pkill", "-f", "next dev"], capture_output=True, timeout=5)
        except subprocess.TimeoutExpired:
            pass

        # Start dev server
        try:
            subprocess.Popen(
                ["pnpm", "dev"],
                cwd=self.repo_root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as e:
            self.log(f"Failed to start dev server: {e}", "error")
            return False

        # Wait for server
        import time

        for _ in range(30):
            try:
                result = subprocess.run(
                    ["curl", "-s", "http://localhost:4000/en"], capture_output=True, timeout=2
                )
                if result.returncode == 0:
                    self.log("Dev server started successfully", "success")
                    return True
            except Exception:
                pass
            time.sleep(1)

        self.log("Dev server test timed out", "warning")
        return False

    def run(self) -> bool:
        """Run full setup"""
        print()
        self.log("Starting Cognito setup...", "info")
        print()

        # Step 1: Check requirements
        if not self.check_requirements():
            return False

        # Step 2: Validate credentials
        if not self.validate_credentials():
            return False

        # Step 3: Fetch credentials
        credentials = self.fetch_credentials()
        if not credentials:
            return False

        # Step 4: Update .env.local
        if not self.update_env(credentials):
            return False

        # Step 5: Test dev server
        if not self.test_dev_server():
            self.log("Dev server test failed (continuing anyway)", "warning")

        print()
        self.log("✓ Cognito setup complete!", "success")
        print()
        self.log("Next steps:", "info")
        print("  1. pnpm dev — Start dev server")
        print("  2. Visit http://localhost:4000/en")
        print("  3. Click 'Sign in' to test Cognito authentication")
        print()

        return True


def main():
    parser = argparse.ArgumentParser(description="Automated Cognito credential setup using boto3")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--skip-verify", action="store_true", help="Skip dev server test")
    args = parser.parse_args()

    setup = CognitoSetup(dry_run=args.dry_run, skip_verify=args.skip_verify)

    success = setup.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
