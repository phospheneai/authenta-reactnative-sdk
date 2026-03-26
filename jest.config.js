module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        skipLibCheck: true,
        allowJs: true,
        noImplicitAny: false,
      },
    },
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/build/', '/dist/', 'client.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vision-camera|react-native-image-picker)/)',
  ],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native-vision-camera$': '<rootDir>/__mocks__/react-native-vision-camera.js',
    '^react-native-image-picker$': '<rootDir>/__mocks__/react-native-image-picker.js',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};