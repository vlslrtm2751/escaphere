/**
 * Logic test runner.
 *
 * `node --test <dir>/*.test.js` looks like it fails loudly when there's
 * nothing to run, but it doesn't. A glob that matches zero files is silently
 * dropped -- by the shell on Linux, or by Node itself on Windows -- and
 * `node --test` then falls back to its own default discovery over the whole
 * tree, which can exit 0 having run nothing. The directory form
 * (`node --test <dir>/`) is no better: Node tries to `require` the directory
 * itself and dies with MODULE_NOT_FOUND before any test runs.
 *
 *   npm run test:logic
 *
 * This walks the compiled test directory itself, fails loudly (and names the
 * directory it looked in) if it finds no *.test.js files, and only then hands
 * node --test an explicit, already-resolved file list. "Command succeeded"
 * then always means "tests ran."
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TEST_DIR = path.join(__dirname, '..', '.mapgen-build', 'logic', '__tests__');

function findTestFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(full);
    }
  }
  return files;
}

const testFiles = findTestFiles(TEST_DIR);

if (testFiles.length === 0) {
  console.error('No *.test.js files found under ' + TEST_DIR + ' -- nothing would run.');
  console.error('Check the directory exists and that tsc compiled it first.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
