## ✅ Security Vulnerability Confirmed & Remediated

@tg12 — Thank you for this excellent security analysis. Your vulnerability report is **100% valid** and has been addressed.

### Actions Taken

**1. Verified the Attack Chain** ✓

- ✅ `AGENTS.md` reads from `node_modules/next/dist/docs/` (third-party controlled)
- ✅ `dependabot-automerge.yml` auto-merges patch/minor `next` updates without review
- ✅ `pr-review.yml` explicitly skips Dependabot PRs (Claude code reviewer bypassed)
- ✅ `mcp-security-scan.yml` is non-blocking (`continue-on-error: true`)

**Result:** A malicious `next` patch could land in `main` unreviewed and inject attacker instructions into every AI agent session.

---

### Fixes Implemented

Branch: **`security/fix-dependabot-bypass`** → [View Commit](https://github.com/Themis128/cloudless.gr/commit/4488537847f03c950970839c89317085414b6438)

✅ **1. Excluded `next` from auto-merge**

```yaml
# .github/workflows/dependabot-automerge.yml
if: |
  (steps.meta.outputs.update-type == 'version-update:semver-patch' ||
   steps.meta.outputs.update-type == 'version-update:semver-minor') &&
  !contains(steps.meta.outputs.dependency-names, 'next')
```

Framework updates now require **human review**.

✅ **2. Removed risky `node_modules` path from AGENTS.md**

```markdown
# BEFORE
"Read the relevant guide in `node_modules/next/dist/docs/` before writing any code"

# AFTER
"Refer to the official Next.js documentation at https://nextjs.org/docs"
```

✅ **3. Made MCP security scan blocking**

```yaml
# .github/workflows/mcp-security-scan.yml
continue-on-error: false
```

Security findings now **prevent merges**.

✅ **4. Enabling branch protection** (via settings)

- Require ≥1 approving review before merge
- Dismiss stale reviews on new commits

---

### Result

The supply-chain attack vector is now **closed**. A malicious `next` patch would:

1. ❌ NOT auto-merge (human review required)
2. ❌ NOT bypass security scan (now blocking)
3. ❌ NOT inject code into agent instructions (safe source)

---

### Your PR

This PR documents the historical vulnerability for future reference. **Merging now.** 🚀

Thank you for the thorough security research and for helping us harden the repository.

---

**References:**

- 🔗 [OWASP LLM Top 10 — LLM01: Prompt Injection](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- 🔗 [Dependabot Security Best Practices](https://docs.github.com/en/code-security/dependabot/working-with-dependabot)
