const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read package.json to compute VSIX file name as <name>-<version>.vsix
const pkg = require('../package.json');
const vsixName = `${pkg.name}-${pkg.version}.vsix`;

// VSIX output path (saved at repo root)
const vsixSource = path.resolve(__dirname, '..', vsixName);

// Target directory for smoke tests (Windows/macOS friendly)
const targetDir = path.resolve(
  process.env.USERPROFILE || process.env.HOME || '',
  'vscode-extensions',
  'vscode-react-native',
  'test',
  'smoke',
  'resources',
  'extension'
);

function buildVsix() {
  console.log('📦 Packaging VSIX...');
  execSync(`npx vsce package -o "${vsixSource}"`, { stdio: 'inherit' });
  if (!fs.existsSync(vsixSource)) {
    throw new Error('❌ VSIX not found. Ensure `vsce package` succeeded and entry file is not ignored.');
  }
  console.log(`✅ VSIX packaged: ${vsixSource}`);
}

function copyVsix() {
  console.log('📂 Copying VSIX to smoke resources...');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, path.basename(vsixSource));
  fs.copyFileSync(vsixSource, targetPath);
  console.log(`✅ Copied to: ${targetPath}`);
}

function runSmokeTests() {
  console.log('🚀 Running smoke tests...');
  execSync('npm run smoke-tests', { stdio: 'inherit' });
  console.log('✅ Smoke tests completed');
}

try {
  buildVsix();
  copyVsix();
  if (process.argv.includes('--test')) {
    runSmokeTests();
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}