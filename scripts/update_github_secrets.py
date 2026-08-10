import requests
import json

# GitHub API token and repository
GITHUB_TOKEN = "ghp_6Zb6n3Z7aQ5c7V9z1B5s2F8f4E3d2A1e"
REPO_OWNER = "Themis128"
REPO_NAME = "cloudless.gr"

# AWS SSM secrets
AWS_SSM_SECRETS = {
    "AWS_ACCESS_KEY_ID": "REPLACE_WITH_YOUR_AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY": "REPLACE_WITH_YOUR_AWS_SECRET_ACCESS_KEY",
    "GOOGLE_CLIENT_EMAIL": "ga-service-account@credentials-462313.iam.gserviceaccount.com",
    "GOOGLE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC4F3TlheXsvq3B\\nbtXszKiFbf2TSmLVEebKRz6zsWKvZdxBm6TYtXJJ199o5Ie0DWZJNHZjyQImbzh4\\nfqQfUJU94JcGq3wltFjINYAqI0GQSNLs/bUSF9F3SP+CrgKpRm9MReyZSXejWexD\\nFmjJyiwbAsiBUPx+Sjj+Ph6ptLO5K7jq3YkRYmukjrxwjJPULSzCVtz2gQzPF5cA\\ndI9vLSdpFemRfUsJjkyFtpftWqCdQRYVwt9IhiJKpFck76Uao/cljV7ZoNswMT5O\\n5XGSf7V2SFu/VpNx0Ewe9cEiH8ivodiLlkOp4eETo3jEbOnDhhontzPJJJNBg+bU\\nJyX5rv8FAgMBAAECgf9m1LN3glPs6pYkdsUIgUmhPs9mdya93kIMu79KoMt/Lmba\\nPxbV9oTgurUQ4pbq/JEmUyfOlXmd/oKMzDDhTSIQbmPuVdwDM7pkG358CzWUYxlv\\nSEjc0nEvMJeJZ6oU5ENHV8fR2Df8Bz7yOpJOJaB9dhCKK7Le2Jb9bbWzFj1OMSt8\\nFcWNCbzYwJxYJ/YULm/ob7eDovd57SuQNj3CXyFXqhtG/N0sf7hjr/gnD7sRLSGm\\nbZDram1LIpqC8dyz+uQufHyR02TGp/4Hw69TT5JIQT+UDkNYhP6VDjK3Dli+0VJ9\\nKd/bSRC9oCF8QX7xxbA83knfzA3YT9Rbn0jwTLUCgYEA3wadQpLRaeDYAI9aHB7F\\n7KENR3mhiZ5rkzuyGTNy42GgsrL/BbkOYGHRmdfxs3Mj7CgiXeVQ/grn6XLgbVbC\\n8GzORcjUYkCJkfJ8e0soD57Mc4XWIpEPrxPJFbBfXNScFgHm/UmZ8eo+IDnvgNXU\\nqlMQbGm8ZJuG/LLj1yWRTfsCgYEA0081EzrhDLZOFTeLblZEUBT7fINmtR0rwKdu\\nq/3DaiKtsn9xfIWObwaFeBq5sduC2a331rICZTeRpdMXgAEHWMgur1fZEdEh0oQ6\\n7Sq07GNubP+rsJtSzTJ4QHFL8noOlwYhMqXQIT2kO7L498losgzxBn2v60LfEFDK\\nNo1AVv8CgYEAtlQn+KciwNZqgHqxhk+6K6u2uXo8j8+Nzr586ZFgGXhU8gLX7ovN\\nrwoJWyZpmPVGpuhgwDabMjUkR3v88iZ+FCQ/tllrGC/+x+xfzEQzKiH+r2r5FyVU\\nlyMrv6mDLNc8C9neR7AGRPnldF8o6EDoLZ7ezGLc+7sSbkCpd9hkpEUCgYA11saV\\nIblZfdGjQkW6VSyOoun4rZorp0UQjxh5pex2TGOpSSNnMLg7vZOgKF8L2/wY7mRp\\nRW2q0F/BumkQajKvAkIy1tUt3vUZKCvDZdA3MpZeGz5pfwm30pYlBTjujP7Op/cp\\namn/Li98LnuU1rJgOz/mAXwjGySuiYccIx0zjQKBgQDAXurK7wZwe9a1wnMlEsQk\\nRxo/F5d0RjlpgSP0Qz/nGfeAGuz40xYBSj9VOsygSfWeY5SHzu+zMsH/0A3kWW+z\\nt9GuuvSW3ujFNHxBNtoP64/WATjI7/L3TbouKDSnYrIDMo19TJPi2k1nZbcrLgKi\\nKfT6bvNx2DvehLZUlz8hGQ==",
    "GOOGLE_CALENDAR_ID": "baltzakis.themis@gmail.com"
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
