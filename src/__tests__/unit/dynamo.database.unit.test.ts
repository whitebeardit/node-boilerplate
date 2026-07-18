import { DynamoDatabase } from '../../infrastructure/db/dynamo/dynamo.database';
import { dynamoClient } from '../../infrastructure/db/dynamo/dynamo.client';

describe('When the table check fails with an unexpected error', () => {
  it('should rethrow instead of trying to create the table', async () => {
    const sendSpy = jest
      .spyOn(dynamoClient, 'send')
      .mockRejectedValue(new Error('network down') as never);

    await expect(new DynamoDatabase().start()).rejects.toThrow('network down');
    expect(sendSpy).toHaveBeenCalledTimes(1);

    sendSpy.mockRestore();
  });
});

describe('When we close the database', () => {
  it('should destroy the DynamoDB client', async () => {
    const destroySpy = jest
      .spyOn(dynamoClient, 'destroy')
      .mockImplementation(() => undefined);

    await new DynamoDatabase().close();
    expect(destroySpy).toHaveBeenCalledTimes(1);

    destroySpy.mockRestore();
  });
});

describe('When we build the client without a custom endpoint', () => {
  it('should fall back to the default AWS endpoint resolution', () => {
    const PREVIOUS_ENDPOINT = process.env.DYNAMODB_ENDPOINT;
    delete process.env.DYNAMODB_ENDPOINT;

    jest.isolateModules(() => {
      const {
        dynamoClient: client,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
      } = require('../../infrastructure/db/dynamo/dynamo.client');
      expect(client.config.endpoint).toBeUndefined();
    });

    if (PREVIOUS_ENDPOINT !== undefined) {
      process.env.DYNAMODB_ENDPOINT = PREVIOUS_ENDPOINT;
    }
  });
});
