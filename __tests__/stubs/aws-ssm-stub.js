// Minimal stub — actual behaviour is replaced by vi.mock("@/lib/ssm-config") at test time.
// Prevents @aws-sdk/util-endpoints from crashing under JSDOM during module init.
module.exports = { SSMClient: class {}, GetParametersByPathCommand: class {} };
