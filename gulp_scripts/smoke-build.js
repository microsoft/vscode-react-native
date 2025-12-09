const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read package.json to compute VSIX file name as <name>-<version>.vsix
const pkg = require('../package.json');
const vsixName = `${pkg.name}-${pkg.version}.vsix`;

// VSIX output path (saved at repo root temporarily; removed after copy)
const repoRoot = path.resolve(__dirname, '..');
const vsixSource = path.resolve(repoRoot, vsixName);

// Target directory for smoke tests (repo-relative, matches test expectations)
const targetDir = path.resolve(
  repoRoot,
  'test',
  'smoke',
  'resources',
  'extension'
);

function removeVsixFilesInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry.toLowerCase().endsWith('.vsix')) {
      try {
        fs.unlinkSync(path.join(dir, entry));
        console.log(`Removed VSIX: ${path.join(dir, entry)}`);
      } catch (e) {
        console.warn(`Failed to remove VSIX ${entry} in ${dir}: ${String(e)}`);
      }
    }
  }
}

function removeOtherVsixFilesExceptTarget(rootDir, targetDirAbs) {
  // Remove VSIX files in repo root and known locations except target directory
  // 1) repo root
  removeVsixFilesInDir(rootDir);
  // 2) test/smoke root
  removeVsixFilesInDir(path.join(rootDir, 'test'));
  removeVsixFilesInDir(path.join(rootDir, 'test', 'smoke'));
  removeVsixFilesInDir(path.join(rootDir, 'test', 'smoke', 'resources'));
  // 3) explicit extension target handled separately
  // Any accidental VSIX in node_modules or dist should be ignored/not expected.
}

function buildVsix() {
  console.log('Packaging VSIX...');
  execSync(`npx vsce package -o "${vsixSource}"`, { stdio: 'inherit' });
  if (!fs.existsSync(vsixSource)) {
    throw new Error('VSIX not found. Ensure `vsce package` succeeded and entry file is not ignored.');
  }
  console.log(`VSIX packaged: ${vsixSource}`);
}

function copyVsix() {
  console.log('Copying VSIX to smoke resources...');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  // Ensure only one VSIX exists in target by cleaning any existing ones
  removeVsixFilesInDir(targetDir);
  const targetPath = path.join(targetDir, path.basename(vsixSource));
  fs.copyFileSync(vsixSource, targetPath);
  console.log(`Copied to: ${targetPath}`);
  // Remove the source VSIX from repo root to avoid duplicates elsewhere
  try {
    fs.unlinkSync(vsixSource);
    console.log(`Removed source VSIX from repo root: ${vsixSource}`);
  } catch (e) {
    console.warn(`Failed to remove source VSIX at repo root: ${String(e)}`);
  }
}

function runSmokeTests() {
  console.log('Running smoke tests...');
  execSync('npm run smoke-tests', { stdio: 'inherit' });
  console.log('Smoke tests completed');
}

try {
  // Clean any stray VSIX files in common locations before building
  removeOtherVsixFilesExceptTarget(repoRoot, targetDir);
  buildVsix();
  copyVsix();
  if (process.argv.includes('--test')) {
    runSmokeTests();
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}