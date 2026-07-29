# IAM: Cognito read-only for migration verification

cognito-readonly-omv-main-cli.json grants the cluster IAM user
(arn:aws:iam::278585680617:user/omv-main-cli) READ-ONLY access to the Cognito user
pool us-east-1_1Bq3Mpqer. This unblocks verifying the app client ID, the admin group
name, and the Hosted UI domain - the remaining unknowns for PR #730.

It grants NO write/admin actions (no create/update/delete of users, clients, or groups)
and is scoped to the single pool ARN.

## Apply (review first)

    aws iam put-user-policy \
      --user-name omv-main-cli \
      --policy-name CognitoReadOnlyMigration \
      --policy-document file://k8s/iam/cognito-readonly-omv-main-cli.json \
      --region us-east-1

## After verification, the runtime admin/users route also needs (separately)

The /api/admin/users route performs admin actions at runtime (enable/disable user,
add/remove from group, list users/groups). When that route goes live it needs a role with:
cognito-idp:ListUsers, AdminListGroupsForUser, AdminEnableUser, AdminDisableUser,
AdminAddUserToGroup, AdminRemoveUserFromGroup on the pool ARN. Scope that to the
deployment role - NOT the broad CLI user. (Deliberately excluded from this read-only policy.)

## Remove when done verifying

    aws iam delete-user-policy --user-name omv-main-cli --policy-name CognitoReadOnlyMigration
