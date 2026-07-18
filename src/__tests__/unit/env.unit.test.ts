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
      PORT: '4000',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.awsRegion).toBe('us-east-1');
      expect(env.dynamodbEndpoint).toBe('http://localhost:8000');
      expect(env.usersTableName).toBe('users-table');
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

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.port).toBe(3000);
      expect(env.dynamodbEndpoint).toBeUndefined();
      expect(env.usersTableName).toBe('users');
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
});
