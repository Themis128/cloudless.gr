#!/usr/bin/env python3
"""
Fetch Cognito app client ID from AWS and update .env.local

Usage:
  python3 scripts/get-cognito-client-id.py

Requires boto3 to be installed:
  pip install boto3

Requires AWS credentials to be configured (via SSO, env vars, or ~/.aws/credentials)
"""

import sys
from pathlib import Path

try:
    import boto3
except ImportError:
    print("❌ boto3 not installed. Run: pip install boto3")
    sys.exit(1)


def get_cognito_client_id():
    """Fetch Cognito app client ID from AWS."""
    try:
        session = boto3.Session(region_name="us-east-1")
        sts = session.client("sts")

        # Verify we have valid credentials
        identity = sts.get_caller_identity()
        print(f"✓ AWS authenticated as: {identity['Arn']}")

    except Exception as e:
        print(f"❌ AWS authentication failed: {e}")
        print("\nMake sure you have AWS credentials configured:")
        print("  - AWS SSO: run 'aws sso login'")
        print("  - AWS CLI: run 'aws configure'")
        print("  - Environment: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
        return None

    try:
        cognito = session.client("cognito-idp")
        user_pool_id = "us-east-1_1Bq3Mpqer"

        # List app clients
        response = cognito.list_user_pool_clients(UserPoolId=user_pool_id, MaxResults=10)

        if not response["UserPoolClients"]:
            print(f"❌ No app clients found in user pool {user_pool_id}")
            return None

        # Get the first app client
        client_id = response["UserPoolClients"][0]["ClientId"]
        client_name = response["UserPoolClients"][0]["ClientName"]

        # Get full client details
        details = cognito.describe_user_pool_client(UserPoolId=user_pool_id, ClientId=client_id)

        client_secret = details["UserPoolClient"].get("ClientSecret", "")

        print("\n✓ Found Cognito App Client:")
        print(f"  Name: {client_name}")
        print(f"  Client ID: {client_id}")
        print(f"  Has Secret: {'Yes' if client_secret else 'No (public client)'}")

        return {"client_id": client_id, "client_secret": client_secret, "client_name": client_name}

    except Exception as e:
        print(f"❌ Failed to fetch Cognito credentials: {e}")
        return None


def update_env_file(creds):
    """Update .env.local with Cognito credentials."""
    env_path = Path(__file__).parent.parent / ".env.local"

    if not env_path.exists():
        print(f"❌ .env.local not found at {env_path}")
        return False

    # Read current .env.local
    content = env_path.read_text()

    # Replace placeholders and empty values
    updates = {
        "NEXT_PUBLIC_COGNITO_CLIENT_ID=<PASTE_CLIENT_ID_HERE>": f"NEXT_PUBLIC_COGNITO_CLIENT_ID={creds['client_id']}",
        "COGNITO_CLIENT_ID=<PASTE_CLIENT_ID_HERE>": f"COGNITO_CLIENT_ID={creds['client_id']}",
    }

    for old, new in updates.items():
        if old in content:
            content = content.replace(old, new)

    if creds["client_secret"]:
        # Uncomment and set the secret
        content = content.replace(
            "COGNITO_CLIENT_SECRET=", f"COGNITO_CLIENT_SECRET={creds['client_secret']}"
        )

    # Write back
    env_path.write_text(content)
    print("\n✓ Updated .env.local")
    return True


def main():
    print("Fetching Cognito app client credentials...\n")

    creds = get_cognito_client_id()
    if not creds:
        return 1

    # Ask if user wants to update .env.local
    print("\nUpdate .env.local with these credentials? (y/n): ", end="")
    response = input().strip().lower()

    if response == "y":
        if update_env_file(creds):
            print("\n✓ .env.local updated. Run 'pnpm dev' to start the dev server.")
            return 0
        else:
            return 1
    else:
        print("\nCredentials not saved. You can manually add them to .env.local:")
        print(f"  NEXT_PUBLIC_COGNITO_CLIENT_ID={creds['client_id']}")
        print(f"  COGNITO_CLIENT_ID={creds['client_id']}")
        if creds["client_secret"]:
            print(f"  COGNITO_CLIENT_SECRET={creds['client_secret']}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
