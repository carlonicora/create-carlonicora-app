module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          baseUrl: '.',
          paths: {
            'src/*': ['src/*']
          }
        }
      }
    ]
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1'
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  testTimeout: 30000,
  setupFilesAfterEnv: [],
  verbose: true
};