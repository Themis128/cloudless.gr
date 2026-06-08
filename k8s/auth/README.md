# oauth2-proxy (manage.cloudless.gr) - Keycloak to Cognito

oauth2-proxy.yaml repoints the manage.cloudless.gr auth gateway from the now-removed
Keycloak to AWS Cognito (pool us-east-1_1Bq3Mpqer). It also removes the
wait-for-keycloak initContainer that left the pod stuck in Init:0/1 forever.

This deployment was previously applied out-of-band (not tracked in git); this manifest
captures the corrected desired state.

## Pre-flight (MUST do before applying)

1. In the Cognito console, open app client 63d3fu5lp057694h0t70je4jk0 and confirm:
   - Allowed callback URL includes https://manage.cloudless.gr/oauth2/callback
   - OIDC / Hosted UI flows enabled (Authorization code grant; scopes: openid, email, profile)
2. Confirm the k8s secret matches SSM:
   kubectl get secret oauth2-proxy-secret -n cloudless -o jsonpath="{.data.client-secret}" | base64 -d
   should equal SSM /cloudless/production/oauth2-proxy-client-secret

A missing callback URL will break manage.cloudless.gr login - do not skip step 1.

## Apply

    kubectl apply -f k8s/auth/oauth2-proxy.yaml
    kubectl rollout status deployment/oauth2-proxy -n cloudless --timeout=120s
    kubectl get pods -n cloudless -l app=oauth2-proxy
    # then verify a real login at https://manage.cloudless.gr

## Rollback

    kubectl rollout undo deployment/oauth2-proxy -n cloudless