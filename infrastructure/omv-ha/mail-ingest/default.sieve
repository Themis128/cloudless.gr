# Default Sieve script — installed at /etc/dovecot/sieve/default/phishing.sieve
# (dovecot sieve_script default — applies when a mailbox has no personal script).
# Files Worker-tagged spam and HTTP-redirect phishing lures into Junk.
require ["body", "fileinto", "mailbox", "regex"];

# Cloudflare mail-ingest Worker spam verdict (see workers/mail-ingest/src/index.ts)
if header :contains "X-Spam-Flag" "YES" {
  fileinto :create "Junk";
  stop;
}

if allof (
  body :regex "http://[^[:space:]<>]+/(redirect|redir|goto)/",
  body :regex "(webmail|mailbox|quarantine|verify|login|access)"
) {
  fileinto :create "Junk";
  stop;
}
