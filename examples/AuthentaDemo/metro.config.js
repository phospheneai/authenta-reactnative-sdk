const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Use the packaged SDK (dist-only, no node_modules) — avoids version conflicts
const sdkRoot = path.resolve(__dirname, 'node_modules/@authenta/react-native-sdk');

const config = {
  watchFolders: [sdkRoot],
  resolver: {
    // The SDK dist files are re-processed by Metro's Babel and need these peer deps
    // resolved from the demo app, since the SDK package has no node_modules of its own.
    extraNodeModules: {
      '@babel/runtime': path.resolve(__dirname, 'node_modules/@babel/runtime'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
      'react-native-vision-camera': path.resolve(__dirname, 'node_modules/react-native-vision-camera'),
      'react-native-image-picker': path.resolve(__dirname, 'node_modules/react-native-image-picker'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
