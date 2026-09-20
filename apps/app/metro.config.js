const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits in packages/core trigger a reload.
config.watchFolders = [workspaceRoot];
// Resolve from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Core is TypeScript source with explicit .ts import extensions.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
