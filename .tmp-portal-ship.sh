#!/usr/bin/env bash
set +e
cd /home/tbaltzakis/code/cloudless.gr
rm -f .tmp-portal-check.sh .tmp-portal-audit.sh .tmp-portal-verify.sh
git checkout -b claude/portal-locale-redirect
git add -A
git -c user.email=Themis128@users.noreply.github.com -c user.name=Themis128 commit \
  -m "fix(portal): 308 /:locale/portal/* -> /portal/* and fix /auth/login redirect" \
  -m "Problem: /en/portal/waiting?plan=cloud returned 404 because the portal" \
  -m "tree lives outside [locale] on purpose (magic-link URLs in client emails" \
  -m "are locale-neutral). Manually-typed locale-prefixed URLs missed any rule." \
  -m "" \
  -m "Fix 1 - next.config.ts: 308-redirect /:locale(en|el|fr|de)/portal/:path*" \
  -m "to /portal/:path* (query string preserved). Verified:" \
  -m "  /en/portal/waiting?plan=cloud  -> 308 -> /portal/waiting?plan=cloud" \
  -m "  /el/portal/waiting?plan=cloud  -> 308 -> /portal/waiting?plan=cloud" \
  -m "  /en/portal/<token>             -> 308 -> /portal/<token>" \
  -m "  /portal/waiting?plan=cloud     -> 200" \
  -m "" \
  -m "Fix 2 - WaitingRoomClient.tsx: the unauth redirect pointed at" \
  -m "/auth/login, but /auth/login only exists under [locale]. The page is" \
  -m "locale-naked so @/i18n/navigation can't infer the active locale; read" \
  -m "NEXT_LOCALE cookie (same as next-intl middleware) with default-en fall-" \
  -m "back, then push /<locale>/auth/login?next=...." \
  -m "" \
  -m "typecheck + lint clean. Format already clean." 2>&1 | tail -3
git push -u origin claude/portal-locale-redirect 2>&1 | tail -3
gh pr create --base main --head claude/portal-locale-redirect \
  --title "fix(portal): /:locale/portal/* 308 -> /portal/* + correct /auth/login locale" \
  --body "Makes manually-typed /en/portal/waiting?plan=cloud (and any locale prefix) resolve to the locale-neutral portal route, and fixes the unauth /auth/login redirect that pointed at a non-existent top-level route. Verified live: 308 chain works, signup flow unchanged." 2>&1 | tail -2
gh pr merge --squash --delete-branch --admin 2>&1 | tail -3
