#!/usr/bin/env python3
"""Fix lambda-optimization.tf to pass terraform validate (aws provider 5.80)."""

import re
import sys

p = sys.argv[1] if len(sys.argv) > 1 else "infrastructure/terraform/lambda-optimization.tf"
s = open(p).read()

old1 = """      header_behavior = "all"
    }
    cookies_config {
      cookie_behavior = "all"
    }
    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

# CloudFront Origin Request Policy"""
new1 = """      header_behavior = "none"
    }
    cookies_config {
      cookie_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# CloudFront Origin Request Policy"""
if old1 in s:
    s = s.replace(old1, new1)
    print("OK: fix 1")
else:
    print("WARN: fix 1 not found")

old2 = """  headers_config {
    header_behavior = "all"
  }
  cookies_config {
    cookie_behavior = "all"
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}"""
new2 = """  headers_config {
    header_behavior = "allViewer"
  }
  cookies_config {
    cookie_behavior = "all"
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print("OK: fix 2")
else:
    print("WARN: fix 2 not found")

m = re.search(r"# RDS Connection Pooling.*?^\}", s, re.M | re.S)
if m:
    new3 = """# RDS Connection Pooling — gated behind var.enable_rds_proxy
variable "enable_rds_proxy" {
  type    = bool
  default = false
}

variable "rds_proxy_vpc_subnet_ids" {
  type    = list(string)
  default = []
}

variable "rds_proxy_secret_arn" {
  type    = string
  default = ""
}

resource "aws_db_proxy" "main" {
  count          = var.enable_rds_proxy ? 1 : 0
  name           = "cloudless-app-proxy"
  debug_logging  = false
  engine_family  = "POSTGRESQL"
  role_arn       = aws_iam_role.db_proxy.arn
  vpc_subnet_ids = var.rds_proxy_vpc_subnet_ids
  require_tls    = true

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = var.rds_proxy_secret_arn
  }
}

resource "aws_db_proxy_default_target_group" "main" {
  count         = var.enable_rds_proxy ? 1 : 0
  db_proxy_name = aws_db_proxy.main[0].name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 100
    max_idle_connections_percent = 50
    session_pinning_filters      = []
  }
}"""
    s = s[: m.start()] + new3 + s[m.end() :]
    print("OK: fix 3")
else:
    print("WARN: fix 3 not found")

open(p, "w").write(s)
print("Wrote", p)
