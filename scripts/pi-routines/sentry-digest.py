#!/usr/bin/env python3
"""Weekly Sentry error digest for cloudless.gr — posts to Slack."""
import subprocess
import json
import datetime
import urllib.request

def ssm(key):
    r = subprocess.run(
        ['aws', 'ssm', 'get-parameter', '--name', f'/cloudless/production/{key}',
         '--with-decryption', '--query', 'Parameter.Value', '--output', 'text',
         '--region', 'us-east-1'],
        capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"SSM lookup failed for {key!r}: {r.stderr.strip()}")
    value = r.stdout.strip()
    if not value:
        raise RuntimeError(f"SSM returned empty value for {key!r}")
    return value

def slack_post(token, channel, text):
    body = json.dumps({'channel': channel, 'text': text}).encode()
    req = urllib.request.Request(
        'https://slack.com/api/chat.postMessage', data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    if not resp.get('ok'):
        raise RuntimeError(f"Slack API error: {resp.get('error', 'unknown')}")

def sentry_get(path, sentry_token):
    req = urllib.request.Request(
        f'https://sentry.io/api/0{path}',
        headers={'Authorization': f'Bearer {sentry_token}'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

slack_token = ssm('SLACK_BOT_TOKEN')
channel = ssm('SLACK_DEFAULT_CHANNEL')
sentry_token = ssm('SENTRY_AUTH_TOKEN')
org = ssm('SENTRY_ORG')
project = ssm('SENTRY_PROJECT')

today = datetime.date.today()
week_ago = (today - datetime.timedelta(days=7)).isoformat()
date_range = f'{week_ago} to {today}'

issues = sentry_get(
    f'/projects/{org}/{project}/issues/'
    f'?query=is:unresolved&limit=25&statsPeriod=7d',
    sentry_token)

new_issues = [i for i in issues if i.get('firstSeen', '')[:10] >= week_ago]
recurring = sorted(
    [i for i in issues if i.get('firstSeen', '')[:10] < week_ago],
    key=lambda x: int(x.get('count', 0)), reverse=True
)[:5]

lines = [f'*Sentry Weekly Digest — {date_range}*']

if new_issues:
    lines.append(f'\n*:new: {len(new_issues)} new this week:*')
    for i in new_issues[:5]:
        lines.append(f':red_circle: `{i["title"]}` — {i.get("count", "?")} events')
else:
    lines.append('\n:white_check_mark: No new issues this week')

if recurring:
    lines.append('\n*Top recurring (unresolved):*')
    for i in recurring:
        first = i.get('firstSeen', '')[:10]
        lines.append(f':yellow_circle: `{i["title"]}` — {i.get("count", "?")} events (since {first})')

lines.append(f'\n_Project: {project} | Next digest: next Monday_')
msg = '\n'.join(lines)
slack_post(slack_token, channel, msg)
print(msg)
