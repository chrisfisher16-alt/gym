const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Ensure the monorepo root is watched
config.watchFolders = [monorepoRoot];

// Let Metro resolve packages from both local and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Find the zustand package root (CJS files are alongside package.json)
const zustandRoot = path.join(monorepoRoot, 'node_modules', 'zustand');

// Force CJS resolution for zustand on web and shim native-only modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Shim native-only modules on web
  if (platform === 'web' && moduleName === 'react-native-worklets') {
    return { filePath: path.resolve(projectRoot, 'src/lib/react-native-worklets-web-shim.js'), type: 'sourceFile' };
  }

  if (platform === 'web' && (moduleName === 'zustand' || moduleName.startsWith('zustand/'))) {
    // Map module names to CJS files
    let cjsFile;
    if (moduleName === 'zustand') {
      cjsFile = path.join(zustandRoot, 'index.js');
    } else {
      // e.g. zustand/vanilla -> vanilla.js, zustand/middleware -> middleware.js
      const subpath = moduleName.replace('zustand/', '');
      cjsFile = path.join(zustandRoot, subpath + '.js');
    }

    if (fs.existsSync(cjsFile)) {
      return { filePath: cjsFile, type: 'sourceFile' };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
