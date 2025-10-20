#!/usr/bin/env node
/**
 * Setup script for external security testing tools
 * This script initializes git submodules and installs Python/Go dependencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    // Check if it's actually an error or just a warning
    if (error.status !== 0) {
      return false;
    }
    return true;
  }
}

function execOutput(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

log('========================================', 'cyan');
log('Pablos Network - Tools Setup', 'cyan');
log('========================================', 'cyan');
log('');

// Check if running from project root
if (!fs.existsSync('package.json')) {
  log('ERROR: Please run this script from the project root directory', 'red');
  process.exit(1);
}

// [1/5] Initialize git submodules
log('[1/5] Initializing git submodules...', 'yellow');
// Check if submodules are already initialized
if (fs.existsSync(path.join('tools', 'dirsearch', 'dirsearch.py'))) {
  log('✓ Git submodules already initialized', 'green');
} else {
  const submoduleResult = exec('git submodule update --init --recursive');
  if (!submoduleResult) {
    log('ERROR: Failed to initialize git submodules', 'red');
    process.exit(1);
  }
  log('✓ Git submodules initialized', 'green');
}
log('');

// [2/5] Check Python installation
log('[2/5] Checking Python installation...', 'yellow');
const pythonVersion = execOutput('python --version');
if (!pythonVersion) {
  log('ERROR: Python is not installed or not in PATH', 'red');
  log('Please install Python 3.9 or higher from https://www.python.org/', 'yellow');
  process.exit(1);
}
log(`✓ Found: ${pythonVersion}`, 'green');
log('');

// [3/5] Install dirsearch dependencies
log('[3/5] Installing dirsearch dependencies...', 'yellow');
if (!fs.existsSync('.venv')) {
  log('ERROR: Python virtual environment not found at .venv', 'red');
  log("Please run 'python -m venv .venv' first", 'yellow');
  process.exit(1);
}

const dirsearchReqs = path.join('tools', 'dirsearch', 'requirements.txt');
if (fs.existsSync(dirsearchReqs)) {
  log('Installing dirsearch requirements...', 'cyan');

  // Activate venv and install requirements
  const pipCommand = process.platform === 'win32'
    ? `.venv\\Scripts\\pip.exe install -r ${dirsearchReqs}`
    : `.venv/bin/pip install -r ${dirsearchReqs}`;

  const pipResult = exec(pipCommand);
  if (!pipResult) {
    log('ERROR: Failed to install dirsearch requirements', 'red');
    process.exit(1);
  }
  log('✓ Dirsearch dependencies installed', 'green');
} else {
  log(`WARNING: ${dirsearchReqs} not found`, 'yellow');
}
log('');

// [4/5] Check Go installation and build cf-hero
log('[4/5] Checking Go installation for cf-hero...', 'yellow');
const goVersion = execOutput('go version');
if (!goVersion) {
  log('WARNING: Go is not installed or not in PATH', 'yellow');
  log('CF-Hero requires Go 1.18 or higher. Install from https://go.dev/', 'yellow');
  log('Skipping cf-hero build...', 'yellow');
} else {
  log(`✓ Found: ${goVersion}`, 'green');
  
  // Build cf-hero
  log('Building cf-hero...', 'cyan');
  const binDir = 'bin';
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  
  const cfHeroExe = process.platform === 'win32' ? 'cf-hero.exe' : 'cf-hero';
  const cfHeroOut = path.join('..', '..', binDir, cfHeroExe);
  const cfHeroCmd = path.join('cmd', 'cf-hero');
  
  const buildCommand = `go build -o ${cfHeroOut} ./${cfHeroCmd}`;
  const buildResult = exec(buildCommand, { cwd: path.join('tools', 'cf-hero') });

  if (!buildResult) {
    log('ERROR: Failed to build cf-hero', 'red');
    process.exit(1);
  }
  log('✓ CF-Hero built successfully', 'green');
}
log('');

// [5/5] Set environment variables
log('[5/5] Setting up environment variables...', 'yellow');

// Determine dirsearch binary path
const dirsearchBin = process.platform === 'win32'
  ? 'python tools\\dirsearch\\dirsearch.py'
  : 'python tools/dirsearch/dirsearch.py';
log(`DIRSEARCH_BIN=${dirsearchBin}`, 'cyan');

// Determine cf-hero binary path
const cfHeroExePath = path.join('bin', process.platform === 'win32' ? 'cf-hero.exe' : 'cf-hero');
if (fs.existsSync(cfHeroExePath)) {
  const cfHeroBin = process.platform === 'win32' ? '.\\bin\\cf-hero.exe' : './bin/cf-hero';
  log(`CF_HERO_BIN=${cfHeroBin}`, 'cyan');
} else {
  log('CF_HERO_BIN=<not available>', 'yellow');
}

log('');
log('========================================', 'cyan');
log('Setup Complete!', 'green');
log('========================================', 'cyan');
log('');
log('Next steps:', 'yellow');
log('1. Add the following to your .env file:', 'reset');
log(`   DIRSEARCH_BIN=${dirsearchBin}`, 'gray');
if (fs.existsSync(cfHeroExePath)) {
  const cfHeroBin = process.platform === 'win32' ? '.\\bin\\cf-hero.exe' : './bin/cf-hero';
  log(`   CF_HERO_BIN=${cfHeroBin}`, 'gray');
}
log('');
log('2. Run healthcheck to verify setup:', 'reset');
log('   pnpm healthcheck', 'gray');
log('');

