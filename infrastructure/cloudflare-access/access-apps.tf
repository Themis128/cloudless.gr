# R15: Cloudflare Access applications for admin tunnel hosts
# Creates Access Applications + Service Tokens for zero-trust authentication
# Prerequisite: CLOUDFLARE_API_TOKEN in SSM with Account.Access: Apps scope

terraform {
  required_version = ">= 1.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# Cloudflare Zone
data "cloudflare_zone" "cloudless_gr" {
  name = "cloudless.gr"
}

# ----------------------------------------------------------------------------
# One-time PIN (OTP) identity provider
# Cloudflare Access requires an identity provider to generate and email the
# verification code. Without an `onetimepin` IdP wired into the application's
# `allowed_idps`, no OTP email is ever sent — the login page just sits at
# "Enter your code" with nothing in the inbox.
#
# The PIN is emailed to the address entered at login, expires in 10 minutes,
# and is single-use. The destination address must be verified under
# Cloudflare Email Routing for delivery (see scripts/configure-email-routing.sh).
# ----------------------------------------------------------------------------
resource "cloudflare_zero_trust_access_identity_provider" "onetimepin" {
  account_id = var.cloudflare_account_id
  name       = "One-time PIN login"
  type       = "onetimepin"
  config     = {}
}

# Access Applications for admin hosts
resource "cloudflare_access_application" "grafana" {
  zone_id          = data.cloudflare_zone.cloudless_gr.id
  name             = "Grafana Admin"
  domain           = "grafana.cloudless.gr"
  session_duration = "1h"
  auto_redirect    = true
  # Allow login via the One-time PIN identity provider
  allowed_idps     = [cloudflare_zero_trust_access_identity_provider.onetimepin.id]
}

resource "cloudflare_access_application" "kuma" {
  zone_id          = data.cloudflare_zone.cloudless_gr.id
  name             = "Uptime Kuma Admin"
  domain           = "kuma.cloudless.gr"
  session_duration = "1h"
  auto_redirect    = true
  allowed_idps     = [cloudflare_zero_trust_access_identity_provider.onetimepin.id]
}

resource "cloudflare_access_application" "appflowy" {
  zone_id          = data.cloudflare_zone.cloudless_gr.id
  name             = "AppFlowy Admin"
  domain           = "appflowy.cloudless.gr"
  session_duration = "1h"
  auto_redirect    = true
  allowed_idps     = [cloudflare_zero_trust_access_identity_provider.onetimepin.id]
}

resource "cloudflare_access_application" "n8n" {
  zone_id          = data.cloudflare_zone.cloudless_gr.id
  name             = "n8n Admin"
  domain           = "n8n.cloudless.gr"
  session_duration = "1h"
  auto_redirect    = true
  allowed_idps     = [cloudflare_zero_trust_access_identity_provider.onetimepin.id]
}

# Access Policies - Allow unified admin only
resource "cloudflare_access_policy" "grafana_policy" {
  application_id = cloudflare_access_application.grafana.id
  zone_id        = data.cloudflare_zone.cloudless_gr.id
  name           = "Admin access"
  precedence     = 1
  decision       = "allow"

  include {
    email = ["tbaltzakis@cloudless.gr"]
  }
}

resource "cloudflare_access_policy" "kuma_policy" {
  application_id = cloudflare_access_application.kuma.id
  zone_id        = data.cloudflare_zone.cloudless_gr.id
  name           = "Admin access"
  precedence     = 1
  decision       = "allow"

  include {
    email = ["tbaltzakis@cloudless.gr"]
  }
}

resource "cloudflare_access_policy" "appflowy_policy" {
  application_id = cloudflare_access_application.appflowy.id
  zone_id        = data.cloudflare_zone.cloudless_gr.id
  name           = "Admin access"
  precedence     = 1
  decision       = "allow"

  include {
    email = ["tbaltzakis@cloudless.gr"]
  }
}

resource "cloudflare_access_policy" "n8n_policy" {
  application_id = cloudflare_access_application.n8n.id
  zone_id        = data.cloudflare_zone.cloudless_gr.id
  name           = "Admin access"
  precedence     = 1
  decision       = "allow"

  include {
    email = ["tbaltzakis@cloudless.gr"]
  }
}

# Service Tokens for programmatic access (from cloudless.gr)
resource "cloudflare_access_service_token" "grafana_token" {
  name           = "cloudless-grafana-access"
  application_id = cloudflare_access_application.grafana.id
}

resource "cloudflare_access_service_token" "kuma_token" {
  name           = "cloudless-kuma-access"
  application_id = cloudflare_access_application.kuma.id
}

resource "cloudflare_access_service_token" "appflowy_token" {
  name           = "cloudless-appflowy-access"
  application_id = cloudflare_access_application.appflowy.id
}

resource "cloudflare_access_service_token" "n8n_token" {
  name           = "cloudless-n8n-access"
  application_id = cloudflare_access_application.n8n.id
}

# Outputs for SSM storage
output "service_tokens" {
  value = {
    grafana = {
      client_id     = cloudflare_access_service_token.grafana_token.client_id
      client_secret = cloudflare_access_service_token.grafana_token.client_secret
    }
    kuma = {
      client_id     = cloudflare_access_service_token.kuma_token.client_id
      client_secret = cloudflare_access_service_token.kuma_token.client_secret
    }
    appflowy = {
      client_id     = cloudflare_access_service_token.appflowy_token.client_id
      client_secret = cloudflare_access_service_token.appflowy_token.client_secret
    }
    n8n = {
      client_id     = cloudflare_access_service_token.n8n_token.client_id
      client_secret = cloudflare_access_service_token.n8n_token.client_secret
    }
  }
  sensitive = true
}

output "onetimepin_idp_id" {
  value = cloudflare_zero_trust_access_identity_provider.onetimepin.id
}