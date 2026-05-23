#!/usr/bin/env python3
"""Monthly SSL cert + site reachability check for cloudless.gr — posts to Slack."""
import subprocess, json, datetime, urllib.request, ssl, socket

def ssm(key):
    r = subprocess.run(
        ['aws', 'ssm', 'get-parameter', '--name', f'/cloudless/production/{key}',
         '--with-decryption', '--query', 'Parameter.Value', '--output', 'text',
         '--profile', 'omv-main-cli'],
        capture_output=True, text=True)
    return r.stdout.strip()

def slack_post(token, channel, text):
    body = json.dumps({'channel': channel, 'text': text}).encode()
    req = urllib.request.Request(
        'https://slack.com/api/chat.postMessage', data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    urllib.request.urlopen(req)

def ssl_expiry(host):
    ctx = ssl.create_default_context()
    with ctx.wrap_socket(socket.create_connection((host, 443), timeout=10),
                         server_hostname=host) as s:
        cert = s.getpeercert()
    exp_str = cert['notAfter']  # e.g. 'May 30 12:00:00 2026 GMT'
    exp = datetime.datetime.strptime(exp_str, '%b %d %H:%M:%S %Y %Z')
    return exp, (exp - datetime.datetime.utcnow()).days

token = ssm('SLACK_BOT_TOKEN')
channel = ssm('SLACK_DEFAULT_CHANNEL')
today = datetime.date.today().isoformat()
lines = [f'*Monthly SSL & Domain Health — {today}*']
ok = True

for host in ['cloudless.gr', 'www.cloudless.gr']:
    try:
        exp, days = ssl_expiry(host)
        if days < 14:
            em = ':red_circle:'; ok = False
        elif days < 30:
            em = ':yellow_circle:'; ok = False
        else:
            em = ':green_circle:'
        lines.append(f'{em} `{host}` — expires {exp.date()} ({days}d remaining)')
    except Exception as e:
        lines.append(f':red_circle: `{host}` — FAIL: {e}'); ok = False

# Site reachability
try:
    with urllib.request.urlopen('https://cloudless.gr/api/health', timeout=8) as r:
        lines.append(f':green_circle: `cloudless.gr/api/health` — HTTP {r.status}')
except Exception as e:
    lines.append(f':red_circle: `cloudless.gr/api/health` — {e}'); ok = False

lines.append('\n:white_check_mark: All checks passed' if ok
             else '\n:warning: *Action required* — check SSL/DNS')
msg = '\n'.join(lines)
slack_post(token, channel, msg)
print(msg)
