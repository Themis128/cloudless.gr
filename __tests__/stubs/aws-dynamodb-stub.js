/* jshint esversion: 11, node: true */
// Minimal stub — prevents @smithy/core subpath crash under JSDOM.
// Tests that exercise DynamoDB behaviour supply their own vi.mock().
module.exports = {
  DynamoDBClient: class {},
  PutItemCommand: class {},
  GetItemCommand: class {},
  UpdateItemCommand: class {},
  DeleteItemCommand: class {},
  QueryCommand: class {},
  ScanCommand: class {},
  TransactWriteItemsCommand: class {},
};
