/* jshint esversion: 11, node: true */
// Minimal stub — actual behaviour is replaced by vi.mock() at test time.
// Prevents @aws-sdk/util-endpoints from crashing under JSDOM during module init.
module.exports = {
  CognitoIdentityProviderClient: class {},
  ListUsersCommand: class {},
  AdminDisableUserCommand: class {},
  AdminEnableUserCommand: class {},
  AdminAddUserToGroupCommand: class {},
  AdminRemoveUserFromGroupCommand: class {},
  AdminListGroupsForUserCommand: class {},
};
