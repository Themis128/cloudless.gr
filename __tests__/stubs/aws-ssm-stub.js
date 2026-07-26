/* jshint esversion: 11, node: true */
// Minimal stub — actual behaviour is replaced by vi.mock() at test time.
// Prevents @aws-sdk/util-endpoints from crashing under JSDOM during module init.
// Exports every command used across src/ so vitest auto-mocks never complain about
// missing exports (e.g. PutParameterCommand in pending-clients.ts).
module.exports = {
  SSMClient: class {},
  GetParametersByPathCommand: class {},
  GetParameterCommand: class {},
  PutParameterCommand: class {},
  DeleteParameterCommand: class {},
};
