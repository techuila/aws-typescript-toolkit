const dynamoPreset = require('@shelf/jest-dynamodb/jest-preset');
const tsJesPreset = require('ts-jest/presets/js-with-ts/jest-preset');

module.exports = {
  ...dynamoPreset,
  ...tsJesPreset,
  clearMocks: true,
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: ['**/src/**/*.[jt]s?(x)'],
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/*.test.ts'],
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    'node_modules/serialize-error/.+\\.(j|t)sx?$': 'ts-jest'
  },
  transformIgnorePatterns: ['node_modules/(?!serialize-error)/']
};
