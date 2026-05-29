#!/usr/bin/env python3
"""Bi-weekly stale branch audit for cloudless.gr — opens GitHub issue + posts to Slack."""
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

def gh(path, token, data=None):
    method = 'POST' if data else 'GET'
    req = urllib.request.Request(
        f'https://api.github.com{path}', data=data, method=method,
        headers={'Authorization': f'token {token}',
                 'Accept': 'application/vnd.github.v3+json',
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def slack_post(token, channel, text):
    body = json.dumps({'channel': channel, 'text': text}).encode()
    req = urllib.request.Request(
        'https://slack.com/api/chat.postMessage', data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    if not resp.get('ok'):
        raise RuntimeError(f"Slack API error: {resp.get('error', 'unknown')}")

gh_token = ssm('GITHUB_TOKEN')
slack_token = ssm('SLACK_BOT_TOKEN')
channel = ssm('SLACK_DEFAULT_CHANNEL')
today = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
cutoff = today - datetime.timedelta(days=21)
repo = 'Themis128/cloudless.gr'
protected = {'main', 'master', 'develop', 'staging'}

# GraphQL: get all branches + last commit date in one call
gql_query = ('{ repository(owner:"Themis128",name:"cloudless.gr"){ '
             'refs(refPrefix:"refs/heads/",first:100){ nodes{ name '
             'target{...on Commit{committedDate}} } } } }')
gql_body = json.dumps({'query': gql_query}).encode()
req = urllib.request.Request(
    'https://api.github.com/graphql', data=gql_body,
    headers={'Authorization': f'bearer {gh_token}', 'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as r:
    gql_data = json.loads(r.read())
if 'errors' in gql_data:
    raise RuntimeError(f"GitHub GraphQL error: {gql_data['errors']}")
branches = gql_data['data']['repository']['refs']['nodes']

# Open PR branches (exclude from stale list)
open_prs = gh(f'/repos/{repo}/pulls?state=open&per_page=100', gh_token)
pr_branches = {p['head']['ref'] for p in open_prs}

stale = []
for b in branches:
    name = b['name']
    if name in protected or name in pr_branches:
        continue
    date_str = b['target'].get('committedDate', '')
    if not date_str:
        continue
    committed = datetime.datetime.strptime(date_str[:19], '%Y-%m-%dT%H:%M:%S')
    if committed < cutoff:
        stale.append({
            'name': name,
            'days': (today - committed).days,
            'date': committed.date().isoformat()
        })

stale.sort(key=lambda x: x['days'], reverse=True)
today_str = today.date().isoformat()

if not stale:
    slack_post(slack_token, channel,
               f'*Stale Branch Audit — {today_str}*\n:white_check_mark: No stale branches found.')
    print('No stale branches.')
else:
    rows = '\n'.join(f'| `{b["name"]}` | {b["date"]} | {b["days"]}d |' for b in stale)
    body = (f'## Stale branches (>21 days, no open PR)\n\n'
            f'| Branch | Last commit | Age |\n|---|---|---|\n{rows}\n\n'
            f'Please review and delete branches that are no longer needed.')
    issue = gh(f'/repos/{repo}/issues', gh_token,
               data=json.dumps({'title': f'chore: stale branch cleanup — {today_str}',
                                'body': body, 'labels': ['chore']}).encode())
    msg = (f'*Stale Branch Audit — {today_str}*\n'
           f':broom: {len(stale)} stale branches — issue: {issue["html_url"]}')
    slack_post(slack_token, channel, msg)
    print(f'{len(stale)} stale branches — {issue["html_url"]}')
