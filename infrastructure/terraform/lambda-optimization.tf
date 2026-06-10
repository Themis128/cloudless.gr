# Lambda Performance Optimization
# Based on Lighthouse findings: TTFB slow, Lambda cold-start, serial queries

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.0.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "production"
}

# Lambda Function Configuration
# Current: 128MB default memory → slow cold-start, slow execution
# Recommended: 1024MB for 2vCPU equivalent, faster DB connections, parallel execution
data "aws_lambda_function" "main_app" {
  function_name = "cloudless-app-${var.environment}"
}

resource "aws_lambda_function_url" "main_app" {
  function_name          = data.aws_lambda_function.main_app.function_name
  authorization_type    = "NONE"
  cors {
    allow_credentials = true
    allow_headers     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins     = ["*"]
    max_age           = 86400
  }
}

# Lambda Provisioned Concurrency - Eliminate Cold Starts
# Problem: Lambda cold-start adds 800ms-1s to TTFB
# Solution: Keep 10 instances warm at all times
resource "aws_lambda_provisioned_concurrency_config" "main_app" {
  function_name                     = data.aws_lambda_function.main_app.function_name
  provisioned_concurrent_executions = 10
  qualifier                         = data.aws_lambda_function.main_app.version
  depends_on                        = [aws_lambda_function_url.main_app]
}

# CloudFront Distribution - Cache & Edge Optimization
# Problem: 300-500ms redirect chain /services → /en/services
# Solution: CloudFront origin request policy + Lambda@Edge for redirects
resource "aws_cloudfront_distribution" "main_app" {
  enabled = true

  origin {
    domain_name = trimprefix(trimsuffix(aws_lambda_function_url.main_app.function_url, "/"), "https://")
    origin_id   = "lambda-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behavior for static assets
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "lambda-origin"

    # Compress with Gzip & Brotli (reduces LCP by 30-40%)
    compress = true

    # Cache policy: static assets 1 year, HTML 5 minutes
    cache_policy_id = aws_cloudfront_cache_policy.static_assets.id

    # Origin request policy: forward auth headers
    origin_request_policy_id = aws_cloudfront_origin_request_policy.forward_auth.id

    viewer_protocol_policy = "redirect-to-https"
  }

  # Cache behavior for /en/* routes (HTML, cache 5 minutes)
  ordered_cache_behavior {
    path_pattern     = "/en/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "lambda-origin"
    compress         = true

    cache_policy_id            = aws_cloudfront_cache_policy.html_pages.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.forward_auth.id
    viewer_protocol_policy     = "redirect-to-https"

    # Lambda@Edge function to rewrite /services → /en/services at edge
    function_association {
      event_type   = "origin-request"
      function_arn = aws_cloudfront_function.rewrite_locale.arn
    }
  }

  # API routes (bypass cache, 10s default)
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]
    cached_methods   = []
    target_origin_id = "lambda-origin"

    cache_policy_id            = aws_cloudfront_cache_policy.api_bypass.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.forward_all.id
    viewer_protocol_policy     = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# CloudFront Cache Policy - Static Assets (1 year TTL)
resource "aws_cloudfront_cache_policy" "static_assets" {
  name            = "static-assets-1year"
  comment         = "Cache static assets for 1 year"
  default_ttl     = 31536000  # 1 year
  max_ttl         = 31536000
  min_ttl         = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    headers_config {
      header_behavior = "none"
    }
    cookies_config {
      cookie_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# CloudFront Cache Policy - HTML Pages (5 minutes TTL)
resource "aws_cloudfront_cache_policy" "html_pages" {
  name            = "html-pages-5min"
  comment         = "Cache HTML pages for 5 minutes"
  default_ttl     = 300   # 5 minutes
  max_ttl         = 3600  # 1 hour
  min_ttl         = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Accept-Encoding", "Authorization", "CloudFront-Is-Desktop-Viewer", "CloudFront-Is-Mobile-Viewer"]
      }
    }
    cookies_config {
      cookie_behavior = "all"
    }
    query_strings_config {
      query_string_behavior = "all"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# CloudFront Cache Policy - API (no cache, but connection reuse)
resource "aws_cloudfront_cache_policy" "api_bypass" {
  name            = "api-no-cache"
  comment         = "API routes - no caching"
  default_ttl     = 0
  max_ttl         = 0
  min_ttl         = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    headers_config {
      header_behavior = "all"
    }
    cookies_config {
      cookie_behavior = "all"
    }
    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

# CloudFront Origin Request Policy - Forward Auth Headers
resource "aws_cloudfront_origin_request_policy" "forward_auth" {
  name            = "forward-auth-headers"
  comment         = "Forward authentication headers to origin"

  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Authorization", "CloudFront-Viewer-Country", "User-Agent", "Cookie"]
    }
  }
  cookies_config {
    cookie_behavior = "all"
  }
  query_strings_config {
    query_string_behavior = "none"
  }
}

# CloudFront Origin Request Policy - Forward All (for API)
resource "aws_cloudfront_origin_request_policy" "forward_all" {
  name            = "forward-all"
  comment         = "Forward all headers, cookies, query strings"

  headers_config {
    header_behavior = "all"
  }
  cookies_config {
    cookie_behavior = "all"
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

# CloudFront Function - Rewrite /services → /en/services at Edge
# Eliminates 300-500ms 302 redirect round-trip
resource "aws_cloudfront_function" "rewrite_locale" {
  name    = "rewrite-locale-prefix"
  runtime = "cloudfront-js-1.0"
  publish = true
  code    = <<-EOL
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      // Rewrite /services → /en/services, /contact → /en/contact, etc.
      if (uri === '/services' || uri === '/services/') {
        request.uri = '/en/services';
      } else if (uri === '/contact' || uri === '/contact/') {
        request.uri = '/en/contact';
      } else if (uri === '/store' || uri === '/store/') {
        request.uri = '/en/store';
      } else if (uri === '/' || uri === '') {
        request.uri = '/en';
      }

      return request;
    }
  EOL
}

# RDS Connection Pooling - Reduce Serial Query Execution
# Problem: Database queries serialize in getServerSideProps, blocking TTFB
# Solution: RDS Proxy for connection pooling (multiplexing 100 connections to 5)
resource "aws_db_proxy" "main" {
  name                   = "cloudless-app-proxy"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.db_proxy.arn

  # Target DB cluster (adjust to your actual cluster)
  target {
    db_instance_identifiers = ["cloudless-db"]  # Replace with actual DB instance
  }

  # Connection pooling: 1 minute idle timeout, 100 max connections
  connection_borrow_timeout          = 120
  session_pinning_filters            = []
  max_idle_connections               = 5
  max_connections                    = 100
  require_tls                        = true
}

# IAM Role for RDS Proxy
resource "aws_iam_role" "db_proxy" {
  name = "cloudless-db-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "rds.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "db_proxy" {
  name = "cloudless-db-proxy-policy"
  role = aws_iam_role.db_proxy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds"
      ]
      Resource = "*"
    }]
  })
}

# Outputs
output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.main_app.domain_name
  description = "CloudFront distribution domain name"
}

output "lambda_url" {
  value       = aws_lambda_function_url.main_app.function_url
  description = "Lambda function URL (origin)"
}
