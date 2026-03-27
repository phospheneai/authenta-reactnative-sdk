const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// ─── Monorepo paths ───────────────────────────────────────────────────────────
// examples/AuthentaDemo → ../.. → monorepo root
const monoRoot    = path.resolve(__dirname, '../..');
const coreRoot    = path.resolve(monoRoot, 'packages/core');
const rnRoot      = path.resolve(monoRoot, 'packages/react-native');

const config = {
  // Watch the entire monorepo so Metro picks up rebuilds of the SDK packages.
  watchFolders: [monoRoot],

  resolver: {
    extraNodeModules: {
      // SDK packages — resolve to the local package roots.
      // Metro reads their package.json `main` field → dist/index.js
      '@authenta/core':         coreRoot,
      '@authenta/react-native': rnRoot,

      // Peer deps — always resolved from this app's own node_modules
      // to avoid duplicate React / React Native instance errors.
      'react':                      path.resolve(__dirname, 'node_modules/react'),
      'react-native':               path.resolve(__dirname, 'node_modules/react-native'),
      'react-native-vision-camera': path.resolve(__dirname, 'node_modules/react-native-vision-camera'),
      'react-native-image-picker':  path.resolve(__dirname, 'node_modules/react-native-image-picker'),
      '@babel/runtime':             path.resolve(__dirname, 'node_modules/@babel/runtime'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
