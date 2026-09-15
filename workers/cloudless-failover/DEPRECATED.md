# DEPRECATED — cloudless-failover Worker (CloudFront primary)

**Do not deploy.** Production edge is:

`browser → cloudless.gr → Worker cloudless2 (pi-origin-proxy) → Tunnel → Pi`

There is no CloudFront primary to fail over from. See
`workers/pi-origin-proxy` and `.cursor/rules/cloudless2-pi-proxy.mdc`.
