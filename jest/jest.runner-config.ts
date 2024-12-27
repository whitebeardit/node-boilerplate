import integrationConfig from './jest.int-config';

const config = {
  ...integrationConfig,
  testRegex: '.*\\.test\\.ts$',
  testTimeout: 300000,
};

export default config;
