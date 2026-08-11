import requests
import json

# GitHub API token and repository
GITHUB_TOKEN = "ghp_6Zb6n3Z7aQ5c7V9z1B5s2F8f4E3d2A1e"
REPO_OWNER = "Themis128"
REPO_NAME = "cloudless.gr"

# AWS SSM secrets
AWS_SSM_SECRETS = {
    "GOOGLE_CLIENT_EMAIL": os.environ.get("GOOGLE_CLIENT_EMAIL"),
    "GOOGLE_PRIVATE_KEY": os.environ.get("GOOGLE_PRIVATE_KEY"),
    "GOOGLE_CALENDAR_ID": os.environ.get("GOOGLE_CALENDAR_ID")
}

def update_github_secret(secret_name, secret_value):
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/secrets/{secret_name}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json"
    }
    data = {
        "encrypted_value": secret_value,
        "key_id": "533273840"
    }
    response = requests.put(url, headers=headers, data=json.dumps(data))
    if response.status_code == 200:
        print(f"Successfully updated secret: {secret_name}")
    else:
        print(f"Failed to update secret: {secret_name}")

if __name__ == "__main__":
    for secret_name, secret_value in AWS_SSM_SECRETS.items():
        update_github_secret(secret_name, secret_value)
