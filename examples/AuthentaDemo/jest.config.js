module.exports = {
  preset: 'react-native',

  // Map SDK package imports to their compiled dist output
  moduleNameMapper: {
    '^@authenta/core$':         '<rootDir>/../../packages/core/dist/index.js',
    '^@authenta/react-native$': '<rootDir>/../../packages/react-native/dist/index.js',
  },

  // Tell Jest to transform these packages (they ship as ESM / raw TypeScript via symlink)
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vision-camera|react-native-image-picker)/)',
  ],

  setupFiles: [],
};
