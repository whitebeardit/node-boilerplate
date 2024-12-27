import type { Config } from 'jest';
import defaultConfig from './jest.config';

const config: Config = {
  ...defaultConfig,
  testRegex: '.*\\.int.test\\.ts$',
  coverageDirectory: '../coverage/int',
  setupFilesAfterEnv: ['../jest/setup-integration-tests.ts'],
  setupFiles: [...defaultConfig.setupFiles!],
  globalSetup: '../jest/start-integration.ts',
  globalTeardown: '../jest/stop-integration.ts',
};

export default config;
