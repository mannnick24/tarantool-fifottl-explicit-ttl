process.env.TZ = 'UTC'

module.exports = {
    roots: ['<rootDir>/tests'],
    transform: {
      '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: '\\.it.ts$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    globalSetup: './tests/setupIntegration.js',
    globalTeardown: './tests/teardownIntegration.js',
    testRunner: 'jest-circus/runner',
    testTimeout: 10000,
}
