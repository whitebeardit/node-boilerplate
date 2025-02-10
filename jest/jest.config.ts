import type { Config } from 'jest';
process.env.TZ = 'UTC';

const TWENTY_SECONDS_OF_TIMEOUT = 20000;

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../src',
  bail: 1,
  testRegex: '.*\\.unit.test\\.ts$',
  setupFiles: ['../jest/setup-tests.ts'],
  testEnvironment: 'node',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/test/**'],
  coveragePathIgnorePatterns: [
    '/src/server.ts',
    '/src/contracts/',
    '/src/__tests__',
    '/src/constants.ts',
  ],
  coverageDirectory: '../coverage/unit',
  preset: 'ts-jest',
  testTimeout: TWENTY_SECONDS_OF_TIMEOUT,
};

export default config;
