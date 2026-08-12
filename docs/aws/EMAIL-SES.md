# EMAIL / SES (legacy)

AWS SES paths are retired for the primary app path. Mail now uses:

- Cloudflare Email Routing (inbound → Gmail forward)
- Resend / Cloudflare Email Sending from the Pi (`docs/MAIL-SERVER-SETUP.md`)

See also [`README.md`](README.md) in this folder.
