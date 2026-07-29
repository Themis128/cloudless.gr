# R24: Route 53 health check + failover DNS for AWS-side DR
#
# PRIMARY remains the existing CloudFront / SST origin.
# SECONDARY points at the us-west-2 standby Lambda function URL.

variable "hosted_zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for cloudless.gr"
}

variable "primary_fqdn" {
  type        = string
  default     = "cloudless.gr"
  description = "FQDN that receives the failover record set"
}

variable "primary_alias_dns_name" {
  type        = string
  description = "CloudFront DNS name for PRIMARY"
}

variable "primary_alias_zone_id" {
  type        = string
  description = "CloudFront hosted zone ID for PRIMARY alias"
  default     = "Z2FDTNDATAQYW2"
}

variable "health_check_path" {
  type    = string
  default = "/api/health"
}

resource "aws_route53_health_check" "primary" {
  fqdn              = var.primary_fqdn
  port              = 443
  type              = "HTTPS"
  resource_path     = var.health_check_path
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name    = "${var.project}-r24-primary"
    Purpose = "r24-dr"
  }
}

# PRIMARY — CloudFront alias, failover = PRIMARY
resource "aws_route53_record" "primary" {
  zone_id = var.hosted_zone_id
  name    = var.primary_fqdn
  type    = "A"

  set_identifier = "r24-primary"
  failover_routing_policy {
    type = "PRIMARY"
  }

  alias {
    name                   = var.primary_alias_dns_name
    zone_id                = var.primary_alias_zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.primary.id
}

# SECONDARY — standby Lambda function URL (CNAME to host part)
resource "aws_route53_record" "secondary" {
  zone_id = var.hosted_zone_id
  name    = var.primary_fqdn
  type    = "CNAME"
  ttl     = 60

  set_identifier = "r24-secondary"
  failover_routing_policy {
    type = "SECONDARY"
  }

  records = [
    replace(replace(aws_lambda_function_url.standby.function_url, "https://", ""), "/", "")
  ]
}

output "primary_health_check_id" {
  value = aws_route53_health_check.primary.id
}
