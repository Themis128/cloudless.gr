---
name: aws-migration-strategies
description: |
  Choose and execute AWS to Cloudflare migration strategies (strangler fig, big
  bang, hybrid). Use when starting a migration, deciding on approach, or planning
  the cutover timeline. Triggered by phrases like "migration strategy", "strangler
  fig migration", "big bang deploy", "hybrid cloudflare", or "migration timeline".
---

# AWS to Cloudflare Migration Strategies

Choose the right migration approach based on your app size, team experience, and risk tolerance.

## Three Migration Strategies

### ① Strangler Fig (Recommended for Production)

Worker sits in front of AWS origin, migrating 1-2 endpoints per week.

```typescript
// Worker proxy routing
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Migrated endpoints
    if (url.pathname === "/api/posts") return handlePosts(request, env);
    if (url.pathname === "/api/search") return handleSearch(request, env);
    if (url.pathname === "/api/auth") return handleAuth(request, env);

    // Not yet migrated → proxy to AWS
    const awsUrl = `https://old-app.example.com${url.pathname}${url.search}`;
    return fetch(awsUrl, request);
  },
};
```

**Pros:**
- Easy per-endpoint rollback
- Zero downtime
- Test with real production traffic
- Team builds confidence gradually

**Cons:**
- Slow (weeks-months)
- 2 stacks in parallel
- Extra latency for AWS endpoints

**When to use:**
- Critical production app
- Small team, no downtime tolerance
- Need to validate incrementally

### ② Big Bang (For Small Apps)

Full Cloudflare stack on staging, DNS cutover overnight.

**Timeline:**
```
Week 1-3: Lambda → Worker rewrite, D1/R2 schema, staging
Week 4: End-to-end QA, load test
Week 5: Data migration (offline)
Week 6: DNS cutover, monitor 48h
```

**Cutover steps (Saturday 2AM, lowest traffic):**
- T-60min: Freeze writes to AWS (read-only mode)
- T-55min: Incremental data sync (S3→R2, DynamoDB→D1 delta)
- T-30min: Verify data parity
- T-15min: Deploy Worker production config
- T-5min: Reduce DNS TTL to 60s
- T-0: DNS cutover → Cloudflare Worker
- T+5min: Smoke test + monitor
- T+30min: Unfreeze writes if OK
- T+24h: Close monitoring

**When to use:**
- Small app (< 20 endpoints)
- Team has both AWS + CF experience
- Free dev window available

### ③ Hybrid Permanent (Enterprise)

Cloudflare edge + AWS core for specialized workloads.

```
User → Cloudflare Worker (auth, cache, rate limit)
     → AWS ALB (via Tunnel or Hyperdrive)
     → Aurora / SageMaker / EMR
```

**When to use:**
- Specialized AWS workloads (ML training, data warehouse)
- Cannot migrate core services
- Clear edge savings needed (WAF, cache, DDoS)

## Strategy Decision Matrix

| Factor | Strangler | Big Bang | Hybrid |
|--------|-----------|----------|--------|
| App Size | Any | <20 endpoints | Any |
| Downtime Tolerance | None | Planned window | None |
| Team Experience | Learning | Experienced | Mixed |
| Migration Time | Weeks+ | Weeks | Permanent |
| Risk Level | Low | High | Medium |
| Cost Savings | Gradual | Immediate | Partial |

## Implementation Checklist

### Before Any Strategy
- [ ] Cost evaluation completed
- [ ] Non-migrable workloads identified
- [ ] Strategy selected
- [ ] Team trained on CF fundamentals
- [ ] Staging environment ready
- [ ] Rollback plan documented

### During Migration
- [ ] Post-deploy smoke tests (Part 12)
- [ ] Error rate + latency monitoring
- [ ] Data parity checks
- [ ] Security header verification

### After Migration
- [ ] 1-month cost tracking
- [ ] Performance comparison
- [ ] Decommission AWS resources
- [ ] Team retrospective

## See Also

- `skills/aws-migration-preflight/SKILL.md` — Pre-flight checklist
- `skills/aws-post-migration/SKILL.md` — Post-migration cleanup
- `MIGRATION-STATUS.md` — Current migration status
- ` FULL-CLOUDFLARE-CUTTOVER-PLAN.md` — Full cutover plan