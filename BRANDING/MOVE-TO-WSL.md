# How to move BRANDING into ~/code/BRANDING

The Cowork session is bound to `cloudless.gr` and can't add a sibling folder mid-session. Run these three commands in your WSL terminal once and everything lands in place.

## 1. Move the project into your code folder

```bash
mkdir -p ~/code/BRANDING

# Copy what Claude generated in the outputs folder over to ~/code/BRANDING.
# Claude's outputs folder on Windows is roughly:
#   C:\Users\baltz\Documents\Claude\outputs\BRANDING\
# In WSL that is:
#   /mnt/c/Users/baltz/Documents/Claude/outputs/BRANDING/
# Adjust if your Cowork output path is different.

cp -r /mnt/c/Users/baltz/Documents/Claude/outputs/BRANDING/* ~/code/BRANDING/

# Pull in the v2 brand pack contents (logos, favicon, social templates, brand.md):
cp -r /mnt/c/Users/baltz/Documents/Claude/outputs/brand/* ~/code/BRANDING/cloudless-brand/

# Mark scripts executable
chmod +x ~/code/BRANDING/setup.sh ~/code/BRANDING/scripts/*.sh
```

## 2. Run the installer

```bash
cd ~/code/BRANDING
bash setup.sh
```

That clones the 6 external repos into `repos/`, symlinks every skill into `~/.claude/skills/`, copies `/brand-design` into `~/.claude/commands/`, and writes the suggested Claude Desktop MCP JSON to `~/.config/Claude/claude_desktop_config.suggested.json`.

## 3. Merge MCP config into Claude Desktop on Windows

```
%APPDATA%\Claude\claude_desktop_config.json
```

Open that file, merge the `mcpServers` object from `~/code/BRANDING/claude-desktop-mcp.json` into the existing one (don't overwrite). Restart Claude Desktop.

## 4. Verify

```bash
bash ~/code/BRANDING/scripts/verify.sh
```

Should print all installed skills + commands + which env vars are set.

## Already-tested artifacts (live on cloudless.gr right now)

The "test the system" run already produced **6 per-post social cards** for the Jun 24 – Jul 3 calendar and uploaded them to your Postiz storage. They're public URLs you can attach to Postiz posts immediately:

| Post slug | Card URL |
|---|---|
| `5-aws-cost-mistakes` | https://postiz.cloudless.gr/uploads/2026/06/18/65d799d32abfe5b9ac12698ed7384c8a.png |
| `serverless-bill-2400-to-480` | https://postiz.cloudless.gr/uploads/2026/06/18/bee56484c531a7cacc29a74f8b10824ed.png |
| `you-dont-need-multi-cloud` | https://postiz.cloudless.gr/uploads/2026/06/18/511c14d7fceecf39303951039afa5d6c9.png |
| `cloud-migration-guide-2026` | https://postiz.cloudless.gr/uploads/2026/06/18/c5bddfc1b5cbf3b2ce10ac6a8c6b2dfde.png |
| `3-client-results-q2` | https://postiz.cloudless.gr/uploads/2026/06/18/524d2f33e64cdd8a2f2a67f4aa9dac49.png |
| `cloud-cost-governance-4-guardrails` | https://postiz.cloudless.gr/uploads/2026/06/18/51e158617ff0dc4e2cbca6633a415d10c.png |

Open one in your browser to confirm the brand pack v2 visuals (cyan-on-dark grid + glow + per-post category badge + cyan signature stripe at the bottom) look right.
