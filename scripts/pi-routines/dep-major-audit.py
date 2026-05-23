#!/usr/bin/env python3
"""Monthly major dependency version audit for cloudless.gr — posts to Slack."""
import subprocess, json, datetime, urllib.request, urllib.parse

def ssm(key):
    r = subprocess.run(
        ['aws', 'ssm', 'get-parameter', '--name', f'/cloudless/production/{key}',
         '--with-decryption', '--query', 'Parameter.Value', '--output', 'text',
         '--region', 'us-east-1'],
        capture_output=True, text=True)
    return r.stdout.strip()

def slack_post(token, channel, text):
    body = json.dumps({'channel': channel, 'text': text}).encode()
    req = urllib.request.Request(
        'https://slack.com/api/chat.postMessage', data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    urllib.request.urlopen(req)

token = ssm('SLACK_BOT_TOKEN')
channel = ssm('SLACK_DEFAULT_CHANNEL')
gh_token = ssm('GITHUB_TOKEN')
today = datetime.date.today().isoformat()

# Fetch package.json from main branch
req = urllib.request.Request(
    'https://raw.githubusercontent.com/Themis128/cloudless.gr/main/package.json',
    headers={'Authorization': f'token {gh_token}'})
with urllib.request.urlopen(req) as r:
    pkg = json.loads(r.read())

all_deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
KEY_PKGS = [
    'next', 'react', 'react-dom', '@sentry/nextjs', 'stripe',
    'aws-amplify', '@aws-sdk/client-ses', 'next-intl',
    '@playwright/test', 'tailwindcss',
]

rows = []
upgrades = 0
for name in KEY_PKGS:
    if name not in all_deps:
        continue
    installed = all_deps[name].lstrip('^~>=')
    try:
        enc = urllib.parse.quote(name, safe='@%')
        with urllib.request.urlopen(
                f'https://registry.npmjs.org/{enc}/latest', timeout=10) as r:
            latest = json.loads(r.read())['version']
    except Exception:
        rows.append(f':grey_question: `{name}` | {installed} | unknown')
        continue
    inst_maj = int(installed.split('.')[0]) if installed[:1].isdigit() else 0
    lat_maj = int(latest.split('.')[0])
    if lat_maj > inst_maj:
        rows.append(f':warning: `{name}` | {installed} | {latest} | *major upgrade available*')
        upgrades += 1
    else:
        rows.append(f':white_check_mark: `{name}` | {installed} | {latest}')

header = f'*Monthly Dep Major Audit — {today}*\n_Package | Installed | Latest | Status_'
body = header + '\n' + '\n'.join(rows)
if upgrades:
    body += f'\n\n:warning: {upgrades} major upgrade(s) available. Review breaking changes before upgrading.'
else:
    body += '\n\n:white_check_mark: All key packages on latest major version.'
slack_post(token, channel, body)
print(body)
