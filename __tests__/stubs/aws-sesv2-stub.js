// Minimal stub — prevents @aws-sdk/util-endpoints from crashing under JSDOM.
// Tests that need SES behaviour supply their own vi.mock().
module.exports = {
  SESv2Client: class {},
  SendEmailCommand: class {},
  CreateEmailIdentityCommand: class {},
  DeleteEmailIdentityCommand: class {},
  GetSuppressedDestinationCommand: class {},
  PutSuppressedDestinationCommand: class {},
  DeleteSuppressedDestinationCommand: class {},
};
