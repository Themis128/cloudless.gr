# AI Agent Rules

## General Behavior

- **Direct and technical:** Be direct and technical in responses — no conversational filler ("Great", "Certainly", "Okay", "Sure")
- **One tool at a time:** Wait for user confirmation after each tool use before proceeding
- **Verify before completing:** Check task requirements, verify output files exist, confirm format constraints before using `attempt_completion`
- **No trailing questions:** Never end `attempt_completion` with a question or request for further conversation

## Code Changes

- **Default to replace_in_file:** For most changes, use targeted edits
- **Use write_to_file for:** New files, extensive changes, boilerplate generation
- **Consider context:** Ensure changes are compatible with existing codebase and follow project standards
- **Fix tests:** If existing tests fail after a change, fix the code — don't modify test assertions unless explicitly asked

## Problem Solving

- **Break down tasks:** Set clear, achievable goals and work through them sequentially
- **Use sequential thinking:** For complex problems, use the Sequential Thinking MCP server
- **Gather context first:** Read relevant files before making changes
- **Check environment:** Consider actively running terminals, project structure, and system information

## Security

- **No AWS CLI installation:** Never install AWS CLI on developer machines, Pi hosts, or CI agents
- **No new AWS SDK:** Don't add AWS SDK dependencies to new code — prefer Cloudflare-native solutions
- **Secret management:** Use Wrangler secrets for Workers, environment variables for k3s
- **SSM_DISABLED=1:** ETL scripts set this to bypass SSM — use D1 app_config or env vars instead

## Skills Usage

- **Match to task:** When a user's request matches a skill description, use `use_skill` to load it
- **Follow skill instructions:** After activation, follow the skill's instructions directly
- **Available skills:** Refer to the system prompt for the full list of available skills

## MCP Tool Usage

- **One MCP operation at a time:** Similar to other tools, wait for confirmation before proceeding
- **Resolve before query:** For Context7, call `resolve-library-id` before `query-docs`
- **Check server status:** Use `test-mcp-servers.sh` if MCP servers are unresponsive