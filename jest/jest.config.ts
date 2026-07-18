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
  // Runtime bootstrap (main.ts, telemetry SDK) is exercised at runtime, not by
  // tests. The 80/80 threshold is enforced on the merged unit+int report via
  // `yarn coverage:check` (nyc), since each suite covers different layers.
  collectCoverageFrom: [
    '**/*.ts',
    '!main.ts',
    '!infrastructure/telemetry/tracing.ts',
  ],
  coveragePathIgnorePatterns: ['/src/contracts/', '/src/__tests__'],
  coverageDirectory: '../coverage/unit',
  preset: 'ts-jest',
  testTimeout: TWENTY_SECONDS_OF_TIMEOUT,
};

export default config;
