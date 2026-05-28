/* jshint esversion: 11, node: true */
// Minimal stub — prevents @aws-sdk/util-endpoints from crashing under JSDOM.
// Tests that need Bedrock behaviour supply their own vi.mock().
module.exports = {
  BedrockRuntimeClient: class {},
  ConverseCommand: class {},
  InvokeModelCommand: class {},
};
