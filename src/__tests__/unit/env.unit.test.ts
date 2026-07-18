const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('When we load the environment configuration', () => {
  it('should expose the values when required variables are set', () => {
    process.env = {
      ...ORIGINAL_ENV,
      AWS_REGION: 'us-east-1',
      DYNAMODB_ENDPOINT: 'http://localhost:8000',
      DYNAMODB_USERS_TABLE: 'users-table',
      SQS_USER_NEW_QUEUE_URL: 'http://localhost:9324/queue/user-new',
      SQS_USER_NEW_DLQ_ARN: 'arn:aws:sqs:us-east-1:000000000000:user-new-dlq',
      SQS_ENDPOINT: 'http://localhost:9324',
      PORT: '4000',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.awsRegion).toBe('us-east-1');
      expect(env.dynamodbEndpoint).toBe('http://localhost:8000');
      expect(env.usersTableName).toBe('users-table');
      expect(env.sqsUserNewQueueUrl).toBe(
        'http://localhost:9324/queue/user-new',
      );
      expect(env.sqsUserNewDlqArn).toBe(
        'arn:aws:sqs:us-east-1:000000000000:user-new-dlq',
      );
      expect(env.sqsEndpoint).toBe('http://localhost:9324');
      expect(env.port).toBe(4000);
    });
  });

  it('should fall back to the defaults when optional variables are not set', () => {
    process.env = {
      ...ORIGINAL_ENV,
      AWS_REGION: 'us-east-1',
    };
    delete process.env.PORT;
    delete process.env.DYNAMODB_ENDPOINT;
    delete process.env.DYNAMODB_USERS_TABLE;
    delete process.env.SQS_ENDPOINT;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.port).toBe(3000);
      expect(env.dynamodbEndpoint).toBeUndefined();
      expect(env.usersTableName).toBe('users');
      expect(env.sqsEndpoint).toBeUndefined();
    });
  });

  it('should throw naming the missing required variable', () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AWS_REGION;

    jest.isolateModules(() => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../infrastructure/config/env'),
      ).toThrow('Missing required environment variable: AWS_REGION');
    });
  });

  it('should throw when the USER.NEW queue url is not set', () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SQS_USER_NEW_QUEUE_URL;

    jest.isolateModules(() => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../infrastructure/config/env'),
      ).toThrow(
        'Missing required environment variable: SQS_USER_NEW_QUEUE_URL',
      );
    });
  });

  it('should throw when the USER.NEW DLQ arn is not set', () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SQS_USER_NEW_DLQ_ARN;

    jest.isolateModules(() => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../infrastructure/config/env'),
      ).toThrow('Missing required environment variable: SQS_USER_NEW_DLQ_ARN');
    });
  });
});
