const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const monoRoot = path.resolve(__dirname, '../..');
const coreRoot = path.resolve(monoRoot, 'packages/core');
const rnRoot   = path.resolve(monoRoot, 'packages/react-native');

// Escape a string for literal use inside a RegExp
const esc = s => s.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');

const config = {
  watchFolders: [monoRoot],

  resolver: {
    // Block the root-level react and react-native from being bundled.
    // Without this, Metro follows Node's upward resolution from the SDK
    // packages and picks up the root copies instead of the app's own copies,
    // causing Flow-syntax parse errors (root copy is not pre-transformed).
    blockList: [
      new RegExp(`^${esc(path.join(monoRoot, 'node_modules', 'react'))}[/\\\\].*`),
      new RegExp(`^${esc(path.join(monoRoot, 'node_modules', 'react-native'))}[/\\\\].*`),
    ],

    extraNodeModules: {
      '@authenta/core':         coreRoot,
      '@authenta/react-native': rnRoot,
      'react':                      path.resolve(__dirname, 'node_modules/react'),
      'react-native':               path.resolve(__dirname, 'node_modules/react-native'),
      'react-native-vision-camera': path.resolve(__dirname, 'node_modules/react-native-vision-camera'),
      'react-native-image-picker':  path.resolve(__dirname, 'node_modules/react-native-image-picker'),
      '@babel/runtime':             path.resolve(__dirname, 'node_modules/@babel/runtime'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
