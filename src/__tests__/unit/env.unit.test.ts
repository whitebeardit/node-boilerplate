const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('When we load the environment configuration', () => {
  it('should expose the values when required variables are set', () => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URI: 'mongodb://localhost/test',
      PORT: '4000',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.databaseUri).toBe('mongodb://localhost/test');
      expect(env.port).toBe(4000);
    });
  });

  it('should fall back to port 3000 when PORT is not set', () => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URI: 'mongodb://localhost/test',
    };
    delete process.env.PORT;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.port).toBe(3000);
    });
  });

  it('should throw naming the missing required variable', () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DATABASE_URI;

    jest.isolateModules(() => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../infrastructure/config/env'),
      ).toThrow('Missing required environment variable: DATABASE_URI');
    });
  });
});
