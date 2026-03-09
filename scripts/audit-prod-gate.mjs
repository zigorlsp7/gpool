#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const audit = spawnSync('npm', ['audit', '--omit', 'dev', '--audit-level', 'high'], {
  stdio: 'inherit',
});

if (audit.error) {
  console.error(`npm audit execution failed: ${audit.error.message}`);
  process.exit(1);
}

process.exit(audit.status ?? 1);
