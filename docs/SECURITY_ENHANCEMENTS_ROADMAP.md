# Security Enhancements Roadmap

**Status:** Priority 1 ✅ Complete | Priority 2 ✅ Automated | Priority 3 📋 Documented

---

## Priority 3: Optional Infrastructure Enhancements

### Phase 1: DDoS Protection (AWS WAF)
**Timeline:** Q2 2026  
**Benefit:** Protect against Layer 7 attacks  
**Implementation:**

```bash
# Create WAF WebACL for CloudFront
aws wafv2 create-web-acl \
  --name cloudless-waf \
  --region us-east-1 \
  --default-action Block={} \
  --rules file://waf-rules.json \
  --visibility-config SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=cloudless-waf
```

**Rules to implement:**
- Rate limiting: 2000 req/5min per IP
- Geo-blocking: Allow only allowed countries
- Common attack patterns (SQLi, XSS, LFI)
- Bot control integration

---

### Phase 2: AWS X-Ray Tracing (Lambda Diagnostics)
**Timeline:** Q2 2026  
**Benefit:** Enhanced visibility into Lambda cold starts, latency, errors  
**Implementation:**

```typescript
// sst.config.ts
export default $config({
  app: "cloudless",
  lambda: {
    architecture: "arm64",
    memory: 1024,
    tracing: "active",  // Enable X-Ray tracing
    timeout: 60,
    logRetention: 7,
  },
  // ...
});
```

**Metrics to track:**
- Cold start frequency & duration
- Error rates by function
- End-to-end latency (API → DB)
- Concurrent execution patterns

---

### Phase 3: CloudFront Edge Caching
**Timeline:** Q3 2026  
**Benefit:** 40-60% reduction in origin requests, improved response times  
**Implementation:**

```terraform
# infrastructure/cloudfront.tf
resource "aws_cloudfront_distribution" "main" {
  enabled = true
  
  origin {
    domain_name = aws_api_gateway_domain_name.main.domain_name
    origin_id   = "api"
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "api"
    compress         = true
    
    viewer_protocol_policy = "redirect-to-https"
    
    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = aws_acm_certificate.main.arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
```

**Caching strategy:**
- Static assets: 31536000s (1 year)
- HTML pages: 3600s (1 hour)
- API responses: Based on Cache-Control headers
- Invalidation: Auto-trigger on deployment

---

### Phase 4: Enhanced Logging & Compliance
**Timeline:** Q3 2026  
**Benefit:** 12-month audit trail, compliance visibility  
**Implementation:**

```typescript
// lib/compliance-logger.ts
import { CloudWatchLogs } from "aws-sdk";

export const complianceLog = async (event: {
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  result: "success" | "failure";
  details: Record<string, any>;
}) => {
  const logs = new CloudWatchLogs();
  
  await logs.putLogEvents({
    logGroupName: "/cloudless/compliance-audit",
    logStreamName: `${event.user}/${new Date().toISOString().split("T")[0]}`,
    logEvents: [
      {
        timestamp: Date.now(),
        message: JSON.stringify(event),
      },
    ],
  }).promise();
};
```

**Compliance events to log:**
- User authentication (success/failure)
- Data access (user ID, resource, timestamp)
- Admin actions (settings changes, user management)
- Payment transactions (Stripe events)
- Failed security checks

---

## Implementation Checklist

### Q2 2026
- [ ] AWS WAF WebACL creation
- [ ] Rate limiting rule configuration (2000 req/5min)
- [ ] X-Ray tracing enablement in Lambda
- [ ] X-Ray dashboard setup (coldstart metrics)
- [ ] CloudWatch alarm creation (error threshold)

### Q3 2026
- [ ] CloudFront distribution creation
- [ ] Edge location cache strategy documentation
- [ ] Compliance logging infrastructure
- [ ] Audit log retention policy (12 months)
- [ ] Compliance notification alerts

### Q4 2026
- [ ] Performance optimization review
- [ ] Security audit re-assessment
- [ ] Annual penetration testing
- [ ] Compliance certification renewal

---

## Success Metrics

| Metric | Current | Target (Q4) | Method |
|--------|---------|------------|--------|
| Avg Response Time | 450ms | <300ms | CloudFront caching |
| Origin Requests | 100% | 40-60% | CDN offload |
| Lambda Cold Starts | 600ms | <200ms | Tracing + optimization |
| Security Incidents | 0 | 0 | WAF blocking |
| Audit Trail | None | 12-month | Compliance logging |
| CIS Score | B+ | A- | Enhancements |

---

## Cost Estimation

| Service | Monthly | Annual |
|---------|---------|--------|
| AWS WAF | $5 | $60 |
| X-Ray | $6 | $72 |
| CloudFront | $15 | $180 |
| Enhanced Logging | $10 | $120 |
| **Total** | **$36** | **$432** |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| CloudFront misconfiguration | Medium | Terraform validation, canary deploy |
| WAF rule false positives | Low | Gradual rollout, monitoring |
| Increased latency during setup | Low | Blue-green deployment |
| Cost overrun | Low | Budget alerts in CloudWatch |

---

## References

- [AWS WAF Best Practices](https://docs.aws.amazon.com/waf/latest/developerguide/best-practices.html)
- [X-Ray Concepts](https://docs.aws.amazon.com/xray/latest/devguide/xray-concepts.html)
- [CloudFront Optimization](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html)
- [Compliance Logging](https://docs.aws.amazon.com/general/latest/gr/log-service-health.html)

---

**Owner:** Security/DevOps Team  
**Status:** Ready for Q2 Planning  
**Last Updated:** 2026-04-09
